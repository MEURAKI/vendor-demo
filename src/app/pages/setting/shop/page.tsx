// app/pages/setting/shop/page.tsx
"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import Script from "next/script";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { useToast } from "../../../../components/toast/ToastProvider";
import AppModal from "../../../../components/common/AppModal";
import Image from "next/image";
import clsx from "clsx";
import ClipLoader from "react-spinners/ClipLoader";

declare const google: any; // for TS, Google Maps is loaded via <Script>

/* ----------------------------- Types ----------------------------- */

type UserStatus =
  | "pending_admin_approval"
  | "approved"
  | "active"
  | "rejected"
  | "suspended";

type ProfileLite = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: UserStatus;
};

type VendorBusiness = {
  id: string;
  // shop – general
  shop_status: boolean;
  shop_name: string;
  shop_slug: string;
  business_category: string;
  shop_bio: string;
  contact_email: string;
  phone_country_code: string;
  phone_number: string;
  frame_id: string | null;
  commission_type: string | null;
  commission_rate: number | null;

  // ✅ dimensions as array, since DB is an array
  dimensions: string[] | null;

  // NEW: address / google / tags
  shop_address: string | null;
  google_place_id: string | null;
  google_business_page_id: string | null;
  business_tags: string | null;

  // ✅ NEW: banner URL
  shop_banner_url: string | null;

  // fulfilment
  fulfilment_delivery: boolean;
  fulfilment_pickup: boolean;
  delivery_days_standard: string | null;
  delivery_rate_standard: string | null;
  delivery_days_express: string | null;
  delivery_rate_express: string | null;
  pickup_address: string | null;
  pickup_postal_code: string | null;
  delivery_days_note: string | null;
};

type TabKey = "general" | "fulfilment" | "promo";

/* ------ Promo code types (matches public.promo_codes table) ------ */

type DiscountType = "percent" | "fixed";
type AppliesTo = "products" | "services" | "all";

type PromoCodeRow = {
  id: string;
  code: string;
  scope: "platform" | "vendor";
  vendor_id: string | null;
  name: string | null;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  applies_to: AppliesTo;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

type PromoFormState = {
  id: string | null;
  code: string;
  name: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  appliesTo: AppliesTo;
  active: boolean;
  startsAt: string; // YYYY-MM-DD
  endsAt: string; // YYYY-MM-DD
};

/* ---------------------- Simple Pill component ---------------------- */

type DimensionPillProps = {
  label: string;
  selected: boolean;
  onToggle: () => void;
};

function DimensionPill({ label, selected, onToggle }: DimensionPillProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition",
        selected
          ? "bg-black text-white border-black"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

const DIMENSION_ICON_MAP: Record<string, string> = {
  Physical: "/images/wellness/physical-realm.png",
  Emotional: "/images/wellness/emotional-realm.png",
  Mental: "/images/wellness/mental-realm.png",
  Occupational: "/images/wellness/occupational-realm.png",
  Financial: "/images/wellness/financial-realm.png",
  Environmental: "/images/wellness/Environmental-realm.png", // capital E in your file
  Social: "/images/wellness/social-realm.png",
  Spiritual: "/images/wellness/spiritual-realm.png",
};

/* ---------------------- INNER PAGE (with hooks) ---------------------- */

function ShopSettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [vb, setVb] = useState<VendorBusiness | null>(null);
  const [bioCount, setBioCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { successToast, errorToast } = useToast();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [dimensions, setDimensions] = useState<string[]>([]);

  const urlTab = (searchParams.get("tab") as TabKey) || "general";
  const [activeTab, setActiveTab] = useState<TabKey>(urlTab);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState<JSX.Element | null>(null);

  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Google Places
  const [placesLoaded, setPlacesLoaded] = useState(false);
  const addressInputRef = useRef<HTMLInputElement | null>(null);

  // Promo codes
  const [promoForm, setPromoForm] = useState<PromoFormState>({
    id: null,
    code: "",
    name: "",
    description: "",
    discountType: "percent",
    discountValue: "",
    appliesTo: "products",
    active: true,
    startsAt: "",
    endsAt: "",
  });
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoList, setPromoList] = useState<PromoCodeRow[]>([]);

  const DIMENSIONS = [
    "Physical",
    "Emotional",
    "Mental",
    "Occupational",
    "Financial",
    "Environmental",
    "Social",
    "Spiritual",
  ];

  const toggleIn = (
    arr: string[],
    value: string,
    setArr: (next: string[]) => void
  ) => {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  // Keep local state in sync with URL
  useEffect(() => {
    const next = (searchParams.get("tab") as TabKey) || "general";
    setActiveTab(next);
  }, [searchParams]);

  function switchTab(tab: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  }

  async function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !vb) return;

    setBannerError(null);

    if (!file.type.startsWith("image/")) {
      setBannerError("Please upload an image file (JPG, PNG, etc.)");
      return;
    }

    try {
      setBannerUploading(true);

      const bucket = "shop-banners";

      const filePath = `${vb.id}/shop-banner-${Date.now()}.${file.name
        .split(".")
        .pop()}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error(uploadError);
        setBannerError("Failed to upload banner. Please try again.");
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(filePath);

      setVb((prev) =>
        prev
          ? {
              ...prev,
              shop_banner_url: publicUrl,
            }
          : prev
      );

      successToast({
        title: "Banner uploaded",
        description: "Your shop banner image has been updated.",
      });
    } catch (err) {
      console.error(err);
      setBannerError("Unexpected error while uploading banner.");
    } finally {
      setBannerUploading(false);
      e.target.value = "";
    }
  }

  // Initial load: profile + vendor_business + vendor promo codes
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data: prof }, { data: vbRow }, { data: promoRows }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id,email,full_name,status")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("vendor_business")
            .select(
              `
              id,
              shop_status,
              shop_name,
              shop_slug,
              business_category,
              shop_bio,
              contact_email,
              phone_country_code,
              phone_number,
              frame_id,
              commission_type,
              commission_rate,
              shop_address,
              google_place_id,
              google_business_page_id,
              shop_banner_url,
              business_tags,
              fulfilment_delivery,
              fulfilment_pickup,
              delivery_days_standard,
              delivery_rate_standard,
              delivery_days_express,
              delivery_rate_express,
              pickup_address,
              pickup_postal_code,
              delivery_days_note,
              dimensions
            `
            )
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("promo_codes")
            .select(
              `
              id,
              code,
              scope,
              vendor_id,
              name,
              description,
              discount_type,
              discount_value,
              applies_to,
              active,
              starts_at,
              ends_at
            `
            )
            .eq("scope", "vendor")
            .eq("vendor_id", user.id)
            .order("created_at", { ascending: false }),
        ]);

      const profTyped: ProfileLite = {
        id: user.id,
        email: prof?.email ?? user.email ?? null,
        full_name: prof?.full_name ?? user.email ?? "User",
        status: (prof?.status as UserStatus) ?? "pending_admin_approval",
      };

      const defaults: VendorBusiness = {
        id: user.id,
        shop_status: false,
        shop_name: "",
        shop_slug: "",
        business_category: "",
        shop_bio: "",
        contact_email: profTyped.email ?? "",
        phone_country_code: "+65",
        phone_number: "",
        frame_id: null,
        commission_type: null,
        commission_rate: null,

        shop_address: "",
        google_place_id: "",
        google_business_page_id: "",
        business_tags: "",

        shop_banner_url: null,
        fulfilment_delivery: false,
        fulfilment_pickup: false,
        delivery_days_standard: "3 – 5 days",
        delivery_rate_standard: "0.00",
        delivery_days_express: "1 day (Between 5:00pm  9:00pm)",
        delivery_rate_express: "0.00",
        pickup_address: "",
        pickup_postal_code: "",
        delivery_days_note: "",
        // default to empty array for dimensions
        dimensions: [],
      };

      const merged: VendorBusiness = { ...defaults, ...(vbRow || {}) };

      setProfile(profTyped);
      setVb(merged);
      setBioCount(merged.shop_bio?.length || 0);
      setDimensions(merged.dimensions ?? []);

      const promoRowsTyped = (promoRows || []) as PromoCodeRow[];
      setPromoList(promoRowsTyped);

      if (promoRowsTyped.length > 0) {
        const first = promoRowsTyped[0];
        setPromoForm({
          id: first.id,
          code: first.code || "",
          name: first.name || "",
          description: first.description || "",
          discountType: first.discount_type || "percent",
          discountValue: String(first.discount_value ?? ""),
          appliesTo: first.applies_to || "products",
          active: first.active ?? true,
          startsAt: first.starts_at ? first.starts_at.slice(0, 10) : "",
          endsAt: first.ends_at ? first.ends_at.slice(0, 10) : "",
        });
      }

      setLoading(false);
    })();
  }, []);

  /* --------------------- Google Places setup --------------------- */

  // Resolve a pasted / typed address into a specific business place using PlacesService
  function resolveAddressToPlace(address: string) {
    if (!placesLoaded || !address) return;
    if (typeof window === "undefined") return;

    const g = (window as any).google;
    if (!g?.maps?.places?.PlacesService) return;

    const service = new g.maps.places.PlacesService(
      document.createElement("div")
    );

    service.findPlaceFromQuery(
      {
        query: address,
        fields: ["formatted_address", "place_id", "name", "url", "website"],
      },
      (results: any[], status: string) => {
        if (
          status !== g.maps.places.PlacesServiceStatus.OK ||
          !results ||
          !results.length
        ) {
          // No good match -> keep raw text
          return;
        }

        const best = results[0];

        const formatted =
          best.formatted_address ||
          addressInputRef.current?.value ||
          address;
        const placeId = best.place_id || "";
        const businessPageId =
          placeId ||
          (best.url as string | undefined) ||
          (best.website as string | undefined) ||
          "";

        setVb((prev) =>
          prev
            ? {
                ...prev,
                shop_address: formatted,
                google_place_id: placeId,
                google_business_page_id: businessPageId,
              }
            : prev
        );
      }
    );
  }

  function handleAddressBlur() {
    if (!vb?.shop_address) return;

    // If they pasted / typed and we don't have a place id yet, resolve it
    if (!vb.google_place_id) {
      resolveAddressToPlace(vb.shop_address);
    }
  }

  useEffect(() => {
    if (!placesLoaded) return;
    if (!addressInputRef.current) return;
    if (typeof window === "undefined") return;
    const g = (window as any).google;
    if (!g?.maps?.places?.Autocomplete) return;

    const autocomplete = new g.maps.places.Autocomplete(
      addressInputRef.current,
      {
        // Prefer actual business places
        types: ["establishment"],
        componentRestrictions: { country: "sg" },
        fields: ["formatted_address", "place_id", "name", "url", "website"],
      }
    );

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const formatted =
        place.formatted_address || addressInputRef.current?.value || "";
      const placeId = place.place_id || "";

      const businessPageId =
        placeId ||
        (place.url as string | undefined) ||
        (place.website as string | undefined) ||
        "";

      setVb((prev) =>
        prev
          ? {
              ...prev,
              shop_address: formatted,
              google_place_id: placeId,
              google_business_page_id: businessPageId,
            }
          : prev
      );
    });

    return () => {
      if (g?.maps?.event?.clearInstanceListeners) {
        g.maps.event.clearInstanceListeners(autocomplete);
      }
    };
  }, [placesLoaded]);

  /* ------------------------- Sidebar config ------------------------- */

  const sidebarConfig = useMemo(() => {
    const statusLabel =
      profile?.status === "active" ? "active" : "Incomplete Registration";

    return buildSidebarConfig({
      fullName: profile?.full_name ?? profile?.email ?? "User",
      email: profile?.email ?? "",
      role: "Vendor",
      status: statusLabel,
    });
  }, [profile]);

  /* ------------------------- Save helpers --------------------------- */

  function buildPayload(src: VendorBusiness) {
    return {
      id: src.id,
      // general
      shop_status: src.shop_status,
      shop_name: (src.shop_name || "").trim(),
      shop_slug: (src.shop_slug || "").replace(/[^a-z0-9-]/gi, "").toLowerCase(),
      business_category: (src.business_category || "").trim(),
      shop_bio: (src.shop_bio || "").slice(0, 200),
      contact_email: (src.contact_email || "").trim(),
      phone_country_code: src.phone_country_code || "+65",
      phone_number: (src.phone_number || "").trim(),
      frame_id: src.frame_id,
      commission_type: src.commission_type,
      commission_rate: src.commission_rate,
      shop_banner_url: src.shop_banner_url,

      shop_address: (src.shop_address || "").trim(),
      google_place_id: src.google_place_id || null,
      google_business_page_id: src.google_business_page_id || null,
      business_tags: (src.business_tags || "").trim(),

      // fulfilment
      fulfilment_delivery: !!src.fulfilment_delivery,
      fulfilment_pickup: !!src.fulfilment_pickup,
      delivery_days_standard: src.delivery_days_standard,
      delivery_rate_standard: src.delivery_rate_standard,
      delivery_days_express: src.delivery_days_express,
      delivery_rate_express: src.delivery_rate_express,
      pickup_address: src.pickup_address,
      pickup_postal_code: src.pickup_postal_code,
      delivery_days_note: src.delivery_days_note,

      // ✅ send as Postgres array (text[]) via Supabase
      dimensions: dimensions.length ? dimensions : null,

      updated_at: new Date().toISOString(),
    };
  }

  async function save(tab: "general" | "fulfilment") {
    if (!vb) return;

    if (tab === "general") {
      const trimmedSlug = (vb.shop_slug || "").trim();

      if (!trimmedSlug) {
        setModalTitle("Add your shop URL");
        setModalMessage(
          <>
            <p className="text-xs text-gray-700">
              To save your shop settings, please add a <strong>Shop URL / Handle</strong>.
            </p>
            <p className="mt-2 text-[11px] text-gray-500">
              This is the last part of your public shop link, e.g.&nbsp;
              <span className="font-mono text-[11px]">
                https://meuraki.com.sg/<span className="underline">your-shop</span>
              </span>
              .
            </p>
          </>
        );
        setModalOpen(true);
        return;
      }
    }

    setSaving(true);

    const payload = buildPayload(vb);

    const { error } = await supabase
      .from("vendor_business")
      .upsert(payload, { onConflict: "id" });

    setSaving(false);
    if (error) {
      console.error(error);
      errorToast({
        title: "Error",
        description:
          tab === "general"
            ? "Failed to save shop settings."
            : "Failed to save fulfilment details.",
      });
    } else {
      successToast({
        title: "Success",
        description:
          tab === "general"
            ? "Shop settings saved."
            : "Fulfilment details saved successfully.",
      });
    }
  }

  /* ---------------------- Promo save helper ---------------------- */

  async function savePromo() {
    if (!profile) return;

    const code = promoForm.code.trim().toUpperCase();
    if (!code) {
      errorToast({
        title: "Promo code is required",
        description: "Please enter a promo code before saving.",
      });
      return;
    }

    const discountValueInt = parseInt(promoForm.discountValue || "0", 10);
    if (!discountValueInt || discountValueInt <= 0) {
      errorToast({
        title: "Discount value is invalid",
        description: "Please enter a positive discount value.",
      });
      return;
    }

    setPromoSaving(true);

    try {
      const startsAt =
        promoForm.startsAt.trim() !== ""
          ? new Date(`${promoForm.startsAt}T00:00:00.000Z`).toISOString()
          : null;
      const endsAt =
        promoForm.endsAt.trim() !== ""
          ? new Date(`${promoForm.endsAt}T23:59:59.999Z`).toISOString()
          : null;

      const payload = {
        ...(promoForm.id ? { id: promoForm.id } : {}),
        code,
        scope: "vendor" as const,
        vendor_id: profile.id,
        name: promoForm.name.trim() || null,
        description: promoForm.description.trim() || null,
        discount_type: promoForm.discountType,
        discount_value: discountValueInt,
        applies_to: promoForm.appliesTo,
        active: promoForm.active,
        starts_at: startsAt,
        ends_at: endsAt,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("promo_codes")
        .upsert(payload, { onConflict: "code,scope,vendor_id" })
        .select(
          `
          id,
          code,
          scope,
          vendor_id,
          name,
          description,
          discount_type,
          discount_value,
          applies_to,
          active,
          starts_at,
          ends_at
        `
        )
        .eq("code", code)
        .eq("scope", "vendor")
        .eq("vendor_id", profile.id)
        .limit(1)
        .single();

      if (error) {
        console.error(error);
        errorToast({
          title: "Error saving promo code",
          description: error.message || "Please try again.",
        });
      } else {
        const saved = data as PromoCodeRow;

        setPromoForm((prev) => ({
          ...prev,
          id: saved.id,
        }));

        setPromoList((prev) => {
          const without = prev.filter((p) => p.id !== saved.id);
          return [saved, ...without];
        });

        successToast({
          title: "Promo code saved",
          description: "Your promo code has been saved successfully.",
        });
      }
    } finally {
      setPromoSaving(false);
    }
  }

  /* ------------------------- Loading state -------------------------- */

  if (loading || !vb || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <ClipLoader size="md" color="gray" />
      </div>
    );
  }

  /* ------------------------- Render -------------------------- */

  return (
    <>
      {/* Google Places script – v2 style (weekly) */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&v=weekly`}
        strategy="afterInteractive"
        onLoad={() => setPlacesLoaded(true)}
      />

      <AppModal
        open={modalOpen}
        title={modalTitle}
        message={modalMessage}
        primaryLabel="Okay, got it"
        onPrimaryClick={() => setModalOpen(false)}
        onClose={() => setModalOpen(false)}
      />

      <div className="flex h-screen bg-[#F7F7FB]">
        <Sidebar config={sidebarConfig} />
        <SettingsNav />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-8 py-10">
            <h1 className="text-[28px] font-semibold text-gray-900">Shop Settings</h1>

            {/* Tabs (URL-driven) */}
            <div className="mt-6 flex gap-8 border-b border-gray-200 text-sm">
              <button
                type="button"
                onClick={() => switchTab("general")}
                className={[
                  "pb-3",
                  activeTab === "general"
                    ? "border-b-2 border-gray-900 font-semibold text-gray-900"
                    : "text-gray-600 hover:text-gray-900",
                ].join(" ")}
              >
                General
              </button>
              <button
                type="button"
                onClick={() => switchTab("fulfilment")}
                className={[
                  "pb-3",
                  activeTab === "fulfilment"
                    ? "border-b-2 border-gray-900 font-semibold text-gray-900"
                    : "text-gray-600 hover:text-gray-900",
                ].join(" ")}
              >
                Fulfilment &amp; Delivery
              </button>
              <button
                type="button"
                onClick={() => switchTab("promo")}
                className={[
                  "pb-3",
                  activeTab === "promo"
                    ? "border-b-2 border-gray-900 font-semibold text-gray-900"
                    : "text-gray-600 hover:text-gray-900",
                ].join(" ")}
              >
                Promo Codes
              </button>
            </div>

            {/* Verification banner: only when NOT active */}
            {profile.status !== "active" && (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm text-white">
                <span className="inline-block h-2 w-2 rounded-full bg-purple-400" />
                You cannot publish products, list services, or receive payouts until your
                business is verified.
              </div>
            )}

            {/* GENERAL TAB ------------------------------------------------ */}
            {activeTab === "general" && (
              <form
                className="mt-8 space-y-12 pb-28"
                onSubmit={(e) => {
                  e.preventDefault();
                  save("general");
                }}
              >
                {/* Shop Status */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Shop Status</div>
                    <p className="mt-1 text-xs text-gray-500">
                      Toggle ON to go live, or OFF to hide your shop from the marketplace.
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <div className="text-sm text-gray-700">
                      {vb.shop_status ? "Live" : "Hidden"}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setVb((prev) =>
                          prev ? { ...prev, shop_status: !prev.shop_status } : prev
                        )
                      }
                      className={[
                        "relative h-6 w-11 rounded-full transition",
                        vb.shop_status ? "bg-purple-600" : "bg-gray-300",
                      ].join(" ")}
                      aria-label="Toggle shop status"
                    >
                      <span
                        className={[
                          "absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white shadow transition",
                          vb.shop_status ? "right-1" : "left-1",
                        ].join(" ")}
                      />
                    </button>
                  </div>
                </section>
                <div className="border-t border-gray-200" />

                {/* Name */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Shop Name</div>
                    <p className="mt-1 text-xs text-gray-500">
                      Displayed name of vendor’s store.
                    </p>
                  </div>
                  <input
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    value={vb.shop_name}
                    onChange={(e) =>
                      setVb((prev) =>
                        prev ? { ...prev, shop_name: e.target.value } : prev
                      )
                    }
                    placeholder="Wellness Club Co."
                  />
                </section>

                {/* Shop Address + Google Business Page ID */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Shop Address
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Paste the exact address from Google (e.g.{" "}
                      <span className="font-mono text-[11px]">
                        1 Kim Seng Promenade #02-102/103 Great World City, Singapore
                        237994
                      </span>
                      ) or search and select from suggestions.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <input
                      ref={addressInputRef}
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      value={vb.shop_address ?? ""}
                      onChange={(e) =>
                        setVb((prev) =>
                          prev
                            ? {
                                ...prev,
                                shop_address: e.target.value,
                                // reset so blur will re-resolve to a business place
                                google_place_id: null,
                              }
                            : prev
                        )
                      }
                      onBlur={handleAddressBlur}
                      placeholder="Paste or type your full address"
                    />

                    <div className="hidden">
                      <label className="mb-1 block text-xs text-gray-500">
                        Google Business Page ID (Filled automatically)
                      </label>
                      <input
                        disabled
                        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-gray-900"
                        value={vb.google_business_page_id ?? ""}
                        placeholder="Automatically set after selecting / resolving address"
                      />
                    </div>
                  </div>
                </section>

                <div className="border-t border-gray-200" />

                {/* Shop URL / Handle */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Shop URL / Handle
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Custom URL slug for vendor’s storefront. e.g
                      https://meuraki.com.sg/shop-name
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="select-none text-sm text-gray-500">/</span>
                    <input
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      value={vb.shop_slug}
                      onChange={(e) =>
                        setVb((prev) =>
                          prev
                            ? {
                                ...prev,
                                shop_slug: e.target.value
                                  .replace(/[^a-z0-9-]/gi, "")
                                  .toLowerCase(),
                              }
                            : prev
                        )
                      }
                      placeholder="custom-handle"
                    />
                  </div>
                </section>
                <div className="border-t border-gray-200" />

                {/* Shop Banner */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Shop Banner
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Upload a wide banner image shown at the top of your shop page.
                      Recommended ratio 3:1 (e.g. 1200×400px).
                    </p>
                  </div>

                  <div className="space-y-3">
                    {vb.shop_banner_url && (
                      <div className="relative h-32 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                        <Image
                          src={vb.shop_banner_url}
                          alt="Shop banner preview"
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <label
                        htmlFor="shop-banner-input"
                        className="inline-flex items-center justify-center rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-gray-900 cursor-pointer"
                      >
                        {bannerUploading ? "Uploading…" : "Upload banner image"}
                      </label>
                      <input
                        id="shop-banner-input"
                        type="file"
                        accept="image/*"
                        onChange={handleBannerChange}
                        className="hidden"
                      />

                      {vb.shop_banner_url && (
                        <button
                          type="button"
                          onClick={() =>
                            setVb((prev) =>
                              prev ? { ...prev, shop_banner_url: null } : prev
                            )
                          }
                          className="text-[11px] text-gray-500 hover:text-red-600"
                        >
                          Remove banner
                        </button>
                      )}
                    </div>

                    {bannerError && (
                      <p className="text-[11px] text-red-600">{bannerError}</p>
                    )}
                  </div>
                </section>
                <div className="border-t border-gray-200" />

                {/* Wellness Dimensions */}
                <section className="mt-8">
                  <div className="text-sm font-semibold text-gray-900">
                    Select Your Wellness Dimensions
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Choose one or more dimensions that best represent your brand focus.
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {DIMENSIONS.map((d) => {
                      const active = dimensions.includes(d);
                      const iconSrc = DIMENSION_ICON_MAP[d];

                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleIn(dimensions, d, setDimensions)}
                          className={clsx(
                            "flex w-full flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-3 text-center text-[11px] leading-tight transition focus:outline-none focus:ring-2 focus:ring-[#5B33FF]/40",
                            active
                              ? "border-[#5B33FF] bg-[#EFEDFF] text-[#1B1529]"
                              : "border-gray-200 bg-white text-gray-700 hover:border-[#C4B5FF]"
                          )}
                        >
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F5F3FF]">
                            <img
                              src={iconSrc}
                              alt={d}
                              className="h-full w-full object-contain"
                            />
                          </div>

                          <span className="break-words break-all">{d}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-8 border-gray-200" />
                </section>

                {/* Business Category */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Business Category
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Primary focus area.</p>
                  </div>
                  <input
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    value={vb.business_category}
                    onChange={(e) =>
                      setVb((prev) =>
                        prev ? { ...prev, business_category: e.target.value } : prev
                      )
                    }
                    placeholder="Wellness, Skincare, Nutrition"
                  />
                </section>
                <div className="border-t border-gray-200" />

                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Shop Description / Bio (Short)
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      About the shop (public-facing).
                    </p>
                  </div>
                  <div>
                    <textarea
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 bg-white p-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      maxLength={200}
                      value={vb.shop_bio}
                      onChange={(e) => {
                        const value = e.target.value.slice(0, 200);
                        setVb((prev) => (prev ? { ...prev, shop_bio: value } : prev));
                        setBioCount(value.length);
                      }}
                      placeholder="Promoting holistic wellbeing…"
                    />
                    <div className="mt-1 text-right text-xs text-gray-500">
                      {bioCount}/200
                    </div>
                  </div>
                </section>

                <div className="border-t border-gray-200" />

                {/* Business #Tags */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Business #Tags
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Primary focus tags. Use comma or space separated hashtags (e.g.
                      #yoga, #yogamats).
                    </p>
                  </div>
                  <input
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    value={vb.business_tags ?? ""}
                    onChange={(e) =>
                      setVb((prev) =>
                        prev ? { ...prev, business_tags: e.target.value } : prev
                      )
                    }
                    placeholder="#yoga, #yogamats"
                  />
                </section>
                <div className="border-t border-gray-200" />

                {/* Contact email */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Shop Contact Email Address
                    </div>
                    <p className="mt-1 text-xs text-gray-500">For customer inquiries.</p>
                  </div>
                  <input
                    type="email"
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    value={vb.contact_email}
                    onChange={(e) =>
                      setVb((prev) =>
                        prev ? { ...prev, contact_email: e.target.value } : prev
                      )
                    }
                    placeholder="e.g. janedoe@gmail.com"
                  />
                </section>
                <div className="border-t border-gray-200" />

                {/* Contact phone */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Shop WhatsApp Number
                    </div>
                    <p className="mt-1 text-xs text-gray-500">For customer inquiries.</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="h-11 w-24 rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      value={vb.phone_country_code}
                      onChange={(e) =>
                        setVb((prev) =>
                          prev ? { ...prev, phone_country_code: e.target.value } : prev
                        )
                      }
                      placeholder="+65"
                    />
                    <input
                      className="h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      value={vb.phone_number}
                      onChange={(e) =>
                        setVb((prev) =>
                          prev ? { ...prev, phone_number: e.target.value } : prev
                        )
                      }
                      placeholder="0000 0000"
                    />
                  </div>
                </section>
                <div className="border-t border-gray-200" />

                {/* Frame & Commission (read-only display) */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Frame</div>
                    <p className="mt-1 text-xs text-gray-500">
                      MEURAKI shop package and agreed rate
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <input
                      disabled
                      className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-gray-900"
                      value={vb.frame_id || "—"}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        disabled
                        className="h-11 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-gray-900"
                        value={vb.commission_type || "Growth Package"}
                      />
                      <div className="flex items-center gap-2">
                        <input
                          disabled
                          className="h-11 w-20 rounded-xl border border-gray-200 bg-gray-50 px-3 text-center text-gray-900"
                          value={vb.commission_rate ?? 15}
                        />
                        <span className="text-sm text-gray-600">%</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Sticky save bar */}
                <div className="fixed bottom-0 left-0 right-0 z-10 ml-[calc(300px+280px)] bg-transparent">
                  <div className="mx-auto max-w-5xl px-8 pb-6">
                    <div className="flex items-center justify-end gap-3 rounded-full border border-gray-200 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur">
                      <a
                        href="/pages/setting/business"
                        className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Go back without saving
                      </a>
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* FULFILMENT TAB -------------------------------------------- */}
            {activeTab === "fulfilment" && (
              <form
                className="mt-8 space-y-12 pb-28"
                onSubmit={(e) => {
                  e.preventDefault();
                  save("fulfilment");
                }}
              >
                {/* Fulfilment method */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Fulfilment Method
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      How vendor delivers products/services.
                    </p>
                  </div>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        checked={!!vb.fulfilment_delivery}
                        onChange={(e) =>
                          setVb((prev) =>
                            prev
                              ? { ...prev, fulfilment_delivery: e.target.checked }
                              : prev
                          )
                        }
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      Delivery
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        checked={!!vb.fulfilment_pickup}
                        onChange={(e) =>
                          setVb((prev) =>
                            prev
                              ? { ...prev, fulfilment_pickup: e.target.checked }
                              : prev
                          )
                        }
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      Pickup
                    </label>
                  </div>
                </section>
                <div className="border-t border-gray-200" />

                {/* Shipping profiles */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Shipping Profile &amp; Pricing
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Standard and express delivery options.
                    </p>
                  </div>
                  <div className="space-y-5">
                    {/* Standard */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-900">
                        Standard Delivery
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                          value={vb.delivery_days_standard ?? ""}
                          onChange={(e) =>
                            setVb((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    delivery_days_standard: e.target.value,
                                  }
                                : prev
                            )
                          }
                          placeholder="3 – 5 days"
                        />
                        <input
                          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                          value={vb.delivery_rate_standard ?? ""}
                          onChange={(e) =>
                            setVb((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    delivery_rate_standard: e.target.value,
                                  }
                                : prev
                            )
                          }
                          placeholder="$20.00"
                        />
                      </div>
                    </div>

                    {/* Express */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-900">
                        Express Delivery
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                          value={vb.delivery_days_express ?? ""}
                          onChange={(e) =>
                            setVb((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    delivery_days_express: e.target.value,
                                  }
                                : prev
                            )
                          }
                          placeholder="1 day (Between 5:00pm – 9:00pm)"
                        />
                        <input
                          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                          value={vb.delivery_rate_express ?? ""}
                          onChange={(e) =>
                            setVb((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    delivery_rate_express: e.target.value,
                                  }
                                : prev
                            )
                          }
                          placeholder="$30.00"
                        />
                      </div>
                    </div>
                  </div>
                </section>
                <div className="border-t border-gray-200" />

                {/* Pickup address */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Pickup Address
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Your store address is your pickup address. However, if you have a
                      warehouse, provide that instead.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <input
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                      value={vb.pickup_address ?? ""}
                      onChange={(e) =>
                        setVb((prev) =>
                          prev ? { ...prev, pickup_address: e.target.value } : prev
                        )
                      }
                      placeholder="56 Tanglin Road, 01-03 Singapore 247964"
                    />
                    <input
                      className="h-11 w-40 rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                      value={vb.pickup_postal_code ?? ""}
                      onChange={(e) =>
                        setVb((prev) =>
                          prev
                            ? { ...prev, pickup_postal_code: e.target.value }
                            : prev
                        )
                      }
                      placeholder="247964"
                    />
                  </div>
                </section>
                <div className="border-t border-gray-200" />

                {/* Delivery days note */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Delivery Days
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Days available for delivery.
                    </p>
                  </div>
                  <input
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900"
                    value={vb.delivery_days_note ?? ""}
                    onChange={(e) =>
                      setVb((prev) =>
                        prev ? { ...prev, delivery_days_note: e.target.value } : prev
                      )
                    }
                    placeholder="e.g. Monday – Fridays | 9:00am to 5:00pm"
                  />
                </section>

                {/* Sticky save bar */}
                <div className="fixed bottom-0 left-0 right-0 z-10 ml-[calc(300px+280px)] bg-transparent">
                  <div className="mx-auto max-w-5xl px-8 pb-6">
                    <div className="pointer-events-auto flex items-center justify-end gap-3 rounded-full border border-gray-200 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur">
                      <a
                        href="/pages/setting/shop"
                        className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Go back without saving
                      </a>
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* PROMO TAB -------------------------------------------------- */}
            {activeTab === "promo" && (
              <form
                className="mt-8 space-y-10 pb-28"
                onSubmit={(e) => {
                  e.preventDefault();
                  savePromo();
                }}
              >
                {/* Promo code basics */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Promo Code
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Create discount codes your customers can apply at checkout.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <input
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 uppercase tracking-[0.15em] focus:border-purple-500 focus:ring-purple-500"
                      placeholder="WELCOME10"
                      value={promoForm.code}
                      onChange={(e) =>
                        setPromoForm((prev) => ({
                          ...prev,
                          code: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                    <input
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      placeholder="Internal name (e.g. Welcome offer)"
                      value={promoForm.name}
                      onChange={(e) =>
                        setPromoForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    />
                    <textarea
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      placeholder="Short description (optional)"
                      value={promoForm.description}
                      onChange={(e) =>
                        setPromoForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                </section>

                <div className="border-t border-gray-200" />

                {/* Discount type + value (SGD / %) */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Discount
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Choose between a fixed SGD amount or a percentage off.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="inline-flex rounded-full bg-gray-100 p-1 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setPromoForm((prev) => ({
                            ...prev,
                            discountType: "fixed",
                          }))
                        }
                        className={clsx(
                          "rounded-full px-3 py-1",
                          promoForm.discountType === "fixed"
                            ? "bg-white shadow-sm text-gray-900"
                            : "text-gray-500"
                        )}
                      >
                        SGD
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPromoForm((prev) => ({
                            ...prev,
                            discountType: "percent",
                          }))
                        }
                        className={clsx(
                          "rounded-full px-3 py-1",
                          promoForm.discountType === "percent"
                            ? "bg-white shadow-sm text-gray-900"
                            : "text-gray-500"
                        )}
                      >
                        %
                      </button>
                    </div>
                    <input
                      className="h-11 w-32 rounded-xl border border-gray-200 bg-white px-3 text-right text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      type="number"
                      min={1}
                      placeholder="10"
                      value={promoForm.discountValue}
                      onChange={(e) =>
                        setPromoForm((prev) => ({
                          ...prev,
                          discountValue: e.target.value,
                        }))
                      }
                    />
                    <span className="text-xs text-gray-500">
                      {promoForm.discountType === "fixed"
                        ? "off order total (SGD)"
                        : "% off order total"}
                    </span>
                  </div>
                </section>

                <div className="border-t border-gray-200" />

                {/* Validity period */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Validity Period
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      When this promo code can be redeemed.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-500">
                        Starts on
                      </label>
                      <input
                        type="date"
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                        value={promoForm.startsAt}
                        onChange={(e) =>
                          setPromoForm((prev) => ({
                            ...prev,
                            startsAt: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-gray-500">
                        Ends on
                      </label>
                      <input
                        type="date"
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                        value={promoForm.endsAt}
                        onChange={(e) =>
                          setPromoForm((prev) => ({
                            ...prev,
                            endsAt: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </section>

                <div className="border-t border-gray-200" />

                {/* Applies to: All / Products / Services */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Applies To
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Choose whether this promo applies to all items, only products, or
                      only services.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-800">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="appliesTo"
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                        checked={promoForm.appliesTo === "all"}
                        onChange={() =>
                          setPromoForm((prev) => ({
                            ...prev,
                            appliesTo: "all",
                          }))
                        }
                      />
                      All
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="appliesTo"
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                        checked={promoForm.appliesTo === "products"}
                        onChange={() =>
                          setPromoForm((prev) => ({
                            ...prev,
                            appliesTo: "products",
                          }))
                        }
                      />
                      Products only
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="appliesTo"
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                        checked={promoForm.appliesTo === "services"}
                        onChange={() =>
                          setPromoForm((prev) => ({
                            ...prev,
                            appliesTo: "services",
                          }))
                        }
                      />
                      Services only
                    </label>
                  </div>
                </section>

                <div className="border-t border-gray-200" />

                {/* Active toggle */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Promo Status
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Toggle OFF to pause this promo code.
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <div className="text-sm text-gray-700">
                      {promoForm.active ? "Active" : "Paused"}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPromoForm((prev) => ({
                          ...prev,
                          active: !prev.active,
                        }))
                      }
                      className={clsx(
                        "relative h-6 w-11 rounded-full transition",
                        promoForm.active ? "bg-purple-600" : "bg-gray-300"
                      )}
                    >
                      <span
                        className={clsx(
                          "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition",
                          promoForm.active ? "right-1" : "left-1"
                        )}
                      />
                    </button>
                  </div>
                </section>

                {/* Existing promo list */}
                {promoList.length > 0 && (
                  <>
                    <div className="border-t border-gray-200" />
                    <section className="space-y-4">
                      <div className="text-sm font-semibold text-gray-900">
                        Existing Promo Codes
                      </div>
                      <div className="space-y-2 text-xs text-gray-700">
                        {promoList.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              setPromoForm({
                                id: p.id,
                                code: p.code,
                                name: p.name || "",
                                description: p.description || "",
                                discountType: p.discount_type,
                                discountValue: String(p.discount_value),
                                appliesTo: p.applies_to,
                                active: p.active,
                                startsAt: p.starts_at
                                  ? p.starts_at.slice(0, 10)
                                  : "",
                                endsAt: p.ends_at ? p.ends_at.slice(0, 10) : "",
                              })
                            }
                            className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left hover:bg-gray-50"
                          >
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold tracking-[0.14em]">
                                {p.code}
                              </span>
                              <span className="text-[11px] text-gray-500">
                                {p.discount_type === "fixed"
                                  ? `SGD ${p.discount_value} off`
                                  : `${p.discount_value}% off`}{" "}
                                · {p.applies_to}
                              </span>
                            </div>
                            <span className="text-[11px] text-gray-500">
                              {p.active ? "Active" : "Paused"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                {/* Sticky save bar */}
                <div className="fixed bottom-0 left-0 right-0 z-10 ml-[calc(300px+280px)] bg-transparent">
                  <div className="mx-auto max-w-5xl px-8 pb-6">
                    <div className="flex items-center justify-end gap-3 rounded-full border border-gray-200 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur">
                      <button
                        type="button"
                        onClick={() =>
                          setPromoForm({
                            id: null,
                            code: "",
                            name: "",
                            description: "",
                            discountType: "percent",
                            discountValue: "",
                            appliesTo: "products",
                            active: true,
                            startsAt: "",
                            endsAt: "",
                          })
                        }
                        className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Clear form
                      </button>
                      <button
                        type="submit"
                        disabled={promoSaving}
                        className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
                      >
                        {promoSaving ? "Saving…" : "Save promo code"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

/* ---------------------- OUTER WRAPPER (Suspense) ---------------------- */

export default function ShopSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <ClipLoader size="md" color="gray" />
        </div>
      }
    >
      <ShopSettingsPageInner />
    </Suspense>
  );
}

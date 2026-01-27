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

declare const google: any;

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
  business_category: string; // primary label text

  // ✅ new array columns
  products_business_category: string[] | null;
  session_business_category: string[] | null;

  shop_bio: string;
  contact_email: string;
  phone_country_code: string;
  phone_number: string;
  frame_id: string | null;
  commission_type: string | null;
  commission_rate: number | null;

  dimensions: string[] | null;

  // address / google / tags
  shop_address: string | null;
  google_place_id: string | null;
  google_business_page_id: string | null;
  business_tags: string | null;

  // banner URL
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

  // pulled from vendor_business (for completeness)
  brand_logo_url: string | null;
  policy_url: string | null;

  session_operating_hours: SessionOperatingHour[] | null;
};

type TabKey = "general" | "fulfilment" | "promos" | "sessions";
/* ---- Promo code types ---- */

type PromoScope = "platform" | "vendor";
type PromoAppliesTo = "all" | "products" | "services";
type DiscountType = "percent" | "fixed";

type PromoCode = {
  id: string;
  vendor_id: string | null;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  times_redeemed: number;
  scope: PromoScope;
  applies_to: PromoAppliesTo;
  created_at: string;
};

type PromoFormState = {
  code: string;
  description: string;
  discount_type: DiscountType;
  discount_value: string;
  active: boolean;
  starts_at: string;
  ends_at: string;
  max_redemptions: string;
  applies_to: PromoAppliesTo;
};

type DayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

type SessionTimeRange = {
  id: string;
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
};

type SessionOperatingHour = {
  day: DayName;
  enabled: boolean;
  ranges: SessionTimeRange[]; // ✅ multiple ranges per day
};
const DAYS: DayName[] = [
  "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday",
];

function uuid() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

const DEFAULT_SESSION_HOURS: SessionOperatingHour[] = DAYS.map((d) => ({
  day: d,
  enabled: false,
  ranges: [{ id: uuid(), start: "08:00", end: "22:00" }], // ✅ default 1 range
}));

const DEFAULT_APPLIES_TO: PromoAppliesTo = "all";

/* ---- Docs & payout for completeness ---- */

type DocKind =
  | "vendor_agreement"
  | "uen_acra"
  | "product_certificate"
  | "service_certificate";

type DocRow = {
  id: string;
  vendor_id: string;
  kind: DocKind;
  status: "pending" | "approved" | "rejected";
};

type PayoutLite = {
  vendor_id: string;
  account_number?: string | null;
  bank_holder_name?: string | null;
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

function normalizeSessionHours(input: any): SessionOperatingHour[] {
  // if null/undefined/not array -> fallback
  if (!Array.isArray(input) || input.length === 0) return DEFAULT_SESSION_HOURS;

  return DAYS.map((day) => {
    const found = input.find((x: any) => x?.day === day) ?? {};

    // NEW format already (ranges array)
    if (Array.isArray(found.ranges)) {
      return {
        day,
        enabled: !!found.enabled,
        ranges:
          found.ranges.length > 0
            ? found.ranges.map((r: any) => ({
                id: r?.id ?? uuid(),
                start: r?.start ?? "08:00",
                end: r?.end ?? "22:00",
              }))
            : [{ id: uuid(), start: "08:00", end: "22:00" }],
      };
    }

    // OLD format (start/end at top-level)
    if (typeof found.start === "string" && typeof found.end === "string") {
      return {
        day,
        enabled: !!found.enabled,
        ranges: [{ id: uuid(), start: found.start, end: found.end }],
      };
    }

    // default for missing day
    return {
      day,
      enabled: false,
      ranges: [{ id: uuid(), start: "08:00", end: "22:00" }],
    };
  });
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function validateRanges(ranges: { start: string; end: string }[]) {
  const errs: string[] = [];

  const normalized = (ranges ?? [])
    .filter((r) => !!r.start && !!r.end)
    .map((r) => ({
      start: r.start,
      end: r.end,
      s: toMinutes(r.start),
      e: toMinutes(r.end),
    }))
    .sort((a, b) => a.s - b.s);

  for (const r of normalized) {
    if (r.e <= r.s) errs.push("End time must be after start time.");
  }

  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i].s < normalized[i - 1].e) {
      errs.push("Time ranges cannot overlap.");
      break;
    }
  }

  return errs;
}

const DIMENSION_ICON_MAP: Record<string, string> = {
  Physical: "/images/wellness/physical-realm.png",
  Emotional: "/images/wellness/emotional-realm.png",
  Mental: "/images/wellness/mental-realm.png",
  Occupational: "/images/wellness/occupational-realm.png",
  Financial: "/images/wellness/financial-realm.png",
  Environmental: "/images/wellness/Environmental-realm.png",
  Social: "/images/wellness/social-realm.png",
  Spiritual: "/images/wellness/spiritual-realm.png",
};

const DIMENSIONS_ALL = [
  "Physical",
  "Emotional",
  "Mental",
  "Occupational",
  "Financial",
  "Environmental",
  "Social",
  "Spiritual",
];

/* ---------------------- Business Category Options ---------------------- */

const PRODUCT_CATEGORIES = [
  "Personal Care & Beauty",
  "Inner Wellness Boosters",
  "Beverages & Blends",
  "Fitness Gear",
  "Fashion & Accessories",
  "Home & Living",
  "Conscious Foods",
  "Kids & Family Care",
  "Gifting & Kits",
  "Spiritual Tools",
  "Workplace Wellness",
  "Pet Wellness",
];

const SERVICE_CATEGORIES = [
  "Fitness & Training",
  "Skin & Beauty",
  "Massage & Bodywork",
  "Nutrition Coaching",
  "Lifestyle & Wellbeing",
  "Therapies & Care",
  "Mental Health",
  "Life Coaching",
  "Traditional Healing",
  "Energy Healing",
  "Creative Arts Therapy",
  "Family & Parenting Support",
];

const EXPERIENCE_CATEGORIES = [
  "Workshops & Classes",
  "Retreat Activities (In-city)",
  "Community Circles",
  "Outdoor & Nature Experiences",
  "Arts, Music & Movement",
  "Conscious Culinary Experiences",
  "Family & Youth Programs",
  "Festivals & Pop-Ups",
];

/* ---------------------- INNER PAGE (with hooks) ---------------------- */

function ShopSettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [vb, setVb] = useState<VendorBusiness | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [payout, setPayout] = useState<PayoutLite | null>(null);

  const [bioCount, setBioCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { successToast, errorToast } = useToast();
  const [dimensions, setDimensions] = useState<string[]>([]);

  // ✅ separate state for the two new columns
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [sessionCategories, setSessionCategories] = useState<string[]>([]);

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
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoForm, setPromoForm] = useState<PromoFormState>({
    code: "",
    description: "",
    discount_type: "percent",
    discount_value: "",
    active: true,
    starts_at: "",
    ends_at: "",
    max_redemptions: "",
    applies_to: DEFAULT_APPLIES_TO,
  });

const [sessionHours, setSessionHours] = useState<SessionOperatingHour[]>(
  DEFAULT_SESSION_HOURS
);


const sessionHoursErrorsByDay = useMemo(() => {
  const out: Record<string, string[]> = {};
  for (const row of sessionHours) {
    if (!row.enabled) {
      out[row.day] = [];
      continue;
    }
    out[row.day] = validateRanges(row.ranges ?? []);
  }
  return out;
}, [sessionHours]);

const sessionHoursErrors = useMemo(() => {
  return Object.values(sessionHoursErrorsByDay).flat();
}, [sessionHoursErrorsByDay]);

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

  /* ---------------- Initial load ---------------- */

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const [
        { data: prof },
        { data: vbRow },
        { data: promoRows, error: promoErr },
        { data: docsRows },
        { data: payoutRow },
      ] = await Promise.all([
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
              products_business_category,
              session_business_category,
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
              dimensions,
              brand_logo_url,
              policy_url,
              session_operating_hours
            `
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("promo_codes")
          .select(
            `
              id,
              vendor_id,
              code,
              description,
              discount_type,
              discount_value,
              active,
              starts_at,
              ends_at,
              max_redemptions,
              times_redeemed,
              scope,
              applies_to,
              created_at
            `
          )
          .eq("vendor_id", user.id)
          .eq("scope", "vendor")
          .order("created_at", { ascending: false }),
        supabase
          .from("vendor_docs")
          .select("id,vendor_id,kind,status")
          .eq("vendor_id", user.id),
        supabase
          .from("vendor_payout")
          .select("vendor_id,account_number,bank_holder_name")
          .eq("vendor_id", user.id)
          .maybeSingle(),
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
        products_business_category: [],
        session_business_category: [],
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
        dimensions: [],

        brand_logo_url: null,
        policy_url: null,

session_operating_hours: DEFAULT_SESSION_HOURS,
      };

      const merged: VendorBusiness = { ...defaults, ...(vbRow || {}) };

      setProfile(profTyped);
      setVb(merged);
      setBioCount(merged.shop_bio?.length || 0);
      setDimensions(merged.dimensions ?? []);

      setSessionHours(normalizeSessionHours(merged.session_operating_hours));

      // ✅ hydrate category states from DB
      setProductCategories(merged.products_business_category ?? []);
      setSessionCategories(merged.session_business_category ?? []);

      if (promoErr) {
        console.error(promoErr);
      } else if (promoRows) {
        setPromoCodes(promoRows as PromoCode[]);
      }

      setDocs((docsRows || []) as DocRow[]);
      setPayout((payoutRow || null) as PayoutLite | null);

      setLoading(false);
    })();
  }, []);

  /* --------------------- Google Places setup --------------------- */

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

  /* ------------------------- completeness ------------------------- */

  const completeness = useMemo(() => {
    if (!vb) {
      const missing = {
        logo: true,
        policy: true,
        certificates: true,
        payout: true,
      };
      const overallIncomplete = true;

      const navAlerts: Record<string, boolean> = {
        "/pages/setting/business?tab=business": missing.logo,
        "/pages/setting/business?tab=docs":
          missing.policy || missing.certificates,
        "/pages/setting/business?tab=verification": overallIncomplete,
        "/pages/setting/payouts?tab=payouts": missing.payout,
      };

      return { missing, overallIncomplete, navAlerts };
    }

    const hasLogo = !!vb.brand_logo_url;
    const hasPolicy = !!vb.policy_url;

    const hasAnyCert =
      docs.filter(
        (d) =>
          d.kind === "product_certificate" ||
          d.kind === "service_certificate"
      ).length > 0;

    const hasPayout =
  !!payout?.account_number || !!payout?.bank_holder_name;

    const missing = {
      logo: !hasLogo,
      policy: !hasPolicy,
      certificates: !hasAnyCert,
      payout: !hasPayout,
    };

    const overallIncomplete = Object.values(missing).some(Boolean);

    const navAlerts: Record<string, boolean> = {
      "/pages/setting/business?tab=business": missing.logo,
      "/pages/setting/business?tab=docs":
        missing.policy || missing.certificates,
      "/pages/setting/business?tab=verification": overallIncomplete,
      "/pages/setting/payouts?tab=payouts": missing.payout,
    };

    return { missing, overallIncomplete, navAlerts };
  }, [vb, docs, payout]);

  /* ------------------------- Sidebar config ------------------------- */

  const sidebarConfig = useMemo(() => {
    const statusLabel = profile?.status ? "active" : "Incomplete Registration";

    return buildSidebarConfig({
      fullName: profile?.full_name ?? profile?.email ?? "User",
      email: profile?.email ?? "",
      role: "Vendor",
      status: statusLabel,
    });
  }, [profile, completeness.overallIncomplete]);

  /* ------------------------- Save helpers --------------------------- */

  function buildPayload(src: VendorBusiness) {
    return {
      id: src.id,
      // general
      shop_status: src.shop_status,
      shop_name: (src.shop_name || "").trim(),
      shop_slug: (src.shop_slug || "").replace(/[^a-z0-9-]/gi, "").toLowerCase(),
      business_category: (src.business_category || "").trim(),

      // ✅ save arrays into the new columns
      products_business_category: productCategories.length
        ? productCategories
        : null,
      session_business_category: sessionCategories.length
        ? sessionCategories
        : null,

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

      // dimensions
      dimensions: dimensions.length ? dimensions : null,

      brand_logo_url: src.brand_logo_url,
      policy_url: src.policy_url,

session_operating_hours: sessionHours?.length
  ? sessionHours.map((d) => ({
      day: d.day,
      enabled: !!d.enabled,
      ranges: (d.ranges ?? []).map((r) => ({
        id: r.id ?? uuid(),
        start: r.start ?? "08:00",
        end: r.end ?? "22:00",
      })),
    }))
  : null,
  
      updated_at: new Date().toISOString(),
    };
  }

  async function save(tab: TabKey) {
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
      : tab === "fulfilment"
      ? "Failed to save fulfilment details."
      : tab === "sessions"
      ? "Failed to save session hours."
      : "Failed to save.",
});
    } else {
     successToast({
  title: "Success",
  description:
    tab === "general"
      ? "Shop settings saved."
      : tab === "fulfilment"
      ? "Fulfilment details saved successfully."
      : tab === "sessions"
      ? "Session hours saved successfully."
      : "Saved.",
});
    }
  }

  /* ---------------------- Promo helpers ---------------------- */

  function resetPromoForm() {
    setEditingPromoId(null);
    setPromoForm({
      code: "",
      description: "",
      discount_type: "percent",
      discount_value: "",
      active: true,
      starts_at: "",
      ends_at: "",
      max_redemptions: "",
      applies_to: DEFAULT_APPLIES_TO,
    });
    setPromoError(null);
  }

  function handleEditPromo(p: PromoCode) {
    setEditingPromoId(p.id);
    setPromoForm({
      code: p.code,
      description: p.description ?? "",
      discount_type: p.discount_type,
      discount_value: p.discount_value.toString(),
      active: p.active,
      starts_at: p.starts_at ? p.starts_at.slice(0, 16) : "",
      ends_at: p.ends_at ? p.ends_at.slice(0, 16) : "",
      max_redemptions: p.max_redemptions?.toString() ?? "",
      applies_to: p.applies_to ?? DEFAULT_APPLIES_TO,
    });
    setPromoError(null);
  }

  async function handleSavePromo(e: React.FormEvent) {
    e.preventDefault();
    if (!vb) return;

    setPromoError(null);

    const trimmedCode = promoForm.code.trim().toUpperCase();
    if (!trimmedCode) {
      setPromoError("Promo code cannot be empty.");
      return;
    }

    const discountNum = parseFloat(promoForm.discount_value || "0");
    if (!Number.isFinite(discountNum) || discountNum <= 0) {
      setPromoError("Enter a valid discount value.");
      return;
    }

    if (
      promoForm.discount_type === "percent" &&
      (discountNum <= 0 || discountNum > 100)
    ) {
      setPromoError("Percentage discounts must be between 0 and 100.");
      return;
    }

    const maxRedemptionsNum = promoForm.max_redemptions
      ? parseInt(promoForm.max_redemptions, 10)
      : null;

    const payload = {
      vendor_id: vb.id,
      code: trimmedCode,
      description: promoForm.description.trim() || null,
      discount_type: promoForm.discount_type,
      discount_value: discountNum,
      active: promoForm.active,
      starts_at: promoForm.starts_at
        ? new Date(promoForm.starts_at).toISOString()
        : null,
      ends_at: promoForm.ends_at
        ? new Date(promoForm.ends_at).toISOString()
        : null,
      max_redemptions: maxRedemptionsNum,
      scope: "vendor" as PromoScope,
      applies_to: promoForm.applies_to,
    };

    setPromoSaving(true);

    try {
      if (editingPromoId) {
        const { error } = await supabase
          .from("promo_codes")
          .update(payload)
          .eq("id", editingPromoId)
          .eq("vendor_id", vb.id);

        if (error) {
          console.error(error);
          setPromoError("Failed to update promo code.");
          return;
        }

        setPromoCodes((prev) =>
          prev.map((p) =>
            p.id === editingPromoId ? ({ ...p, ...payload } as PromoCode) : p
          )
        );
        successToast({
          title: "Promo updated",
          description: "Your promo code has been updated.",
        });
      } else {
        const { data, error } = await supabase
          .from("promo_codes")
          .insert(payload)
          .select(
            `
            id,
            vendor_id,
            code,
            description,
            discount_type,
            discount_value,
            active,
            starts_at,
            ends_at,
            max_redemptions,
            times_redeemed,
            scope,
            applies_to,
            created_at
          `
          )
          .maybeSingle();

        if (error) {
          console.error(error);
          setPromoError("Failed to create promo code.");
          return;
        }

        if (data) {
          setPromoCodes((prev) => [data as PromoCode, ...prev]);
        }
        successToast({
          title: "Promo created",
          description: "Your promo code has been created.",
        });
      }

      resetPromoForm();
    } finally {
      setPromoSaving(false);
    }
  }

  /* ------------------------- Loading state -------------------------- */

  if (loading || !vb || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <ClipLoader size={32} color="gray" />
      </div>
    );
  }

  /* ------------------------- Render -------------------------- */

  return (
    <>
      {/* Google Places script */}
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
        <SettingsNav alerts={completeness.navAlerts} />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-8 py-10 pb-32">
            <h1 className="text-[28px] font-semibold text-gray-900">Shop Settings</h1>

            {/* Tabs */}
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
                onClick={() => switchTab("promos")}
                className={[
                  "pb-3",
                  activeTab === "promos"
                    ? "border-b-2 border-gray-900 font-semibold text-gray-900"
                    : "text-gray-600 hover:text-gray-900",
                ].join(" ")}
              >
                Promo Codes
              </button>
                <button
                type="button"
                onClick={() => switchTab("sessions")}
                className={[
                  "pb-3",
                  activeTab === "sessions"
                    ? "border-b-2 border-gray-900 font-semibold text-gray-900"
                    : "text-gray-600 hover:text-gray-900",
                ].join(" ")}
              >
                Sessions
              </button>
            </div>

            {/* Verification banner */}
            {profile.status !== "active" && (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm text-white">
                <span className="inline-block h-2 w-2 rounded-full bg-purple-400" />
                You cannot publish products, list services, or receive payouts until your
                business is verified.
              </div>
            )}

            {/* GENERAL TAB */}
            {activeTab === "general" && (
              <form
                className="mt-8 space-y-12"
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

                {/* Shop Name */}
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

                {/* Shop Address */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Shop Address
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Paste the exact address from Google or search and select from
                      suggestions.
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
                                google_place_id: null,
                              }
                            : prev
                        )
                      }
                      onBlur={handleAddressBlur}
                      placeholder="Paste or type your full address"
                    />
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
                    {DIMENSIONS_ALL.map((d) => {
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

                  <div className="mt-8 border-t border-gray-200" />
                </section>

                {/* Primary Business Category (text) */}
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Primary Business Category
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Short label for your main category (optional if you use the
                      selectors below).
                    </p>
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

                {/* Business Categories (products + sessions) */}
                <section className="mt-4">
                  <div className="text-sm font-semibold text-gray-900">
                    Business Categories
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Select one or more categories that your store belongs to across
                    products, services, and experiences.
                  </p>

                  {/* Products -> products_business_category */}
                  <div className="mt-4">
                    <div className="mb-2 text-[11px] font-semibold text-gray-700">
                      Products
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {PRODUCT_CATEGORIES.map((cat) => {
                        const active = productCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() =>
                              toggleIn(productCategories, cat, setProductCategories)
                            }
                            className={clsx(
                              "flex w-full items-center justify-center rounded-xl border px-3 py-2 text-[11px] text-center transition",
                              active
                                ? "bg-[#EFEDFF] border-[#5B33FF] text-[#1B1529]"
                                : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
                            )}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Services -> session_business_category */}
                  <div className="mt-6">
                    <div className="mb-2 text-[11px] font-semibold text-gray-700">
                      Services
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {SERVICE_CATEGORIES.map((cat) => {
                        const active = sessionCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() =>
                              toggleIn(sessionCategories, cat, setSessionCategories)
                            }
                            className={clsx(
                              "flex w-full items-center justify-center rounded-xl border px-3 py-2 text-[11px] text-center transition",
                              active
                                ? "bg-[#EFEDFF] border-[#5B33FF] text-[#1B1529]"
                                : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
                            )}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Experiences -> session_business_category as well */}
                  <div className="mt-6">
                    <div className="mb-2 text-[11px] font-semibold text-gray-700">
                      Experiences
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {EXPERIENCE_CATEGORIES.map((cat) => {
                        const active = sessionCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() =>
                              toggleIn(sessionCategories, cat, setSessionCategories)
                            }
                            className={clsx(
                              "flex w-full items-center justify-center rounded-xl border px-3 py-2 text-[11px] text-center transition",
                              active
                                ? "bg-[#EFEDFF] border-[#5B33FF] text-[#1B1529]"
                                : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
                            )}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-8 border-t border-gray-200" />
                </section>

                {/* Shop Description / Bio */}
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

                {/* Business Tags */}
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

                {/* Frame & Commission */}
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
                <div className="mt-10 flex justify-end">
                  <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
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
              </form>
            )}

            {/* FULFILMENT TAB */}
            {activeTab === "fulfilment" && (
              <form
                className="mt-8 space-y-12"
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
                <div className="mt-10 flex justify-end">
                  <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
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
              </form>
            )}

            {/* PROMO CODES TAB */}
            {activeTab === "promos" && (
              <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_minmax(0,1fr)]">
                {/* Left: list */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-900">
                      Existing promo codes
                    </h2>
                    <button
                      type="button"
                      onClick={resetPromoForm}
                      className="text-xs text-purple-600 hover:underline"
                    >
                      + New promo
                    </button>
                  </div>

                  {promoCodes.length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-xs text-gray-500">
                      No promo codes yet. Create your first promo on the right.
                    </div>
                  )}

                  {promoCodes.length > 0 && (
                    <div className="space-y-2">
                      {promoCodes.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleEditPromo(p)}
                          className={clsx(
                            "w-full rounded-xl border px-4 py-3 text-left text-xs transition hover:bg-gray-50",
                            editingPromoId === p.id
                              ? "border-purple-500 bg-purple-50"
                              : "border-gray-200 bg-white"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] font-semibold text-gray-900">
                              {p.code}
                            </span>
                            <span
                              className={clsx(
                                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                p.active
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-200 text-gray-700"
                              )}
                            >
                              {p.active ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-gray-600">
                            {p.description || "No description"}
                          </p>
                          <p className="mt-1 text-[11px] text-gray-500">
                            {p.discount_type === "percent"
                              ? `${p.discount_value}% off`
                              : `SGD ${p.discount_value.toFixed(2)} off`}{" "}
                            · Applies to:{" "}
                            {p.applies_to === "all"
                              ? "All orders"
                              : p.applies_to === "products"
                              ? "Products"
                              : "Services"}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/* Right: form */}
                <section className="rounded-2xl border border-gray-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {editingPromoId ? "Edit promo code" : "Create promo code"}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Define discount, scope, validity dates and redemption limits.
                  </p>

                  {promoError && (
                    <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">
                      {promoError}
                    </div>
                  )}

                  <form className="mt-4 space-y-4" onSubmit={handleSavePromo}>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-800">
                        Code
                      </label>
                      <input
                        className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                        value={promoForm.code}
                        onChange={(e) =>
                          setPromoForm((prev) => ({
                            ...prev,
                            code: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="WELCOME10"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-800">
                        Description
                      </label>
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                        value={promoForm.description}
                        onChange={(e) =>
                          setPromoForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Short internal note / customer-facing description"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-800">
                          Discount type
                        </label>
                        <select
                          className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                          value={promoForm.discount_type}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              discount_type: e.target.value as DiscountType,
                            }))
                          }
                        >
                          <option value="percent">Percentage (%)</option>
                          <option value="fixed">Fixed amount (SGD)</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-800">
                          Discount value
                        </label>
                        <input
                          className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                          value={promoForm.discount_value}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              discount_value: e.target.value,
                            }))
                          }
                          placeholder={
                            promoForm.discount_type === "percent"
                              ? "e.g. 10 (for 10%)"
                              : "e.g. 10 (for $10 off)"
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-800">
                        Applies to
                      </label>
                      <select
                        className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                        value={promoForm.applies_to}
                        onChange={(e) =>
                          setPromoForm((prev) => ({
                            ...prev,
                            applies_to: e.target.value as PromoAppliesTo,
                          }))
                        }
                      >
                        <option value="all">All products &amp; services</option>
                        <option value="products">Products only</option>
                        <option value="services">Services only</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-800">
                          Starts at
                        </label>
                        <input
                          type="datetime-local"
                          className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                          value={promoForm.starts_at}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              starts_at: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-800">
                          Ends at
                        </label>
                        <input
                          type="datetime-local"
                          className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                          value={promoForm.ends_at}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              ends_at: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 items-center">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-800">
                          Max redemptions (optional)
                        </label>
                        <input
                          className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                          value={promoForm.max_redemptions}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              max_redemptions: e.target.value,
                            }))
                          }
                          placeholder="e.g. 50"
                        />
                      </div>
                      <label className="mt-4 flex items-center gap-2 text-xs text-gray-800">
                        <input
                          type="checkbox"
                          checked={promoForm.active}
                          onChange={(e) =>
                            setPromoForm((prev) => ({
                              ...prev,
                              active: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        Active
                      </label>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-3">
                      {editingPromoId && (
                        <button
                          type="button"
                          onClick={resetPromoForm}
                          className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          Cancel edit
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={promoSaving}
                        className="rounded-full bg-black px-6 py-2 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-60"
                      >
                        {promoSaving
                          ? "Saving…"
                          : editingPromoId
                          ? "Save changes"
                          : "Create promo"}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}

            {/* SESSIONS TAB */}
{activeTab === "sessions" && (
  <form
    className="mt-8 space-y-8"
    onSubmit={(e) => {
      e.preventDefault();
      // Prevent saving if invalid
      if (sessionHoursErrors.length > 0) return;
      save("sessions");
    }}
  >
    {/* ✅ FULL-WIDTH layout: heading on top, cards use all space */}
    <section className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-gray-900">
          Session Operating Hours
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Select which days you run sessions and add multiple time ranges to omit breaks
          (e.g. 10:00–12:00 and 14:00–17:00).
        </p>
      </div>

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        {sessionHours.map((row, idx) => {
          const ranges = row.ranges ?? []; // ✅ avoid undefined.map crash

          return (
            <div
              key={row.day}
              className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;

                      setSessionHours((prev) =>
                        prev.map((r, i) => {
                          if (i !== idx) return r;

                          const safeRanges = r.ranges ?? [];

                          // If enabling and there are no ranges, add one
                          if (enabled && safeRanges.length === 0) {
                            return {
                              ...r,
                              enabled: true,
                              ranges: [{ id: uuid(), start: "10:00", end: "12:00" }],
                            };
                          }

                          // If disabling, keep ranges but mark disabled (or wipe if you prefer)
                          return {
                            ...r,
                            enabled,
                            ranges: safeRanges,
                          };
                        })
                      );
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />

                  <div className="text-sm font-medium text-gray-900">
                    {row.day}
                  </div>

                  {!row.enabled && (
                    <span className="text-[11px] text-gray-500">(Closed)</span>
                  )}
                </div>

                {row.enabled && (
                  <button
                    type="button"
                    onClick={() =>
                      setSessionHours((prev) =>
                        prev.map((r, i) => {
                          if (i !== idx) return r;
                          const safeRanges = r.ranges ?? [];
                          return {
                            ...r,
                            ranges: [
                              ...safeRanges,
                              { id: uuid(), start: "14:00", end: "17:00" },
                            ],
                          };
                        })
                      )
                    }
                    className="rounded-full bg-black px-3 py-1.5 text-[11px] font-semibold text-white"
                  >
                    + Add time range
                  </button>
                )}
              </div>

              {/* Ranges */}
              {row.enabled && (
                <div className="space-y-2">
                  {(ranges ?? []).map((range) => (
                    <div
                      key={range.id}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2"
                    >
                      <input
                        type="time"
                        value={range.start}
                        onChange={(e) => {
                          const start = e.target.value;

                          setSessionHours((prev) =>
                            prev.map((r, i) => {
                              if (i !== idx) return r;
                              const safeRanges = r.ranges ?? [];
                              return {
                                ...r,
                                ranges: safeRanges.map((x) =>
                                  x.id === range.id ? { ...x, start } : x
                                ),
                              };
                            })
                          );
                        }}
                        className="h-9 w-28 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900"
                      />

                      <span className="text-xs text-gray-500">to</span>

                      <input
                        type="time"
                        value={range.end}
                        onChange={(e) => {
                          const end = e.target.value;

                          setSessionHours((prev) =>
                            prev.map((r, i) => {
                              if (i !== idx) return r;
                              const safeRanges = r.ranges ?? [];
                              return {
                                ...r,
                                ranges: safeRanges.map((x) =>
                                  x.id === range.id ? { ...x, end } : x
                                ),
                              };
                            })
                          );
                        }}
                        className="h-9 w-28 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setSessionHours((prev) =>
                            prev.map((r, i) => {
                              if (i !== idx) return r;

                              const safeRanges = r.ranges ?? [];
                              const nextRanges = safeRanges.filter(
                                (x) => x.id !== range.id
                              );

                              // if removing last range, auto-close
                              return {
                                ...r,
                                ranges: nextRanges,
                                enabled: nextRanges.length > 0 ? r.enabled : false,
                              };
                            })
                          )
                        }
                        className="h-9 rounded-full border border-gray-300 px-3 text-xs text-gray-500"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {/* Inline day-specific errors */}
                  {sessionHoursErrorsByDay[row.day]?.length > 0 && (
                    <div className="rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">
                      {sessionHoursErrorsByDay[row.day].map((msg) => (
                        <div key={msg}>• {msg}</div>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-gray-500">
                    Tip: add multiple ranges to omit breaks (e.g. 10:00–12:00 and
                    14:00–17:00).
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>

    {/* Save bar */}
    <div className="mt-10 flex justify-end">
      <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
        <a
          href="/pages/setting/shop"
          className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Go back without saving
        </a>

        <button
          type="submit"
          disabled={saving || sessionHoursErrors.length > 0}
          className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
        >
          {saving ? "Saving…" : sessionHoursErrors.length > 0 ? "Fix errors to Save" : "Save"}
        </button>
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
          <ClipLoader size={32} color="gray" />
        </div>
      }
    >
      <ShopSettingsPageInner />
    </Suspense>
  );
}
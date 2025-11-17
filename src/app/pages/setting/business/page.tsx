// app/pages/setting/business/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";
import { useToast } from "../../../../components/toast/ToastProvider";

/* ---------- Types ---------- */

type UserStatus =
  | "pending_admin_approval"
  | "approved"
  | "active"
  | "rejected"
  | "suspended";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

type Business = {
  id: string; // auth.users.id
  brand_logo_url: string | null;
  brand_name: string;
  company_name: string;
  uen: string;
  incorporation_year: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  policy_url: string | null;
};

type BrandDoc = {
  id: string;
  short_story: string;
  dimensions: string[];
  offerings: string[];
  platforms: string[];
  motivations: string[];
  interests: string[];
};

type DocKind =
  | "vendor_agreement"
  | "uen_acra"
  | "product_certificate"
  | "service_certificate";

type DocRow = {
  id: string;
  vendor_id: string;
  kind: DocKind;
  file_name: string;
  storage_key: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  uploaded_at: string;
};

type Payout = {
  vendor_id: string;
  stripe_account_id?: string | null;
  bank_holder_name?: string | null;
};

type Tab = "business" | "brand" | "docs" | "verification";

/* ---------- Constants ---------- */

const STORY_LIMIT = 200;

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

const OFFERINGS = [
  "Products",
  "Professional Services",
  "Events",
  "Digital Solutions",
  "Content Creation",
  "Other",
];

const PLATFORMS = ["Shopee", "Lazada", "Amazon", "Klook", "ClassPass", "Fave", "Others"];

const MOTIVATIONS = [
  "Increase visibility and brand exposure",
  "Reach targeted wellness consumers",
  "Engage in gamified marketing and interactive features",
  "Expand my business through new channels",
  "Participate in events and wellness festivals",
  "Participate in corporate engagements",
  "Connect & collaborate with like-minded wellness brands",
  "Participate in exclusive vendor events and promotions",
  "Others",
];

const INTERESTS = [
  "Wellness events and festivals",
  "Corporate engagements",
  "Collaborative events with other vendors",
  "In-app promotions or advertisements",
  "Workshops and webinars",
  "Social media or influencer partnerships",
  "Others",
];

const DOCS_BUCKET = "vendor-docs";
const AGREEMENT_TEMPLATE_URL = "/docs/vendor-agreement-template.pdf";

/* ---------- Small helpers ---------- */

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function Pill({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition",
        selected
          ? "border-purple-600 bg-purple-50 text-purple-700"
          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      )}
    >
      {label}
    </button>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-gray-800">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/* ---------- Docs chip bits ---------- */

const StatusBadge = ({ s }: { s: DocRow["status"] }) => {
  const map = {
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  } as const;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${map[s]}`}>
      {s}
    </span>
  );
};

function FileChip({
  row,
  onOpen,
  onDelete,
}: {
  row: DocRow;
  onOpen: (storageKey: string) => void;
  onDelete: (row: DocRow) => void;
}) {
  const deletable = row.status === "pending";
  return (
    <div className="group flex w-full items-center gap-2 rounded-xl bg-[#EFEAFE]/60 px-3 py-2 ring-1 ring-[#D9D0FF] hover:bg-[#EFEAFE]">
      <button type="button" onClick={() => onOpen(row.storage_key)}>
        <span
          className="max-w-[22ch] truncate text-[13px] font-medium text-[#4C3AD8] underline-offset-2 hover:underline"
          title="Open file"
        >
          {row.file_name}
        </span>
      </button>

      <StatusBadge s={row.status} />

      {row.status === "rejected" && row.rejection_reason && (
        <span className="truncate text-xs text-rose-600" title={row.rejection_reason}>
          Reason: {row.rejection_reason}
        </span>
      )}

      <span className="ml-auto whitespace-nowrap text-[11px] text-gray-400">
        {new Date(row.uploaded_at).toLocaleString()}
      </span>

      <button
        type="button"
        onClick={() => (deletable ? onDelete(row) : undefined)}
        className={cn(
          "ml-1 inline-grid h-6 w-6 place-items-center rounded-full border transition",
          deletable
            ? "border-gray-300 text-gray-700 hover:bg-gray-50"
            : "cursor-not-allowed border-gray-200 text-gray-300"
        )}
        title={deletable ? "Delete file" : "Cannot delete (not pending)"}
        disabled={!deletable}
      >
        ×
      </button>
    </div>
  );
}

/* ======================================================================= */
/*                               MAIN PAGE                                 */
/* ======================================================================= */

export default function BusinessSettingsPage() {
    const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // business info
  const [biz, setBiz] = useState<Business | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [savingBusiness, setSavingBusiness] = useState(false);

  // brand story
  const [savingBrand, setSavingBrand] = useState(false);
  const [shortStory, setShortStory] = useState("");
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [offerings, setOfferings] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [motivations, setMotivations] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  // docs
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [uploadingKind, setUploadingKind] = useState<DocKind | null>(null);
  const [savingPolicyUrl, setSavingPolicyUrl] = useState(false);

  // payouts for verification
  const [payout, setPayout] = useState<Payout | null>(null);

  const urlTab = (searchParams.get("tab") as Tab) || "business";
  const [activeTab, setActiveTab] = useState<Tab>(urlTab);

  // keep local state in sync when URL changes
  useEffect(() => {
    const next = (searchParams.get("tab") as Tab) || "business";
    setActiveTab(next);
  }, [searchParams]);

  function switchTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  }
  const { successToast, errorToast } = useToast();

  /* ---------- Load everything once ---------- */
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
        { data: bizRow },
        { data: brandRow },
        { data: docsRows },
        { data: payoutRow },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,status,onboarding_completed,full_name")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("vendor_business")
          .select(
            "id,brand_logo_url,brand_name,company_name,uen,incorporation_year,instagram,facebook,tiktok,policy_url"
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("vendor_brand").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("vendor_docs")
          .select("*")
          .eq("vendor_id", user.id)
          .order("uploaded_at", { ascending: false }),
        supabase.from("vendor_payout").select("*").eq("vendor_id", user.id).maybeSingle(),
      ]);

      // profile
      setProfile(
        (prof as Profile) ?? {
          id: user.id,
          email: user.email ?? "",
          status: "active",
          onboarding_completed: false,
          full_name: user.email ?? "User",
        }
      );

      // business
      setBiz(
        (bizRow as Business) ?? {
          id: user.id,
          brand_logo_url: null,
          brand_name: "",
          company_name: "",
          uen: "",
          incorporation_year: "",
          instagram: "",
          facebook: "",
          tiktok: "",
          policy_url: "",
        }
      );

      // brand
      if (brandRow) {
        const d = brandRow as BrandDoc;
        setShortStory(d.short_story ?? "");
        setDimensions(d.dimensions ?? []);
        setOfferings(d.offerings ?? []);
        setPlatforms(d.platforms ?? []);
        setMotivations(d.motivations ?? []);
        setInterests(d.interests ?? []);
      }

      setDocs((docsRows || []) as DocRow[]);
      setPayout((payoutRow || null) as Payout | null);

      setLoading(false);
    })();
  }, []);

  /* ---------- Sidebar config ---------- */

  const completeness = useMemo(() => {
    if (!biz) {
      return {
        missing: { logo: true, policy: true, certificates: true, payout: true },
        overallIncomplete: true,
        navAlerts: {} as Record<string, boolean>,
      };
    }

    const hasLogo = !!biz.brand_logo_url;
    const hasPolicy = !!biz.policy_url;

    const hasAnyCert =
      docs.filter(
        (d) => d.kind === "product_certificate" || d.kind === "service_certificate"
      ).length > 0;

    const hasPayout =
      !!payout?.stripe_account_id || !!payout?.bank_holder_name;

    const missing = {
      logo: !hasLogo,
      policy: !hasPolicy,
      certificates: !hasAnyCert,
      payout: !hasPayout,
    };

    const overallIncomplete = Object.values(missing).some(Boolean);

    const navAlerts = {
      "/pages/setting/business": overallIncomplete, // entire business settings
      "/pages/setting/payouts": missing.payout,
    };

    return { missing, overallIncomplete, navAlerts };
  }, [biz, docs, payout]);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name,
        email: profile?.email,
        role: "Vendor",
        status: completeness.overallIncomplete ? "Incomplete Registration" : "Active",
      }),
    [profile, completeness.overallIncomplete]
  );

  /* ---------- Business: upload logo & save ---------- */

  async function handleUploadLogo(file: File) {
  if (!biz) return;
  const ext = file.name.split(".").pop() || "png";
  const path = `logos/${biz.id}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("brand-assets")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (upErr) {
    errorToast({ title: "Error", description: `Upload failed: ${upErr.message}` });
    return;
  }

  const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
  const url = data?.publicUrl ?? null;
  setBiz({ ...biz, brand_logo_url: url });
}

  async function saveBusiness() {
    if (!biz) return;
    setSavingBusiness(true);

    const { error } = await supabase.from("vendor_business").upsert(
      {
        id: biz.id,
        brand_logo_url: biz.brand_logo_url,
        brand_name: biz.brand_name,
        company_name: biz.company_name,
        uen: biz.uen,
        incorporation_year: biz.incorporation_year,
        instagram: biz.instagram,
        facebook: biz.facebook,
        tiktok: biz.tiktok,
        policy_url: biz.policy_url,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    setSavingBusiness(false);
    if (error) {
      errorToast({ title: "Error", description: `Error saving: ${error.message}` });
    } else {
      successToast({ title: "Success", description: "Business information saved." });
    }
  }

  /* ---------- Brand: save ---------- */

  const toggleIn = (arr: string[], value: string, setArr: (next: string[]) => void) => {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  async function saveBrand() {
    if (!profile?.id) return;
    setSavingBrand(true);

    const payload: BrandDoc = {
      id: profile.id,
      short_story: shortStory.trim(),
      dimensions,
      offerings,
      platforms,
      motivations,
      interests,
    };

    const { error } = await supabase
      .from("vendor_brand")
      .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: "id" });

    setSavingBrand(false);
    if (error) {
      errorToast({ title: "Error", description: `Save failed: ${error.message}` });
    } else {
      successToast({ title: "Success", description: "Brand story saved." });
    }
  }

  /* ---------- Docs: upload / delete / open / save policy ---------- */

  const listDocsFor = (k: DocKind) => docs.filter((d) => d.kind === k);

  async function uploadDoc(kind: DocKind, file: File) {
    if (!profile?.id) return;
    setUploadingKind(kind);
    try {
      const objectPath = `${profile.id}/${kind}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from(DOCS_BUCKET)
        .upload(objectPath, file, { cacheControl: "0", upsert: false });
      if (upErr) throw upErr;

      const { data: inserted, error: insErr } = await supabase
        .from("vendor_docs")
        .insert({
          vendor_id: profile.id,
          kind,
          file_name: file.name,
          storage_key: `${DOCS_BUCKET}/${objectPath}`,
          status: "pending",
          rejection_reason: null,
        })
        .select("*")
        .single();
      if (insErr) throw insErr;

      setDocs((prev) => [inserted as DocRow, ...prev]);
    } catch (e: any) {
      errorToast({ title: "Error", description: `Upload failed: ${e.message}` });
    } finally {
      setUploadingKind(null);
    }
  }

  async function removeDoc(row: DocRow) {
    if (row.status !== "pending") return;
    if (!confirm("Delete this pending file?")) return;

    const objectPath = row.storage_key.replace(`${DOCS_BUCKET}/`, "");
    const { error: stErr } = await supabase.storage.from(DOCS_BUCKET).remove([objectPath]);
    if (stErr) {
      errorToast({ title: "Error", description: stErr.message });
      return;
    }

    const { error: dbErr } = await supabase.from("vendor_docs").delete().eq("id", row.id);
    if (dbErr) {
      errorToast({ title: "Error", description: dbErr.message });
      return;
    }

    setDocs((xs) => xs.filter((d) => d.id !== row.id));
  }

  async function openSigned(storageKey: string) {
    const path = storageKey.replace(`${DOCS_BUCKET}/`, "");
    const { data, error } = await supabase.storage
      .from(DOCS_BUCKET)
      .createSignedUrl(path, 600);
    if (error) {
      errorToast({ title: "Error", description: error.message });
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function savePolicyUrlOnly() {
    if (!biz) return;
    setSavingPolicyUrl(true);
    const { error } = await supabase
      .from("vendor_business")
      .update({ policy_url: biz.policy_url, updated_at: new Date().toISOString() })
      .eq("id", biz.id);

    setSavingPolicyUrl(false);
    if (error) errorToast({ title: "Error", description: error.message });
    else successToast({ title: "Success", description: "Policy link saved." });
  }

  /* ---------- Tab UIs ---------- */

function renderTabsHeader() {
  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}      // ⬅️ CHANGE THIS
      className={cn(
        "pb-3 text-sm",
        activeTab === id
          ? "border-b-2 border-gray-900 font-semibold text-gray-900"
          : "text-gray-500 hover:text-gray-900"
      )}
    >
      {label}
    </button>
  );

    return (
      <div className="mt-6 flex gap-8 border-b border-gray-200">
        <TabBtn id="business" label="Business Information" />
        <TabBtn id="brand" label="Brand Story & Offerings" />
        <TabBtn id="docs" label="Documents & Agreements" />
        <TabBtn id="verification" label="Verification Status" />
      </div>
    );
  }

  function renderBusinessTab() {
    if (!biz) return null;
    return (
      <>
        {/* Verification banner */}
        <div className="mt-6 rounded-xl border border-black/10 bg-black text-white px-4 py-3 text-sm shadow-sm">
          <span className="font-medium">
            You cannot publish products, list services, or receive payouts
          </span>{" "}
          until your business is verified.
        </div>

        {/* FORM */}
        <form
          className="mt-8 space-y-12 pb-28"
          onSubmit={(e) => {
            e.preventDefault();
            saveBusiness();
          }}
        >
          {/* Brand Logo */}
          <section>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Brand Logo</div>
                <p className="mt-1 text-xs text-gray-500">
                  Upload your official brand logo. Displayed on your MEURAKI storefront and
                  subscriber panel.
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  Recommended size – 1:1 square, 500×500px.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-gray-100">
                  {biz.brand_logo_url ? (
                    <Image
                      src={biz.brand_logo_url}
                      alt="Brand logo"
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">No Logo</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadLogo(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
                  >
                    Upload Logo
                  </button>
                  {biz.brand_logo_url && (
                    <button
                      type="button"
                      onClick={() => setBiz({ ...biz, brand_logo_url: null })}
                      className="rounded-full border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-8 border-t border-gray-200" />
          </section>

          {/* Brand / Company names */}
          <section>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Business / Brand Name</div>
                <p className="mt-1 text-xs text-gray-500">
                  Displayed across the marketplace and on your MEURAKI vendor listings.
                </p>
              </div>
              <div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                  placeholder="e.g. Wellness Club Co."
                  value={biz.brand_name}
                  onChange={(e) => setBiz({ ...biz, brand_name: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Registered Company Name
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Legal name displayed on your ACRA or government registration. Used for
                  verification and payouts.
                </p>
              </div>
              <div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                  placeholder="e.g. WellnessClub PTE LTD."
                  value={biz.company_name}
                  onChange={(e) => setBiz({ ...biz, company_name: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  UEN / Business Registration No.
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Official registration number for your company or business.
                </p>
              </div>
              <div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                  placeholder="e.g. 202302893X"
                  value={biz.uen}
                  onChange={(e) => setBiz({ ...biz, uen: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Year of Incorporation
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Year your business was officially established. Required for verification.
                </p>
              </div>
              <div>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                  placeholder="e.g. 2024"
                  value={biz.incorporation_year}
                  onChange={(e) =>
                    setBiz({ ...biz, incorporation_year: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="mt-8 border-t border-gray-200" />
          </section>

          {/* Social Links */}
          <section>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">Social Media Links</div>
                <p className="mt-1 text-xs text-gray-500">
                  Provide your business’s social media pages.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Instagram</label>
                  <input
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="https://www.instagram.com/yourbrand"
                    value={biz.instagram}
                    onChange={(e) => setBiz({ ...biz, instagram: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Facebook</label>
                  <input
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="https://www.facebook.com/yourbrand"
                    value={biz.facebook}
                    onChange={(e) => setBiz({ ...biz, facebook: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Tiktok</label>
                  <input
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="https://www.tiktok.com/@yourbrand"
                    value={biz.tiktok}
                    onChange={(e) => setBiz({ ...biz, tiktok: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-gray-200" />
          </section>
        </form>
      </>
    );
  }

  function renderBrandTab() {
    return (
      <>
        {/* Short Story */}
        <section className="mt-8">
          <div className="text-sm font-semibold text-gray-900">
            Short Description of Your Brand Story
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Write a short story (max {STORY_LIMIT} characters) describing your brand’s
            journey or mission.
          </p>
          <div className="mt-3 rounded-xl border border-gray-200 bg-white">
            <textarea
              value={shortStory}
              onChange={(e) => setShortStory(e.target.value.slice(0, STORY_LIMIT))}
              rows={4}
              className="w-full resize-none rounded-xl bg-transparent px-4 py-3 text-gray-900 outline-none"
              placeholder="Write a short story here"
            />
            <div className="flex items-center justify-end px-4 pb-3 text-xs text-gray-400">
              {shortStory.length}/{STORY_LIMIT}
            </div>
          </div>
          <div className="mt-8 border-t border-gray-200" />
        </section>

        {/* Wellness Dimensions */}
        <section className="mt-8">
          <div className="text-sm font-semibold text-gray-900">
            Select Your Wellness Dimensions
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Choose one or more dimensions that best represent your brand focus.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DIMENSIONS.map((d) => (
              <Pill
                key={d}
                label={d}
                selected={dimensions.includes(d)}
                onToggle={() => toggleIn(dimensions, d, setDimensions)}
              />
            ))}
          </div>
          <div className="mt-8 border-t border-gray-200" />
        </section>

        {/* Offerings */}
        <section className="mt-8">
          <div className="text-sm font-semibold text-gray-900">
            What Offerings Do You Provide?
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Select the type(s) of offerings your brand provides.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {OFFERINGS.map((o) => (
              <div key={o} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <CheckboxRow
                  label={o}
                  checked={offerings.includes(o)}
                  onChange={() => toggleIn(offerings, o, setOfferings)}
                />
              </div>
            ))}
          </div>
          <div className="mt-8 border-t border-gray-200" />
        </section>

        {/* Other Platforms */}
        <section className="mt-8">
          <div className="text-sm font-semibold text-gray-900">
            Any other participating platforms?
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Click to select/deselect. You can choose multiple platforms (if applicable).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <Pill
                key={p}
                label={p}
                selected={platforms.includes(p)}
                onToggle={() => toggleIn(platforms, p, setPlatforms)}
              />
            ))}
          </div>
          <div className="mt-8 border-t border-gray-200" />
        </section>

        {/* Motivations */}
        <section className="mt-8">
          <div className="text-sm font-semibold text-gray-900">
            Motivation for Joining MEURAKI and Our Community
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Select your main reasons for joining (e.g. visibility, growth, community,
            partnerships).
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {MOTIVATIONS.map((m) => (
              <div key={m} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <CheckboxRow
                  label={m}
                  checked={motivations.includes(m)}
                  onChange={() => toggleIn(motivations, m, setMotivations)}
                />
              </div>
            ))}
          </div>
          <div className="mt-8 border-t border-gray-200" />
        </section>

        {/* Interests */}
        <section className="mt-8">
          <div className="text-sm font-semibold text-gray-900">
            Interest in Participating in the Following Events / Promotions
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Indicate interest in events or collaborations.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {INTERESTS.map((i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                <CheckboxRow
                  label={i}
                  checked={interests.includes(i)}
                  onChange={() => toggleIn(interests, i, setInterests)}
                />
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  function DocsSection({
    title,
    hint,
    kind,
    accept = ".pdf",
    templateUrl,
    multi = false,
  }: {
    title: string;
    hint: string;
    kind: DocKind;
    accept?: string;
    templateUrl?: string;
    multi?: boolean;
  }) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [picked, setPicked] = useState("No file chosen");
    const pick = () => inputRef.current?.click();

    async function onPicked(files: FileList | null) {
      if (!files || !files.length) return;
      setPicked(files.length === 1 ? files[0].name : `${files.length} files selected`);
      for (const f of Array.from(files)) await uploadDoc(kind, f);
      if (inputRef.current) inputRef.current.value = "";
    }

    const items = listDocsFor(kind);

    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
            <p className="text-[13px] text-gray-500">{hint}</p>
          </div>

          {templateUrl && (
            <a
              href={templateUrl}
              target="_blank"
              className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              Download &amp; Sign
            </a>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-12">
          <div className="sm:col-span-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-[12px] text-gray-600">
              Allowed: PDF/JPG/PNG (max ~10MB). Files appear on the right with their review
              status.
            </div>
          </div>

          <div className="sm:col-span-8">
            {items.length ? (
              <ul className="space-y-2">
                {items.map((r) => (
                  <li key={r.id} className="flex">
                    <FileChip row={r} onOpen={openSigned} onDelete={removeDoc} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                No file uploaded yet.
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={accept}
                multiple={!!multi}
                onChange={(e) => onPicked(e.target.files)}
              />

              <button
                type="button"
                onClick={pick}
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
              >
                {uploadingKind === kind ? "Uploading…" : "Upload File"}
              </button>

              <span className="text-sm text-gray-500">{picked}</span>

              {multi && (
                <button
                  type="button"
                  onClick={pick}
                  className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  title="Add more files"
                >
                  +
                </button>
              )}
            </div>

            <p className="mt-2 text-[12px] text-gray-500">
              {multi
                ? "Upload PDF/JPG/PNG’s — you can add multiple certificates."
                : "Upload a single PDF/JPG/PNG file."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  function renderDocsTab() {
    if (!biz) return null;
    return (
      <>
        <div className="mt-8 space-y-8 pb-28">
          <DocsSection
            title="Vendor Agreement (Download → Sign → Upload)"
            hint="Upload the signed PDF of the vendor agreement."
            kind="vendor_agreement"
            accept=".pdf"
            templateUrl={AGREEMENT_TEMPLATE_URL}
          />

          <DocsSection
            title="Business Registration (UEN / ACRA)"
            hint="Upload the official document showing your UEN / business registration."
            kind="uen_acra"
            accept=".pdf,.jpg,.jpeg,.png"
          />

          <DocsSection
            title="Upload Product Certificates"
            hint="Upload any licenses, safety/compliance docs, or qualifications relevant to your listings."
            kind="product_certificate"
            accept=".pdf,.jpg,.jpeg,.png"
            multi
          />

          <DocsSection
            title="Upload Service Certificates"
            hint="Upload any licenses, safety/compliance docs, or qualifications relevant to your services."
            kind="service_certificate"
            accept=".pdf,.jpg,.jpeg,.png"
            multi
          />

          {/* Policy URL */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-[15px] font-semibold text-gray-900">
              Rescheduling / Cancellation / Returns / Refund Policy
            </h3>
            <p className="mt-1 text-[13px] text-gray-500">
              Add a link to your business policy page (e.g., https://brand.com/policy).
            </p>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                placeholder="https://yourbrand.com/policy"
                className="h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                value={biz.policy_url ?? ""}
                onChange={(e) => setBiz({ ...biz, policy_url: e.target.value })}
              />
              <button
                onClick={savePolicyUrlOnly}
                disabled={savingPolicyUrl}
                className="h-11 rounded-full bg-black px-6 text-white hover:bg-gray-900 disabled:opacity-60"
              >
                {savingPolicyUrl ? "Saving…" : "Save"}
              </button>
            </div>
          </section>
        </div>
      </>
    );
  }

  function VerificationRow({
    label,
    missing,
    href,
    cta,
  }: {
    label: string;
    missing: boolean;
    href: string;
    cta: string;
  }) {
    return (
      <div className="flex items-center gap-4 px-5 py-4">
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            missing ? "bg-rose-500" : "bg-emerald-500"
          )}
        />
        <div className="flex-1 text-sm text-gray-900">{label}</div>
        <Link
          href={href}
          className="text-sm font-medium text-gray-700 underline-offset-2 hover:underline"
        >
          {cta}
        </Link>
      </div>
    );
  }

  function renderVerificationTab() {
    return (
      <>
        <div className="mt-8">
          {/* Account status card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-semibold text-gray-900">Account Status</div>
              {completeness.overallIncomplete ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                  ● Incomplete Registration
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  ● Complete
                </span>
              )}
            </div>

            {completeness.overallIncomplete && (
              <div className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
                Some required details are missing
              </div>
            )}
          </div>

          {/* Missing checklist */}
          <div className="mt-6 divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <VerificationRow
              label="Business Logo"
              missing={completeness.missing.logo}
              href="/pages/setting/business?tab=business"
              cta="Go to Business Information"
            />
            <VerificationRow
              label="Refund Policy link"
              missing={completeness.missing.policy}
              href="/pages/setting/business?tab=docs"
              cta="Go to Documents & Agreements"
            />
            <VerificationRow
              label="Upload Business Certificates"
              missing={completeness.missing.certificates}
              href="/pages/setting/business?tab=docs"
              cta="Go to Business Settings"
            />
            <VerificationRow
              label="Payout Details"
              missing={completeness.missing.payout}
              href="/pages/setting/payouts"
              cta="Go to Payout Details"
            />
          </div>
        </div>
      </>
    );
  }

  /* ---------- Sticky footer per tab ---------- */

  function renderFooter() {
    if (activeTab === "verification") return null;

    let onPrimaryClick: () => void;
    let primaryLabel: string;
    let primaryDisabled: boolean;

    if (activeTab === "business") {
      onPrimaryClick = saveBusiness;
      primaryLabel = savingBusiness ? "Saving…" : "Save";
      primaryDisabled = savingBusiness;
    } else if (activeTab === "brand") {
      onPrimaryClick = saveBrand;
      primaryLabel = savingBrand ? "Saving…" : "Save";
      primaryDisabled = savingBrand;
    } else {
      onPrimaryClick = savePolicyUrlOnly;
      primaryLabel = savingPolicyUrl ? "Saving…" : "Save";
      primaryDisabled = savingPolicyUrl;
    }

    return (
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <p className="text-gray-600">Loading shop settings…</p>
        </div>
      }>
      <div className="fixed bottom-0 left-0 right-0 z-10 ml-[calc(300px+280px)] bg-white/85 backdrop-blur border-t border-gray-200">
        <div className="mx-auto max-w-5xl px-8 py-4 flex items-center gap-3">
          <button
            type="button"
            className="rounded-full border border-gray-300 px-5 py-2.5 text-sm hover:bg-gray-50"
            onClick={() => window.history.back()}
          >
            Go back without saving
          </button>
          <button
            type="button"
            onClick={onPrimaryClick}
            disabled={primaryDisabled}
            className="ml-auto inline-flex items-center rounded-full bg-black px-6 py-3 text-white hover:bg-gray-900 disabled:opacity-60"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
      </Suspense>
    );
  }

  /* ---------- Loading ---------- */

  if (loading || !profile || !biz) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-600">Loading business settings…</p>
      </div>
    );
  }

  /* ---------- Render ---------- */

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar config={sidebarConfig} />
      <SettingsNav alerts={completeness.navAlerts} />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10 lg:py-12">
          <h1 className="text-3xl font-semibold text-gray-900">Business Settings</h1>

          {renderTabsHeader()}

          {activeTab === "business" && renderBusinessTab()}
          {activeTab === "brand" && renderBrandTab()}
          {activeTab === "docs" && renderDocsTab()}
          {activeTab === "verification" && renderVerificationTab()}
        </div>

        {renderFooter()}
      </main>
    </div>
  );
}
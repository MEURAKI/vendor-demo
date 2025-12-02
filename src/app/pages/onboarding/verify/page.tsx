"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";
import WizardHeader from "../../../../components/auth/onboarding/WizardHeader";
import { useToast } from "../../../../components/toast/ToastProvider";

/* -------------------------------------------------------
   Types & helpers
------------------------------------------------------- */
type VendorStatus =
  | "incomplete_registration"
  | "pending_admin_approval"
  | "agreement_pending"
  | "active"
  | "inactive"
  | "draft"
  | "under_review"
  | "suspended";

type Step3 = {
  company: string;
  uen: string;
  year: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  socialExtra: string;
  bankName: string;
  accNo: string;
  bankCode: string;
  branchCode: string;
  swift: string;
  policyLinks: string[]; // multiple links
};

const EMPTY: Step3 = {
  company: "",
  uen: "",
  year: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  socialExtra: "",
  bankName: "",
  accNo: "",
  bankCode: "",
  branchCode: "",
  swift: "",
  policyLinks: [""],
};

async function setVendorStatus(status: VendorStatus, completed: boolean) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("No user");

  const [p1, p2] = await Promise.all([
    supabase.from("profiles").update({
      status,
      onboarding_completed: completed,
    }).eq("id", user.id),

    supabase.from("onboarding").upsert({
      user_id: user.id,
      status,
      onboarding_completed: completed,
    }),
  ]);

  if (p1.error) throw p1.error;
  if (p2.error) throw p2.error;
}

/* -------------------------------------------------------
   Page
------------------------------------------------------- */
export default function VerifyBusinessPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // form + files
  const [form, setForm] = useState<Step3>(EMPTY);
  const [logo, setLogo] = useState<File | null>(null);
  const [certs, setCerts] = useState<File | null>(null);

  const { successToast, errorToast } = useToast();

  // Prefill from Supabase (onboarding.data.step3)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("onboarding")
        .select("data")
        .eq("user_id", user.id)
        .maybeSingle();

      const raw = data?.data?.step3;
      if (!raw) return;

      // Back-compat for single policyLink field
      const policyLinks: string[] = Array.isArray(raw.policyLinks)
        ? raw.policyLinks
        : raw.policyLink
        ? [raw.policyLink]
        : [""];

      setForm({
        ...EMPTY,
        ...raw,
        policyLinks: policyLinks.length ? policyLinks : [""],
      });
    })();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const updatePolicyLink = (i: number, value: string) => {
    const next = [...form.policyLinks];
    next[i] = value;
    setForm((f) => ({ ...f, policyLinks: next }));
  };

  const addPolicyLink = () =>
    setForm((f) => ({ ...f, policyLinks: [...f.policyLinks, ""] }));

  const removePolicyLink = (i: number) =>
    setForm((f) => ({
      ...f,
      policyLinks: f.policyLinks.filter((_, idx) => idx !== i) || [""],
    }));

const STORAGE_BUCKET = "brand-assets"; // <-- change to your bucket name

async function uploadToStorage(path: string, file: File) {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true });

  if (error) throw error;
  return data.path;
}

async function getPublicUrl(path: string) {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

const handleNext = async (e: React.FormEvent) => {
  e.preventDefault();
  setSaving(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/pages/auth/login");
      return;
    }

    const userId = user.id;

    // -------- 1) Upload files (if any) --------
    let logoPublicUrl: string | null = null;

    if (logo) {
      const ext = logo.name.split(".").pop() ?? "png";
      const logoPath = `${userId}/logo.${ext}`;

      const storageKey = await uploadToStorage(logoPath, logo);
      logoPublicUrl = await getPublicUrl(storageKey);

      // vendor_docs for logo
      await supabase.from("vendor_docs").insert({
        vendor_id: userId,
        kind: "brand_logo", // <-- MUST match your vendor_doc_type enum
        storage_key: storageKey,
        file_name: logo.name,
        mime_type: logo.type,
        size_bytes: logo.size,
        uploaded_by: userId,
      });
    }

    if (certs) {
      const ext = certs.name.split(".").pop() ?? "zip";
      const certsPath = `${userId}/certs/${Date.now()}.${ext}`;

      const storageKey = await uploadToStorage(certsPath, certs);

      await supabase.from("vendor_docs").insert({
        vendor_id: userId,
        kind: "business_certificates", // <-- MUST match your vendor_doc_type enum
        storage_key: storageKey,
        file_name: certs.name,
        mime_type: certs.type,
        size_bytes: certs.size,
        uploaded_by: userId,
      });
    }

    // -------- 2) Save step3 into onboarding JSON (as you already do) --------
    const { data: existing } = await supabase
      .from("onboarding")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();

    const nextData = {
      ...(existing?.data ?? {}),
      step3: {
        ...form,
        _logoFileName: logo?.name || null,
        _certsFileName: certs?.name || null,
      },
    };

    const { error: onboardingError } = await supabase.from("onboarding").upsert({
      user_id: userId,
      step: 3,
      data: nextData,
    });

    if (onboardingError) throw onboardingError;

    // -------- 3) Update vendor_business --------
    const firstPolicyUrl =
      form.policyLinks.find((p) => p.trim().length > 0) ?? null;

    await supabase
      .from("vendor_business")
      .upsert({
        id: userId,
        company_name: form.company || null,
        uen: form.uen || null,
        incorporation_year: form.year || null,
        instagram: form.instagram || null,
        facebook: form.facebook || null,
        tiktok: form.tiktok || null,
        refund_policy_url: firstPolicyUrl,
        brand_logo_url: logoPublicUrl, // or logo_url
      });

    // -------- 4) Mark status (your existing helper) --------
    await setVendorStatus("under_review", true);

    router.push("/pages/auth/pending");
  } catch (err) {
    console.error(err);
    errorToast({ title: "Error", description: "Error saving your details." });
  } finally {
    setSaving(false);
  }
};



  // Finish later (mark incomplete_registration + not completed)
  const finishLater = async () => {
    try {
      await setVendorStatus("pending_admin_approval", false);
      router.push("/pages/dashboard");
    } catch (e) {
      console.error(e);
      errorToast({ title: "Error", description: "Error updating your status." });
    }
  };

  const canAddMoreLinks = useMemo(
    () => form.policyLinks[form.policyLinks.length - 1].trim().length > 0,
    [form.policyLinks]
  );

  return (
    <div className="relative min-h-screen bg-gradient-to-tr from-purple-50 via-white to-purple-50 overflow-hidden font-poppins text-gray-900">
      {/* Glows */}
      <div className="pointer-events-none absolute left-0 top-0 h-[520px] w-[520px] bg-purple-200/40 blur-[140px]" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-[520px] w-[520px] bg-fuchsia-200/40 blur-[140px]" />

      {/* Side slogans */}
      <p className="hidden md:block absolute left-10 top-1/2 -translate-y-1/2 text-purple-300/70 text-[12px] font-semibold"
         style={{ writingMode: "vertical-rl" }}>
        MEURAKI HOLISTIC REVOLUTION
      </p>
      <p className="hidden md:block absolute right-10 top-1/2 -translate-y-1/2 text-purple-300/70 text-[12px] font-semibold"
         style={{ writingMode: "vertical-rl" }}>
        JOIN THE WELLNESS COMMUNITY
      </p>

      {/* Wizard (fixed, md+) */}
      <div className="hidden md:block fixed top-4 left-0 right-0 z-40">
        <div className="mx-auto max-w-3xl px-4">
          <div className="relative rounded-xl bg-white/90 backdrop-blur-md shadow-sm border border-gray-100">
            {/* purple cap showing step 3 */}
            <span className="absolute left-0 top-0 h-[3px] w-64 bg-gradient-to-r from-purple-500 to-purple-400 rounded-t-xl" />
            <div className="px-4 py-2">
              <WizardHeader current={3} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile wizard */}
      <div className="md:hidden px-4 pt-6">
        <div className="relative rounded-xl bg-white/90 backdrop-blur border border-gray-100">
          <span className="absolute left-0 top-0 h-[3px] w-28 bg-gradient-to-r from-purple-500 to-purple-400 rounded-t-xl" />
          <div className="px-4 py-2">
            <WizardHeader current={3} />
          </div>
        </div>
      </div>

      {/* Scrollable card */}
      <div className="relative z-10 flex flex-col items-center px-4 sm:px-6 pt-10 md:pt-[150px] pb-28 md:pb-[220px]">
        <form
          onSubmit={handleNext}
          className="relative w-full max-w-3xl bg-white rounded-[28px] shadow-2xl ring-1 ring-black/5 overflow-hidden flex flex-col"
        >
          <div
            className="flex-1 overflow-y-auto scroll-smooth px-8 sm:px-12 py-10 space-y-10
                       max-h-[calc(100vh-300px)] md:max-h-[calc(100vh-380px)]"
            style={{ scrollbarWidth: "none" }}
          >
            <h1 className="text-2xl sm:text-[26px] font-extrabold text-gray-900">Verify your business</h1>

            {/* Company Logo (row style) */}
            <section className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">Company Logo *</label>
              <p className="text-xs text-gray-500">This logo will be displayed on the app. Click to upload. Size file max upload 300kb.</p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-50/80 border border-purple-200 flex items-center justify-center">
                  <span className="text-lg">🗂️</span>
                </div>

                <label htmlFor="logo" className="relative flex items-center">
                  <span className="inline-flex items-center rounded-full bg-black text-white px-5 py-2 cursor-pointer select-none">
                    Choose File
                  </span>
                  <input id="logo" type="file" accept="image/*" className="hidden"
                         onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
                </label>

                <div className="flex-1">
                  <div className="rounded-xl bg-gray-100 text-gray-600 px-4 py-2 text-sm">
                    {logo?.name || "No File Chosen"}
                  </div>
                </div>
              </div>
            </section>

            {/* Company details */}
            <Field label="Full Company Name (Displayed on your ACRA)" name="company" value={form.company} onChange={handleChange} placeholder="ABC PTE. LTD." />
            <Field label="Company Registration / UEN" name="uen" value={form.uen} onChange={handleChange} placeholder="U2202039" />
            <Field label="Year of Incorporation" name="year" value={form.year} onChange={handleChange} placeholder="2025" />

            {/* Social media */}
            <section className="space-y-3">
              <label className="block text-sm font-semibold text-gray-800">Social Media Links</label>
              <p className="text-xs text-gray-500">Enter the full link including https://</p>
              <Field placeholder="Instagram Handle" name="instagram" value={form.instagram} onChange={handleChange} />
              <Field placeholder="Facebook Handle" name="facebook" value={form.facebook} onChange={handleChange} />
              <Field placeholder="Tiktok Handle" name="tiktok" value={form.tiktok} onChange={handleChange} />
              <Field placeholder="Additional Social Link 1" name="socialExtra" value={form.socialExtra} onChange={handleChange} />
            </section>

            {/* Bank */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Bank Account Details (for payouts)</h2>
              <Field label="Bank Name" name="bankName" value={form.bankName} onChange={handleChange} placeholder="OCBC Bank" />
              <Field label="Account Number" name="accNo" value={form.accNo} onChange={handleChange} placeholder="0000000000" />
              <Field label="Bank Code" name="bankCode" value={form.bankCode} onChange={handleChange} placeholder="7339" />
              <Field label="Branch Code" name="branchCode" value={form.branchCode} onChange={handleChange} placeholder="604" />
              <Field label="SWIFT Code" name="swift" value={form.swift} onChange={handleChange} placeholder="OCBCSGSG" />
            </section>

            {/* Policy links (multi) */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Rescheduling / Cancelation / Returns / Refund Policy
              </h2>
              <p className="text-xs text-gray-500">Please indicate your guideline (you can add multiple links).</p>

              {form.policyLinks.map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/policy"
                    value={link}
                    onChange={(e) => updatePolicyLink(i, e.target.value)}
                    className="w-full rounded-xl bg-purple-50/60 border border-transparent focus:border-purple-300 focus:ring-2 focus:ring-purple-400 px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition"
                  />
                  {i === form.policyLinks.length - 1 ? (
                    <button
                      type="button"
                      disabled={!canAddMoreLinks}
                      onClick={addPolicyLink}
                      className="h-10 w-10 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                      title="Add another link"
                    >
                      +
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removePolicyLink(i)}
                      className="h-10 w-10 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      title="Remove"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </section>

            {/* Certificates upload (row style) */}
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">Upload All Business Certificates</h2>
              <p className="text-xs text-gray-500">
                This includes all documents required to sell your business or services (e.g. qualifications, …).  
                Please upload only one <code>.zip</code> file with all documents.
              </p>

              <div className="flex items-center gap-3">
                <label htmlFor="certs" className="relative flex items-center">
                  <span className="inline-flex items-center rounded-full bg-black text-white px-5 py-2 cursor-pointer select-none">
                    Choose File
                  </span>
                  <input
                    id="certs"
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => setCerts(e.target.files?.[0] ?? null)}
                  />
                </label>

                <div className="flex-1">
                  <div className="rounded-xl bg-gray-100 text-gray-600 px-4 py-2 text-sm">
                    {certs?.name || "No File Chosen"}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Sticky footer inside card */}
          <div className="border-t border-gray-100 px-8 sm:px-12 py-5 flex justify-between items-center bg-white/90 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => router.push("/pages/onboarding/brand")}
              className="rounded-full px-6 py-2 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
            >
              Go Back
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="rounded-full px-6 py-2 text-sm font-medium bg-purple-100 text-purple-600 hover:bg-purple-200 transition"
              >
                Skip
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-full px-6 py-3 text-sm font-medium text-white bg-black hover:bg-gray-900 transition disabled:opacity-60"
              >
                {saving ? "Saving..." : "Next Step →"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Fixed logo bottom center (md+) */}
      <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <Image src="/images/logo-meuraki.svg" alt="Meuraki" width={120} height={30} className="opacity-70" />
      </div>

      {/* Confirm modal for Skip */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[28px] shadow-xl text-center px-8 sm:px-10 py-10 sm:py-12 max-w-md mx-auto">
            <div className="mb-4">
              <div className="mx-auto mb-2 h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-3xl">🌧️</span>
              </div>
            </div>
            <h2 className="text-xl font-bold mb-3 text-gray-900">
              Are you sure?<br /> We won’t be able to verify your business yet.
            </h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              You can complete onboarding later from your account. However,{" "}
              <span className="font-semibold">you won’t be able to start selling or receive payments</span>{" "}
              until all required details and documents are submitted and approved.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button onClick={() => setShowConfirm(false)} className="px-6 py-3 rounded-full bg-black text-white hover:bg-gray-900 transition">
                Go back to onboarding
              </button>
              <button onClick={finishLater} className="px-6 py-3 rounded-full bg-purple-100 text-purple-600 font-medium hover:bg-purple-200 transition">
                Finish later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  placeholder,
  name,
  value,
  onChange,
}: {
  label?: string;
  placeholder: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      {label && <label className="block text-sm font-semibold text-gray-800 mb-1">{label}</label>}
      <input
        name={name}
        value={value}
        onChange={onChange}
        type="text"
        placeholder={placeholder}
        className="w-full rounded-xl bg-purple-50/60 border border-transparent focus:border-purple-300 focus:ring-2 focus:ring-purple-400 px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition"
      />
    </div>
  );
}
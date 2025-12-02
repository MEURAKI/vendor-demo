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
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("No user");

  const { error: pError } = await supabase
    .from("profiles")
    .update({
      status,
      onboarding_completed: completed,
    })
    .eq("id", user.id);

  if (pError) throw pError;
}

// Use the same bucket pattern as profile avatars
const STORAGE_BUCKET = "avatars"; // bucket where avatars/logos are stored
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!; // e.g. https://kltjywhkfwoaefxtzztg.supabase.co

async function uploadToStorage(path: string, file: File) {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true });

  if (error) throw error;
  return data.path; // e.g. "065e5bae-.../1764673572039.png"
}

function buildPublicUrl(path: string) {
  // Produces: https://<project>.supabase.co/storage/v1/object/public/avatars/<path>
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`;
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

  // Prefill from vendor_business + vendor_payout
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const userId = user.id;

      const [businessRes, payoutRes] = await Promise.all([
        supabase
          .from("vendor_business")
          .select(
            `
            company_name,
            uen,
            incorporation_year,
            instagram,
            facebook,
            tiktok,
            refund_policy_url
          `
          )
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("vendor_payout")
          .select(
            `
            account_number,
            bank_name,
            bank_code,
            branch_code,
            swift_iban
          `
          )
          .eq("vendor_id", userId)
          .maybeSingle(),
      ]);

      const business = businessRes.data;
      const payout = payoutRes.data;

      const policyLinks =
        business?.refund_policy_url?.trim().length > 0
          ? [business?.refund_policy_url]
          : [""];

      setForm((prev) => ({
        ...prev,
        company: business?.company_name || prev.company,
        uen: business?.uen || prev.uen,
        year: business?.incorporation_year || prev.year,
        instagram: business?.instagram || prev.instagram,
        facebook: business?.facebook || prev.facebook,
        tiktok: business?.tiktok || prev.tiktok,
        bankName: payout?.bank_name || prev.bankName,
        accNo: payout?.account_number || prev.accNo,
        bankCode: payout?.bank_code || prev.bankCode,
        branchCode: payout?.branch_code || prev.branchCode,
        swift: payout?.swift_iban || prev.swift,
        policyLinks,
      }));
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

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/pages/auth/login");
        return;
      }

      const userId = user.id;

      // -------- 1) Upload files (if any) --------
      let logoPublicUrl: string | null = null;

      if (logo) {
        const ext = logo.name.split(".").pop() ?? "png";
        // Use timestamped filename similar to avatar pattern
        const logoPath = `${userId}/${Date.now()}.${ext}`;

        const storageKey = await uploadToStorage(logoPath, logo);
        logoPublicUrl = buildPublicUrl(storageKey);

        // Update profile avatar_url with the same URL
        await supabase
          .from("profiles")
          .update({ avatar_url: logoPublicUrl })
          .eq("id", userId);
      }

      if (certs) {
        const ext = certs.name.split(".").pop() ?? "zip";
        const certsPath = `${userId}/certs/${Date.now()}.${ext}`;

        const storageKey = await uploadToStorage(certsPath, certs);

        await supabase.from("vendor_docs").insert({
          vendor_id: userId,
          kind: "business_certificates", // must exist in vendor_doc_type enum
          storage_key: storageKey,
          file_name: certs.name,
          mime_type: certs.type,
          size_bytes: certs.size,
          uploaded_by: userId,
        });
      }

      // -------- 2) Update vendor_business --------
      const firstPolicyUrl =
        form.policyLinks.find((p) => p.trim().length > 0) ?? null;

      const vendorBusinessPayload: any = {
        id: userId,
        company_name: form.company || null,
        uen: form.uen || null,
        incorporation_year: form.year || null,
        instagram: form.instagram || null,
        facebook: form.facebook || null,
        tiktok: form.tiktok || null,
        refund_policy_url: firstPolicyUrl,
      };

      // Only send brand_logo_url if we actually uploaded a new logo
      if (logoPublicUrl) {
        vendorBusinessPayload.brand_logo_url = logoPublicUrl;
      }

      const { error: vbError } = await supabase
        .from("vendor_business")
        .upsert(vendorBusinessPayload);

      if (vbError) throw vbError;

      // -------- 3) Upsert vendor_payout (bank details) --------
      const { error: payoutError } = await supabase
        .from("vendor_payout")
        .upsert({
          vendor_id: userId,
          account_number: form.accNo || null,
          account_holder_name: form.company || null, // or use profile full_name if you prefer
          bank_name: form.bankName || null,
          bank_code: form.bankCode || null,
          branch_code: form.branchCode || null,
          swift_iban: form.swift || null,
          // country, currency left null for now (no UI fields yet)
        });

      if (payoutError) throw payoutError;

      // -------- 4) Mark status --------
      await setVendorStatus("under_review", true);

      router.push("/pages/auth/pending");
    } catch (err) {
      console.error(err);
      errorToast({ title: "Error", description: "Error saving your details." });
    } finally {
      setSaving(false);
    }
  };

  // Finish later (mark pending_admin_approval + not completed)
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
      <p
        className="hidden md:block absolute left-10 top-1/2 -translate-y-1/2 text-purple-300/70 text-[12px] font-semibold"
        style={{ writingMode: "vertical-rl" }}
      >
        MEURAKI HOLISTIC REVOLUTION
      </p>
      <p
        className="hidden md:block absolute right-10 top-1/2 -translate-y-1/2 text-purple-300/70 text-[12px] font-semibold"
        style={{ writingMode: "vertical-rl" }}
      >
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
            <h1 className="text-2xl sm:text-[26px] font-extrabold text-gray-900">
              Verify your business
            </h1>

            {/* Company Logo (row style) */}
            <section className="space-y-2">
              <label className="block text-sm font-semibold text-gray-800">
                Company Logo *
              </label>
              <p className="text-xs text-gray-500">
                This logo will be displayed on the app. Click to upload. Size
                file max upload 300kb.
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-50/80 border border-purple-200 flex items-center justify-center">
                  <span className="text-lg">🗂️</span>
                </div>

                <label htmlFor="logo" className="relative flex items-center">
                  <span className="inline-flex items-center rounded-full bg-black text-white px-5 py-2 cursor-pointer select-none">
                    Choose File
                  </span>
                  <input
                    id="logo"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                  />
                </label>

                <div className="flex-1">
                  <div className="rounded-xl bg-gray-100 text-gray-600 px-4 py-2 text-sm">
                    {logo?.name || "No File Chosen"}
                  </div>
                </div>
              </div>
            </section>

            {/* Company details */}
            <Field
              label="Full Company Name (Displayed on your ACRA)"
              name="company"
              value={form.company}
              onChange={handleChange}
              placeholder="ABC PTE. LTD."
            />
            <Field
              label="Company Registration / UEN"
              name="uen"
              value={form.uen}
              onChange={handleChange}
              placeholder="U2202039"
            />
            <Field
              label="Year of Incorporation"
              name="year"
              value={form.year}
              onChange={handleChange}
              placeholder="2025"
            />

            {/* Social media */}
            <section className="space-y-3">
              <label className="block text-sm font-semibold text-gray-800">
                Social Media Links
              </label>
              <p className="text-xs text-gray-500">
                Enter the full link including https://
              </p>
              <Field
                placeholder="Instagram Handle"
                name="instagram"
                value={form.instagram}
                onChange={handleChange}
              />
              <Field
                placeholder="Facebook Handle"
                name="facebook"
                value={form.facebook}
                onChange={handleChange}
              />
              <Field
                placeholder="Tiktok Handle"
                name="tiktok"
                value={form.tiktok}
                onChange={handleChange}
              />
              <Field
                placeholder="Additional Social Link 1"
                name="socialExtra"
                value={form.socialExtra}
                onChange={handleChange}
              />
            </section>

            {/* Bank */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Bank Account Details (for payouts)
              </h2>
              <Field
                label="Bank Name"
                name="bankName"
                value={form.bankName}
                onChange={handleChange}
                placeholder="OCBC Bank"
              />
              <Field
                label="Account Number"
                name="accNo"
                value={form.accNo}
                onChange={handleChange}
                placeholder="0000000000"
              />
              <Field
                label="Bank Code"
                name="bankCode"
                value={form.bankCode}
                onChange={handleChange}
                placeholder="7339"
              />
              <Field
                label="Branch Code"
                name="branchCode"
                value={form.branchCode}
                onChange={handleChange}
                placeholder="604"
              />
              <Field
                label="SWIFT Code"
                name="swift"
                value={form.swift}
                onChange={handleChange}
                placeholder="OCBCSGSG"
              />
            </section>

            {/* Policy links (multi) */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Rescheduling / Cancelation / Returns / Refund Policy
              </h2>
              <p className="text-xs text-gray-500">
                Please indicate your guideline (you can add multiple links).
              </p>

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
              <h2 className="text-lg font-semibold text-gray-900">
                Upload All Business Certificates
              </h2>
              <p className="text-xs text-gray-500">
                This includes all documents required to sell your business or
                services (e.g. qualifications, …). Please upload only one{" "}
                <code>.zip</code> file with all documents.
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
        <Image
          src="/images/logo-meuraki.svg"
          alt="Meuraki"
          width={120}
          height={30}
          className="opacity-70"
        />
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
              Are you sure?
              <br /> We won’t be able to verify your business yet.
            </h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              You can complete onboarding later from your account. However,{" "}
              <span className="font-semibold">
                you won’t be able to start selling or receive payments
              </span>{" "}
              until all required details and documents are submitted and
              approved.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-6 py-3 rounded-full bg-black text-white hover:bg-gray-900 transition"
              >
                Go back to onboarding
              </button>
              <button
                onClick={finishLater}
                className="px-6 py-3 rounded-full bg-purple-100 text-purple-600 font-medium hover:bg-purple-200 transition"
              >
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
      {label && (
        <label className="block text-sm font-semibold text-gray-800 mb-1">
          {label}
        </label>
      )}
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

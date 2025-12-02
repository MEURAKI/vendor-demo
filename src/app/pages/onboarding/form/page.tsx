"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "../../../../lib/supabase/client";
import WizardHeader from "../../../../components/auth/onboarding/WizardHeader";
import Field from "../../../../components/auth/onboarding/Field";
import { useToast } from "../../../../components/toast/ToastProvider";

type Step1 = {
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
  organization: string;
  uen: string;
  address: string;
  postal: string;
  country: string;
  countryCode: string;
};

const EMPTY: Step1 = {
  firstName: "",
  lastName: "",
  role: "",
  email: "",
  phone: "",
  organization: "",
  uen: "",
  address: "",
  postal: "",
  country: "",
  countryCode: "+65",
};

export default function OnboardingForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Step1>(EMPTY);
  const { successToast, errorToast } = useToast();

  /** Prefill from profiles + vendor_business (onboarding tables ignored) **/
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [profilesRes, vendorRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            `
            full_name,
            first_name,
            last_name,
            role,
            email,
            phone,
            country_code
          `
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("vendor_business")
          .select(
            `
            brand_name,
            company_name,
            shop_name,
            contact_email,
            phone_country_code,
            phone_number,
            shop_address,
            pickup_address,
            pickup_postal_code,
            uen
          `
          )
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      const profile = profilesRes.data;
      const vendor = vendorRes.data;

      setForm((prev) => ({
        ...prev,
        firstName: profile?.first_name || prev.firstName,
        lastName: profile?.last_name || prev.lastName,
        role: profile?.role || prev.role,
        email: profile?.email || vendor?.contact_email || prev.email,
        phone: profile?.phone || vendor?.phone_number || prev.phone,
        countryCode:
          profile?.country_code ||
          vendor?.phone_country_code ||
          prev.countryCode ||
          "+65",
        organization:
          vendor?.brand_name ||
          vendor?.shop_name ||
          vendor?.company_name ||
          prev.organization,
        address: vendor?.shop_address || vendor?.pickup_address || prev.address,
        postal: vendor?.pickup_postal_code || prev.postal,
        uen: vendor?.uen || prev.uen,
        // country stays as-is (separate concern)
      }));
    })();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/pages/auth/login");
        return;
      }

      const fullName = [form.firstName, form.lastName].filter(Boolean).join(" ").trim();

      // ----- 1) Update profiles with first/last/full name + role + phone -----
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
          first_name: form.firstName || null,
          last_name: form.lastName || null,
          role: form.role || null,
          phone: form.phone || null,
          country_code: form.countryCode || "+65",
          // email: form.email || null, // uncomment if you want to sync email too
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // ----- 2) Upsert vendor_business with business info -----
      const vendorPayload = {
        id: user.id,
        brand_name: form.organization,
        company_name: form.organization,
        shop_name: form.organization,
        contact_email: form.email,
        phone_country_code: form.countryCode || "+65",
        phone_number: form.phone,
        shop_address: form.address,
        pickup_address: form.address,
        pickup_postal_code: form.postal,
        uen: form.uen || null,
        // leave dimensions, bio, socials etc for later steps
      };

      const { error: vendorError } = await supabase
        .from("vendor_business")
        .upsert(vendorPayload);
      if (vendorError) throw vendorError;

      router.push("/pages/onboarding/brand");
    } catch (err) {
      console.error(err);
      errorToast({ title: "Error", description: "Error saving your details." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-tr from-purple-50 via-white to-purple-50 overflow-hidden font-poppins text-gray-900">
      {/* Soft radiance */}
      <div className="pointer-events-none absolute left-0 top-0 h-[520px] w-[520px] bg-purple-200/40 blur-[140px]" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-[520px] w-[520px] bg-fuchsia-200/40 blur-[140px]" />

      {/* Side slogans */}
      <p
        className="hidden md:block absolute left-10 top-1/2 -translate-y-1/2 text-purple-300/70 text-[12px] font-semibold"
        style={{ writingMode: "vertical-rl", letterSpacing: 0 }}
      >
        MEURAKI HOLISTIC REVOLUTION
      </p>
      <p
        className="hidden md:block absolute right-10 top-1/2 -translate-y-1/2 text-purple-300/70 text-[12px] font-semibold"
        style={{ writingMode: "vertical-rl", letterSpacing: 0 }}
      >
        JOIN THE WELLNESS COMMUNITY
      </p>

      {/* Wizard bar (fixed on md+) */}
      <div className="hidden md:block fixed top-4 left-0 right-0 z-40">
        <div className="mx-auto max-w-3xl px-4">
          <div className="relative rounded-xl bg-white/90 backdrop-blur-md shadow-sm border border-gray-100">
            <span className="absolute left-0 top-0 h-[3px] w-32 bg-gradient-to-r from-purple-500 to-purple-400 rounded-t-xl" />
            <div className="px-4 py-2">
              <WizardHeader current={1} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile wizard */}
      <div className="md:hidden px-4 pt-6">
        <div className="relative rounded-xl bg-white/90 backdrop-blur border border-gray-100">
          <span className="absolute left-0 top-0 h-[3px] w-24 bg-gradient-to-r from-purple-500 to-purple-400 rounded-t-xl" />
          <div className="px-4 py-2">
            <WizardHeader current={1} />
          </div>
        </div>
      </div>

      {/* Scrollable form */}
      <div className="relative z-10 flex flex-col items-center px-4 sm:px-6 pt-10 md:pt-[150px] pb-28 md:pb-[220px]">
        <form
          onSubmit={handleNext}
          className="relative w-full max-w-2xl bg-white rounded-[28px] shadow-2xl ring-1 ring-black/5 overflow-hidden flex flex-col"
        >
          <div
            className="flex-1 overflow-y-auto no-scrollbar scroll-smooth px-8 sm:px-12 py-8 space-y-6
                      max-h-[calc(100vh-300px)] md:max-h-[calc(100vh-380px)]"
          >
            <h1
              className="text-2xl sm:text-[26px] font-extrabold text-gray-900"
              style={{ letterSpacing: "-1px" }}
            >
              Registration Details <span className="text-gray-500">(Mandatory)</span>
            </h1>

            <div className="space-y-6">
              {/* First name / Last name */}
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="First Name *"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  placeholder="Jane"
                />
                <Field
                  label="Last Name *"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                />
              </div>

              {/* Role */}
              <Field
                label="Designation / Role *"
                name="role"
                value={form.role}
                onChange={handleChange}
                placeholder="Sales Manager"
              />

              {/* Email + Phone */}
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="Contact Email Address *"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="janedoe@gmail.com"
                />

                <div>
                  <label
                    className="block text-sm font-semibold mb-1"
                    style={{ letterSpacing: 0 }}
                  >
                    Contact Number *
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700">
                      <span className="text-lg">🇸🇬</span>
                      <span>{form.countryCode}</span>
                    </span>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="0000 0000"
                      className="w-full rounded-xl bg-purple-50/60 border border-transparent focus:border-purple-300 focus:ring-2 focus:ring-purple-400 px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition"
                      required
                    />
                  </div>
                </div>
              </div>

              <Field
                label="Organization / Brand Name *"
                name="organization"
                value={form.organization}
                onChange={handleChange}
                placeholder="BeautyCo"
              />
              <Field
                label="Company UEN"
                name="uen"
                value={form.uen}
                onChange={handleChange}
                placeholder="201234567Z"
              />
              <Field
                label="Business Full Address *"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Address Line 1"
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label=""
                  name="postal"
                  value={form.postal}
                  onChange={handleChange}
                  placeholder="Postal Code"
                />
                <Field
                  label=""
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  placeholder="Country"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 px-8 sm:px-12 py-5 flex justify-between items-center bg-white/90 backdrop-blur-sm">
            <button
              type="button"
              disabled
              className="rounded-full px-6 py-2 text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
            >
              Go Back
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center rounded-full px-6 py-3 text-sm font-medium text-white bg-black hover:bg-gray-900 transition"
            >
              {saving ? "Saving..." : "Next Step →"}
            </button>
          </div>
        </form>
      </div>

      {/* Fixed bottom logo */}
      <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <Image
          src="/images/logo-meuraki.svg"
          alt="Meuraki"
          width={120}
          height={30}
          className="opacity-70"
        />
      </div>
    </div>
  );
}

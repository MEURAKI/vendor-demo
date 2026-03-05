"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "../../../../lib/supabase/client";
import WizardHeader from "../../../../components/auth/onboarding/WizardHeader";
import { useToast } from "../../../../components/toast/ToastProvider";

/** ----------------- Constants ----------------- */

const MAX_DESC = 200;

const DIMENSIONS = [
  "Physical",
  "Emotional",
  "Mental",
  "Occupational",
  "Financial",
  "Environmental",
  "Social",
  "Spiritual",
] as const;

const MOTIVATIONS = [
  "Increase visibility and brand exposure",
  "Reach targeted wellness consumers",
  "Engage in gamified marketing and interactive features",
  "Expand my business through new channels",
  "Participate in events and wellness festivals",
  "Participate in corporate engagements",
  "Connect and collaborate with like-minded wellness brands",
  "Participate in exclusive subscriber events and promotions",
  "Others",
] as const;

const INTERESTS = [
  "Wellness events and festivals",
  "Corporate engagements",
  "Collaborative events with other subscribers",
  "In-app promotions or advertisements",
  "Workshops and webinars",
  "Social media or influencer partnerships",
  "Others",
] as const;

const OFFERINGS = [
  { key: "Products", label: "Products" },
  { key: "Professional Services", label: "Professional Services" },
  { key: "Events", label: "Events" },
  { key: "Digital Solutions", label: "Digital Solutions" },
  { key: "Content Creation", label: "Content Creation" },
  { key: "Other", label: "Other" },
] as const;

const PLATFORMS = [
  "Shopee",
  "Lazada",
  "Amazon",
  "Klook",
  "ClassPass",
  "Fave",
  "Others",
] as const;

/** ----------------- Types ----------------- */

type Step2 = {
  desc: string;
  dimensions: string[];
  offerings: string[];
  platforms: string[];
  motivations: string[];
  interests: string[];
};

/** ----------------- Initial Empty State ----------------- */

const EMPTY: Step2 = {
  desc: "",
  dimensions: [],
  offerings: [],
  platforms: [],
  motivations: [],
  interests: [],
};

/** =======================================================
 *                Brand Story & Offerings
 * ======================================================= */
export default function BrandStoryOfferingsPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<Step2>(EMPTY);
  const { successToast, errorToast } = useToast();

  const descCount = useMemo(
    () => `${state.desc.length}/${MAX_DESC}`,
    [state.desc]
  );

  /** ---------- PREFILL FROM vendor_brand ---------- */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("vendor_brand")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error || !data) return;

      setState((prev) => ({
        ...prev,
        desc: data.short_story ?? "",
        dimensions: data.dimensions ?? [],
        offerings: data.offerings ?? [],
        platforms: data.platforms ?? [],
        motivations: data.motivations ?? [],
        interests: data.interests ?? [],
      }));
    })();
  }, []);

  /** ---------- Helpers ---------- */
  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  /** ---------- SAVE TO vendor_brand ---------- */
  const saveBrandData = async (to: string) => {
    try {
      setSaving(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/pages/auth/login");
        return;
      }

      const payload = {
        id: user.id,
        short_story: state.desc,
        dimensions: state.dimensions,
        offerings: state.offerings,
        platforms: state.platforms,
        motivations: state.motivations,
        interests: state.interests,
      };

      const { error } = await supabase
        .from("vendor_brand")
        .upsert(payload, { onConflict: "id" });

      if (error) throw error;

      router.push(to);
    } catch (err) {
      console.error(err);
      errorToast({
        title: "Error",
        description: "Error saving your brand details.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveBrandData("/pages/onboarding/verify");
  };

  /** ---------- UI ---------- */
  return (
    <div className="relative min-h-screen bg-gradient-to-tr from-purple-50 via-white to-purple-50 overflow-hidden font-poppins text-gray-900">
      {/* Glows */}
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

      {/* Fixed wizard (md+) */}
      <div className="hidden md:block fixed top-4 left-0 right-0 z-40">
        <div className="mx-auto max-w-3xl px-4">
          <div className="relative rounded-xl bg-white/90 backdrop-blur-md shadow-sm border border-gray-100">
            <span className="absolute left-0 top-0 h-[3px] w-32 bg-gradient-to-r from-purple-500 to-purple-400 rounded-t-xl" />
            <div className="px-4 py-2">
              <WizardHeader current={2} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile wizard */}
      <div className="md:hidden px-4 pt-6">
        <div className="relative rounded-xl bg-white/90 backdrop-blur border border-gray-100">
          <span className="absolute left-0 top-0 h-[3px] w-24 bg-gradient-to-r from-purple-500 to-purple-400 rounded-t-xl" />
          <div className="px-4 py-2">
            <WizardHeader current={2} />
          </div>
        </div>
      </div>

      {/* Card area (padding matches Step 1) */}
      <div className="relative z-10 flex flex-col items-center px-4 sm:px-6 pt-10 md:pt-[150px] pb-28 md:pb-[220px]">
        <form
          onSubmit={handleSubmit}
          className="relative w-full max-w-2xl bg-white rounded-[28px] shadow-2xl ring-1 ring-black/5 overflow-hidden flex flex-col"
        >
          {/* Scrollable body */}
          <div
            className="flex-1 overflow-y-auto no-scrollbar scroll-smooth px-8 sm:px-12 py-8 space-y-8
                       max-h-[calc(100vh-300px)] md:max-h-[calc(100vh-380px)]"
          >
            <h1
              className="text-2xl sm:text-[26px] font-extrabold text-gray-900"
              style={{ letterSpacing: "-1px" }}
            >
              Brand Story &amp; Offerings
            </h1>

            {/* Short Story */}
            <Section
              title="Short Description of your brand story*"
              helper="This description will be displayed on the app under your brand name"
            >
              <textarea
                value={state.desc}
                onChange={(e) =>
                  setState({
                    ...state,
                    desc: e.target.value.slice(0, MAX_DESC),
                  })
                }
                rows={4}
                className="w-full rounded-2xl bg-purple-50/70 border border-transparent focus:border-purple-300 focus:ring-2 focus:ring-purple-400 px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition"
                maxLength={MAX_DESC}
                placeholder="Write your inspiring story here (Max 200 characters)"
              />
              <div className="text-xs text-gray-500 text-right mt-1">
                {descCount}
              </div>
            </Section>

            {/* Dimensions */}
            <Section
              title="Select your wellness dimensions"
              helper="Click to select/deselect. You can choose multiple dimensions (if applicable)"
            >
              <div className="flex flex-wrap gap-2 mt-2">
                {DIMENSIONS.map((d) => (
                  <Chip
                    key={d}
                    label={d}
                    active={state.dimensions.includes(d)}
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        dimensions: toggle(s.dimensions, d),
                      }))
                    }
                  />
                ))}
              </div>
            </Section>

            {/* Offerings */}
            <Section title="What offerings do you provide?">
              <div className="space-y-3">
                {OFFERINGS.map((o) => (
                  <CheckboxCard
                    key={o.key}
                    checked={state.offerings.includes(o.key)}
                    onChange={() =>
                      setState((s) => ({
                        ...s,
                        offerings: toggle(s.offerings, o.key),
                      }))
                    }
                    title={o.label}
                  />
                ))}
              </div>
            </Section>

            {/* Platforms */}
            <Section
              title="Any other participating platforms?"
              helper="Click to select/deselect. You can choose multiple platforms (if applicable)"
            >
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    active={state.platforms.includes(p)}
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        platforms: toggle(s.platforms, p),
                      }))
                    }
                  />
                ))}
              </div>
            </Section>

            {/* Motivation for joining */}
            <Section title="Motivation for Joining MEURAKI and Our Community">
              <div className="space-y-3">
                {MOTIVATIONS.map((m) => (
                  <CheckboxCard
                    key={m}
                    checked={state.motivations.includes(m)}
                    onChange={() =>
                      setState((s) => ({
                        ...s,
                        motivations: toggle(s.motivations, m),
                      }))
                    }
                    title={m}
                  />
                ))}
              </div>
            </Section>

            {/* Interests */}
            <Section title="Interest in Participating In The Following Events / Promotions">
              <div className="space-y-3">
                {INTERESTS.map((i) => (
                  <CheckboxCard
                    key={i}
                    checked={state.interests.includes(i)}
                    onChange={() =>
                      setState((s) => ({
                        ...s,
                        interests: toggle(s.interests, i),
                      }))
                    }
                    title={i}
                  />
                ))}
              </div>
            </Section>
          </div>

          {/* Sticky footer */}
          <div className="border-t border-gray-100 px-8 sm:px-12 py-5 flex justify-between items-center bg-white/90 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => router.push("/pages/onboarding/form")}
              className="rounded-full px-6 py-2 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
            >
              Go Back
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => saveBrandData("/pages/onboarding/verify")}
                className="rounded-full px-6 py-2 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
              >
                {saving ? "Saving..." : "Skip"}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-full px-6 py-3 text-sm font-medium text-white bg-black hover:bg-gray-900 transition"
              >
                {saving ? "Saving..." : "Next Step →"}
              </button>
            </div>
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

/** ---------- Reusable UI ---------- */

function Section({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="text-sm font-semibold text-gray-800">{title}</div>
      {helper && <p className="text-xs text-gray-500">{helper}</p>}
      {children}
    </section>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition
        ${
          active
            ? "bg-purple-100 text-purple-800 border-purple-200"
            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
        }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function CheckboxCard({
  checked,
  onChange,
  title,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
}) {
  return (
    <label
      className={`block rounded-2xl border p-4 cursor-pointer transition
        ${
          checked
            ? "border-purple-300 bg-purple-50/40"
            : "border-gray-200 bg-white hover:bg-gray-50"
        }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1.5 h-4 w-4 accent-purple-600"
          checked={checked}
          onChange={onChange}
        />
        <div className="w-full">
          <div className="font-medium text-gray-900">{title}</div>
        </div>
      </div>
    </label>
  );
}

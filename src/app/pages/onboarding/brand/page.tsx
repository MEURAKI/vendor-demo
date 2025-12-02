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
  "Participate in exclusive vendor events and promotions",
  "Others",
] as const;

const INTERESTS = [
  "Wellness events and festivals",
  "Corporate engagements",
  "Collaborative events with other vendors",
  "In-app promotions or advertisements",
  "Workshops and webinars",
  "Social media or influencer partnerships",
  "Others",
] as const;


const DIM_ICONS: Record<(typeof DIMENSIONS)[number], string> = {
  Physical: "/images/wellness/physical-realm.png",
  Emotional: "/images/wellness/emotional-realm.png",
  Mental: "/images/wellness/mental-realm.png",
  Occupational: "/images/wellness/occupational-realm.png",
  Financial: "/images/wellness/financial-realm.png",
  Environmental: "/images/wellness/Environmental-realm.png", // note uppercase 'E' from your file
  Social: "/images/wellness/social-realm.png",
  Spiritual: "/images/wellness/spiritual-realm.png",
};

const OFFERINGS = [
  { key: "products", label: "Products", desc: "Wellness items, equipment, supplements, books, tools, or accessories." },
  { key: "professional_services", label: "Professional Services", desc: "Coaching, therapy, consultations, mentoring, or wellness advisory." },
  { key: "events", label: "Events", desc: "Workshops, classes, group sessions, retreats, talks, or community experiences." },
  { key: "digital_solutions", label: "Digital Solutions", desc: "Apps, online services, software, platforms, or subscriptions." },
  { key: "content_creation", label: "Content Creation", desc: "Articles, guides, videos, podcasts, or other wellness-related media." },
  { key: "other", label: "Other", desc: "" },
] as const;

const PLATFORMS = ["Shopee", "Lazada", "Amazon", "Klook", "ClassPass", "Fave", "Others"] as const;

/** ----------------- Types ----------------- */

type Step2 = {
  desc: string;
  dimensions: string[];
  offerings: string[];
  offeringOther: string;
  platforms: string[];
  platformOther: string;

  motivations: string[];
  motivationOther: string;
  interests: string[];
  interestOther: string;
};

const EMPTY: Step2 = {
  desc: "",
  dimensions: [],
  offerings: [],
  offeringOther: "",
  platforms: [],
  platformOther: "",

  motivations: [],
  motivationOther: "",
  interests: [],
  interestOther: "",
};




/** =======================================================
 *                Brand Story & Offerings
 * ======================================================= */
export default function BrandStoryOfferingsPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<Step2>(EMPTY);

  const { successToast, errorToast } = useToast();

  const descCount = useMemo(() => `${state.desc.length}/${MAX_DESC}`, [state.desc]);

  /** ---------- Prefill from Supabase ---------- */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("onboarding")
        .select("data")
        .eq("user_id", user.id)
        .single();

      const saved = data?.data?.step2 as Step2 | undefined;
      if (saved) setState((prev) => ({ ...prev, ...saved }));
    })();
  }, []);

  /** ---------- Helpers ---------- */
  const toggleArrayValue = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const toggleDimension = (d: string) =>
    setState((s) => ({ ...s, dimensions: toggleArrayValue(s.dimensions, d) }));

  const toggleOffering = (key: string) =>
    setState((s) => {
      const next = toggleArrayValue(s.offerings, key);
      return { ...s, offerings: next, offeringOther: next.includes("other") ? s.offeringOther : "" };
    });

  const togglePlatform = (p: string) =>
    setState((s) => {
      const next = toggleArrayValue(s.platforms, p);
      return { ...s, platforms: next, platformOther: next.includes("Others") ? s.platformOther : "" };
    });

  const toggleMotivation = (item: string) =>
    setState((s) => {
      const next = toggleArrayValue(s.motivations, item);
      return { ...s, motivations: next, motivationOther: next.includes("Others") ? s.motivationOther : "" };
    });

  const toggleInterest = (item: string) =>
    setState((s) => {
      const next = toggleArrayValue(s.interests, item);
      return { ...s, interests: next, interestOther: next.includes("Others") ? s.interestOther : "" };
    });


  /** ---------- Persist (Next or Skip) ---------- */
const persistAndGo = async (to: string) => {
  try {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/pages/auth/login");
      return;
    }

    // 1) Keep existing onboarding JSON behaviour
    const { data: existing } = await supabase
      .from("onboarding")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();

    const nextData = { ...(existing?.data ?? {}), step2: state };

    await supabase.from("onboarding").upsert({
      user_id: user.id,
      step: 3,
      data: nextData,
    });

    // 2) Update vendor_business with brand story + dimensions (+ optional tags)
    const businessTags = [
      ...state.offerings,
      ...state.platforms,
      ...state.motivations,
      ...state.interests,
    ]
      .filter(Boolean)
      .join(",");

    await supabase
      .from("vendor_business")
      .update({
        shop_bio: state.desc || null,
        dimensions: state.dimensions.length ? state.dimensions : null,
        business_tags: businessTags || null,
      })
      .eq("id", user.id);

    router.push(to);
  } catch (e) {
    console.error(e);
    errorToast({ title: "Error", description: "Error saving your details." });
  } finally {
    setSaving(false);
  }
};


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistAndGo("/pages/onboarding/verify");
  };

  /** ---------- Render ---------- */
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
          {/* Scrollable body (invisible scrollbar) */}
          <div
            className="flex-1 overflow-y-auto no-scrollbar scroll-smooth px-8 sm:px-12 py-8 space-y-8
                       max-h-[calc(100vh-300px)] md:max-h-[calc(100vh-380px)]"
          >
            <h1 className="text-2xl sm:text-[26px] font-extrabold text-gray-900" style={{ letterSpacing: "-1px" }}>
              Brand Story &amp; Offerings
            </h1>

            {/* Short Description */}
            <Section title="Short Description of your brand story*" helper="This description will be displayed on the app under your brand name">
              <CounterTextarea
                value={state.desc}
                onChange={(v) => setState((s) => ({ ...s, desc: v.slice(0, MAX_DESC) }))}
                max={MAX_DESC}
                placeholder="Write here your inspiring story here (Max 200 characters)"
              />
              <div className="text-xs text-gray-500 text-right mt-1">{descCount}</div>
            </Section>

            {/* Dimensions chips with icons */}
            <Section title="Select your wellness dimensions" helper="Click to select/deselect. You can choose multiple dimensions (if applicable)">
              <div className="flex flex-wrap gap-2 mt-2">
                {DIMENSIONS.map((d) => {
                  const active = state.dimensions.includes(d);
                  return (
                    <Chip
                      key={d}
                      active={active}
                      onClick={() => toggleDimension(d)}
                      iconSrc={DIM_ICONS[d]}
                      label={d}
                    />
                  );
                })}
              </div>
            </Section>

            {/* Offerings */}
            <Section title="What offerings do you provide?">
              <div className="space-y-3">
                {OFFERINGS.map((o) => {
                  const checked = state.offerings.includes(o.key);
                  return (
                    <CheckboxCard
                      key={o.key}
                      checked={checked}
                      onChange={() => toggleOffering(o.key)}
                      title={o.label}
                      desc={o.desc}
                    >
                      {o.key === "other" && checked && (
                        <textarea
                          value={state.offeringOther}
                          onChange={(e) => setState((s) => ({ ...s, offeringOther: e.target.value }))}
                          rows={3}
                          className="w-full rounded-2xl bg-purple-50/70 border border-transparent focus:border-purple-300 focus:ring-2 focus:ring-purple-400 px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition"
                          placeholder="Please describe your other offering(s)"
                        />
                      )}
                    </CheckboxCard>
                  );
                })}
              </div>
            </Section>

            {/* Platforms */}
            <Section title="Any other participating platforms?" helper="Click to select/deselect. You can choose multiple platforms (if applicable)">
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => {
                  const active = state.platforms.includes(p);
                  return (
                    <Chip
                      key={p}
                      active={active}
                      onClick={() => togglePlatform(p)}
                      label={p}
                    />
                  );
                })}
              </div>

              {state.platforms.includes("Others") && (
                <div className="mt-3">
                  <textarea
                    value={state.platformOther}
                    onChange={(e) => setState((s) => ({ ...s, platformOther: e.target.value }))}
                    rows={3}
                    className="w-full rounded-2xl bg-purple-50/70 border border-transparent focus:border-purple-300 focus:ring-2 focus:ring-purple-400 px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition"
                    placeholder="Tell us which other platform(s) you participate in"
                  />
                </div>
              )}
            </Section>

            {/* Motivation for joining */}
            <Section
              title="Motivation for Joining MEURAKI and Our Community"
            >
              <div className="space-y-3">
                {MOTIVATIONS.map((m) => {
                  const checked = state.motivations.includes(m);
                  return (
                    <CheckboxCard
                      key={m}
                      checked={checked}
                      onChange={() => toggleMotivation(m)}
                      title={m}
                    >
                      {m === "Others" && checked && (
                        <textarea
                          value={state.motivationOther}
                          onChange={(e) => setState((s) => ({ ...s, motivationOther: e.target.value }))}
                          rows={3}
                          className="mt-3 w-full rounded-2xl bg-purple-50/70 border border-transparent focus:border-purple-300 focus:ring-2 focus:ring-purple-400 px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition"
                          placeholder="Tell us your motivation"
                        />
                      )}
                    </CheckboxCard>
                  );
                })}
              </div>
            </Section>

            {/* Interest in participating */}
            <Section title="Interest in Participating In The Following Events / Promotions">
              <div className="space-y-3">
                {INTERESTS.map((i) => {
                  const checked = state.interests.includes(i);
                  return (
                    <CheckboxCard
                      key={i}
                      checked={checked}
                      onChange={() => toggleInterest(i)}
                      title={i}
                    >
                      {i === "Others" && checked && (
                        <textarea
                          value={state.interestOther}
                          onChange={(e) => setState((s) => ({ ...s, interestOther: e.target.value }))}
                          rows={3}
                          className="mt-3 w-full rounded-2xl bg-purple-50/70 border border-transparent focus:border-purple-300 focus:ring-2 focus:ring-purple-400 px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition"
                          placeholder="Tell us what other events/promotions interest you"
                        />
                      )}
                    </CheckboxCard>
                  );
                })}
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
                onClick={() => persistAndGo("/pages/onboarding/verify")}
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
        <Image src="/images/logo-meuraki.svg" alt="Meuraki" width={120} height={30} className="opacity-70" />
      </div>
    </div>
  );
}

/** ================= Reusable UI ================= */

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

function CounterTextarea({
  value,
  onChange,
  placeholder,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value.slice(0, max))}
      rows={4}
      className="w-full rounded-2xl bg-purple-50/70 border border-transparent focus:border-purple-300 focus:ring-2 focus:ring-purple-400 px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition"
      placeholder={placeholder}
    />
  );
}

function Chip({
  label,
  active,
  onClick,
  iconSrc,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  iconSrc?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition
        ${active ? "bg-purple-100 text-purple-800 border-purple-200" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`}
      aria-pressed={!!active}
    >
      {iconSrc && (
        <span className="relative inline-block h-[18px] w-[18px]">
          <Image src={iconSrc} alt="" fill className="object-contain" />
        </span>
      )}
      {label}
    </button>
  );
}

function CheckboxCard({
  checked,
  onChange,
  title,
  desc,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={`block rounded-2xl border p-4 cursor-pointer transition
        ${checked ? "border-purple-300 bg-purple-50/40" : "border-gray-200 bg-white hover:bg-gray-50"}`}
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
          {desc && <div className="text-sm text-gray-600">{desc}</div>}
          {children}
        </div>
      </div>
    </label>
  );
}

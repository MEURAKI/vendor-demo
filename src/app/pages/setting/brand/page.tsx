"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";
import { useToast } from "../../../../components/toast/ToastProvider";

/* ----------------------------- Types & Consts ---------------------------- */

type UserStatus = "pending_admin_approval" | "approved" | "active" | "rejected" | "suspended";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
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

const TABLE = "vendor_brand";
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

/* ------------------------------- Helpers -------------------------------- */

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

/* --------------------------------- Page ---------------------------------- */

export default function BrandStoryOfferingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [shortStory, setShortStory] = useState("");
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [offerings, setOfferings] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [motivations, setMotivations] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  const { successToast, errorToast } = useToast();

  // Load profile & existing brand doc (or prep empty)
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }

      // profile basics (for sidebar)
      const { data: prof } = await supabase
        .from("profiles")
        .select("id,email,status,onboarding_completed,full_name")
        .eq("id", auth.user.id)
        .maybeSingle();

      setProfile(prof as Profile);

      // load brand doc
      const { data: doc } = await supabase
        .from(TABLE)
        .select("*")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (doc) {
        const d = doc as BrandDoc;
        setShortStory(d.short_story ?? "");
        setDimensions(d.dimensions ?? []);
        setOfferings(d.offerings ?? []);
        setPlatforms(d.platforms ?? []);
        setMotivations(d.motivations ?? []);
        setInterests(d.interests ?? []);
      } else {
        // defaults (empty but usable)
        setShortStory("");
        setDimensions([]);
        setOfferings([]);
        setPlatforms([]);
        setMotivations([]);
        setInterests([]);
      }

      setLoading(false);
    })();
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name,
        email: profile?.email,
        role: "Vendor",
       status: profile?.status ?? "active"
      }),
    [profile]
  );

  const toggleIn = (arr: string[], value: string, setArr: (next: string[]) => void) => {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  async function onSave() {
    if (!profile?.id) return;
    setSaving(true);

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
      .from(TABLE)
      .upsert({ ...payload, updated_at: new Date().toISOString() }, { onConflict: "id" });

    setSaving(false);
    if (error) {
      errorToast({ title: "Error", description: `Save failed: ${error.message}` });
    } else {
      successToast({ title: "Success", description: "Saved!" });
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar config={sidebarConfig} />
      <SettingsNav />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10 lg:py-12">
          <h1 className="text-3xl font-semibold text-gray-900">Business Settings</h1>

          {/* Tabs */}
          <div className="mt-6 flex gap-10 border-b border-gray-200">
            <button
              className="pb-3 text-sm text-gray-500 hover:text-gray-900"
              onClick={() => (window.location.href = "/pages/setting/business")}
            >
              Business Information
            </button>
            <button className="pb-3 text-sm font-semibold text-gray-900 border-b-2 border-gray-900">
              Brand Story &amp; Offerings
            </button>
            <button
              className="pb-3 text-sm text-gray-500 hover:text-gray-900"
              onClick={() => (window.location.href = "/pages/setting/docs")}
            >
              Documents &amp; Agreements
            </button>
            <button
              className="pb-3 text-sm text-gray-500 hover:text-gray-900"
              onClick={() => (window.location.href = "/pages/setting/verification")}
            >
              Verification Status
            </button>
          </div>

          {/* Short Story */}
          <section className="mt-8">
            <div className="text-sm font-semibold text-gray-900">Short Description of Your Brand Story</div>
            <p className="mt-1 text-xs text-gray-500">
              Write a short story (max {STORY_LIMIT} characters) describing your brand’s journey or mission.
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
            <div className="text-sm font-semibold text-gray-900">Select Your Wellness Dimensions</div>
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
            <div className="text-sm font-semibold text-gray-900">What Offerings Do You Provide?</div>
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
            <div className="text-sm font-semibold text-gray-900">Any other participating platforms?</div>
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
              Select your main reasons for joining (e.g., visibility, growth, community, partnerships).
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

          {/* Sticky Save Bar */}
          <div className="fixed bottom-0 left-0 right-0 z-10 ml-[calc(300px+280px)] bg-white/85 backdrop-blur border-t border-gray-200">
            {/* ml equals dark rail (~300px) + settings rail (280px); tweak if your widths differ */}
            <div className="mx-auto max-w-5xl px-8 py-4 flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-gray-300 bg-white px-5 py-3 text-sm hover:bg-gray-50"
                onClick={() => window.history.back()}
              >
                Go back without saving
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// app/pages/experiences/new/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import Image from "next/image";

import Sidebar from "../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";
import AppModal from "../../../../components/common/AppModal";
import ClipLoader from "react-spinners/ClipLoader";
// If you already have an uploader helper like services:
import { uploadProviderImage } from "../../../../lib/uploadProviderImage";

/* ---------- Types ---------- */

type ExperienceStatus = "draft" | "published" | "cancelled";
type DateStatus = "draft" | "published" | "sold_out" | "cancelled";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed?: boolean;
};

type ExperienceDate = {
  id: string;
  session_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  timezone: string;
  doors_open_time?: string | null;
  capacity: number;
  cutoff_hours: number;
  status: DateStatus;
};

type ExperienceTicket = {
  id: string;
  name: string;
  price: number;
  max_per_user: number;
  min_per_order?: number | null;
  sales_start?: string | null; // ISO
  sales_end?: string | null; // ISO
  allow_xp: boolean;
  allow_corporate: boolean;
  allow_promocodes: boolean;
  experience_date_id?: string | null; // optional
};

type NohPolicy = {
  no_show_grace_minutes: number;
  no_show_penalty_type: "none" | "partial" | "full";
  no_show_penalty_value?: number | null;
  allow_late_entry: boolean;
  late_entry_grace_minutes?: number | null;
  auto_mark_no_show: boolean;
  lock_entry_after_minutes?: number | null;
};

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

/* ---------- Page ---------- */

export default function NewExperiencePage() {
  const router = useRouter();

  // sidebar
  const [profile, setProfile] = useState<Profile | null>(null);

  // A) basics
  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [fullDesc, setFullDesc] = useState("");
  const [status, setStatus] = useState<ExperienceStatus>("draft");

  const [tags, setTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Images (match Services UX)
  const [images, setImages] = useState<string[]>([]);
  const coverImageUrl = images[0] ?? "";

  const [locationType, setLocationType] = useState<"online" | "in_person">("in_person");
  const [address, setAddress] = useState("");
  const [mapLink, setMapLink] = useState("");

  const [hostName, setHostName] = useState("");
  const [hostProfile, setHostProfile] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");

  // B) dates
  const [dates, setDates] = useState<ExperienceDate[]>([
    {
      id: uid(),
      session_date: "",
      start_time: "",
      end_time: "",
      timezone: "Asia/Singapore",
      doors_open_time: null,
      capacity: 0,
      cutoff_hours: 0,
      status: "draft",
    },
  ]);

  // C) tickets (global by default)
  const [tickets, setTickets] = useState<ExperienceTicket[]>([
    {
      id: uid(),
      name: "General",
      price: 0,
      max_per_user: 4,
      min_per_order: null,
      sales_start: null,
      sales_end: null,
      allow_xp: false,
      allow_corporate: false,
      allow_promocodes: false,
      experience_date_id: null,
    },
  ]);

  // NOH
  const [noh, setNoh] = useState<NohPolicy>({
    no_show_grace_minutes: 0,
    no_show_penalty_type: "none",
    no_show_penalty_value: null,
    allow_late_entry: false,
    late_entry_grace_minutes: 0,
    auto_mark_no_show: true,
    lock_entry_after_minutes: null,
  });

  const [activeTab, setActiveTab] = useState<"details" | "dates" | "tickets" | "policies">("details");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // simple validation + modals like Services
  const [showTitleErrorModal, setShowTitleErrorModal] = useState(false);
  const [showCategoryErrorModal, setShowCategoryErrorModal] = useState(false);
  const detailsSectionRef = useRef<HTMLDivElement | null>(null);
  const discoverySectionRef = useRef<HTMLDivElement | null>(null);

  const canSave = useMemo(() => title.trim().length > 0, [title]);

  // load profile (for sidebar) — same as Services
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data } = await supabase
        .from("profiles")
        .select("id,email,full_name,status,onboarding_completed")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (data) setProfile(data as Profile);
    })();
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? "",
        role: "Vendor",
        status: profile?.status ?? "active",
      }),
    [profile]
  );

  async function handleImageUpload(files: FileList | null) {
    if (!files || !files.length) return;
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const url = await uploadProviderImage(file);
      if (url) newUrls.push(url);
    }

    setImages((prev) => [...prev, ...newUrls].slice(0, 6));
  }

  async function handleCreate() {
    if (saving) return;
    setErr(null);

    if (!canSave) {
      setShowTitleErrorModal(true);
      setActiveTab("details");
      return;
    }

    // optional: enforce category for publish (like Services active)
    if (status === "published" && categories.length === 0) {
      setShowCategoryErrorModal(true);
      setActiveTab("details");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: title.trim(),
        short_description: shortDesc || null,
        full_description: fullDesc || null,

        categories,
        tags,

        cover_image_url: coverImageUrl || null,
        gallery_images: images.slice(1), // keep same API shape if you want

        location_type: locationType,
        address: locationType === "in_person" ? address || null : null,
        map_link: locationType === "in_person" ? mapLink || null : null,

        host_name: hostName || null,
        host_profile: hostProfile || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        refund_policy: refundPolicy || null,

        status,

        dates: dates.filter((d) => d.session_date && d.start_time && d.end_time),
        tickets: tickets.filter((t) => t.name && t.price >= 0),
        noh_policy: noh,
      };

      const res = await fetch("/api/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || "Failed to create experience");

      router.push(`/pages/experiences/${(json as any).experience.id}/edit`);
    } catch (e: any) {
      setErr(e.message ?? "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen w-screen bg-[#050509] overflow-hidden">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Header (match Services new) */}
          <div className="flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <div>
              <h1 className="text-xl font-semibold text-[#1B1529]">Add new experience</h1>
              <p className="text-xs text-gray-600">Create event details, dates & ticket types.</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStatus("draft")}
                className="h-9 rounded-full border border-gray-300 bg-white px-4 text-xs font-medium"
              >
                Save Draft
              </button>

              <button
                type="button"
                disabled={!canSave || saving}
                onClick={handleCreate}
                className={clsx(
                  "h-9 rounded-full px-6 text-xs font-semibold text-white",
                  canSave && !saving ? "bg-black hover:bg-gray-900" : "cursor-not-allowed bg-gray-300"
                )}
              >
                {saving ? "Saving…" : "Create Experience"}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto px-6 py-6">
            {/* Tabs (same visual language) */}
            <div className="flex flex-wrap gap-2 px-2 pb-4">
              {(["details", "dates", "tickets", "policies"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTab(t)}
                  className={clsx(
                    "rounded-full px-4 py-2 text-xs font-semibold",
                    activeTab === t ? "bg-black text-white" : "bg-white border border-gray-200 text-gray-700"
                  )}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {err && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {err}
              </div>
            )}

            {activeTab === "details" && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,2.4fr)_minmax(320px,1fr)]">
                {/* LEFT */}
                <div className="space-y-6" ref={detailsSectionRef}>
                  <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                    <h2 className="mb-4 text-sm font-semibold text-gray-900">General Information</h2>

                    <div className="space-y-4 text-xs">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-800">Title *</label>
                        <input
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-gray-800">Short description</label>
                        <textarea
                          rows={3}
                          value={shortDesc}
                          onChange={(e) => setShortDesc(e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-gray-800">Full description</label>
                        <textarea
                          rows={6}
                          value={fullDesc}
                          onChange={(e) => setFullDesc(e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                    <h2 className="mb-4 text-sm font-semibold text-gray-900">Host & Contact</h2>

                    <div className="space-y-4 text-xs">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-800">Host name</label>
                          <input
                            value={hostName}
                            onChange={(e) => setHostName(e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-gray-800">Contact email</label>
                          <input
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-800">Contact phone</label>
                          <input
                            value={contactPhone}
                            onChange={(e) => setContactPhone(e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-gray-800">Status</label>
                          <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as ExperienceStatus)}
                            className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                          >
                            <option value="draft">draft</option>
                            <option value="published">published</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-gray-800">Host profile</label>
                        <textarea
                          rows={3}
                          value={hostProfile}
                          onChange={(e) => setHostProfile(e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-gray-900">Location</h2>
                        <p className="text-[11px] text-gray-500">Online or in-person details.</p>
                      </div>

                      <div className="flex gap-2">
                        {(["in_person", "online"] as const).map((lt) => (
                          <button
                            key={lt}
                            type="button"
                            onClick={() => setLocationType(lt)}
                            className={clsx(
                              "rounded-full border px-3 py-1 text-[11px] font-semibold",
                              locationType === lt
                                ? "border-black bg-black text-white"
                                : "border-gray-300 bg-white text-gray-700"
                            )}
                          >
                            {lt === "in_person" ? "In-person" : "Online"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {locationType === "in_person" && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2 text-xs">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-800">Address</label>
                          <input
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-800">Map link</label>
                          <input
                            value={mapLink}
                            onChange={(e) => setMapLink(e.target.value)}
                            className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                            placeholder="https://maps.google.com/…"
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                    <h2 className="mb-4 text-sm font-semibold text-gray-900">Refund policy</h2>
                    <textarea
                      rows={4}
                      value={refundPolicy}
                      onChange={(e) => setRefundPolicy(e.target.value)}
                      className="w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                    />
                  </section>
                </div>

                {/* RIGHT */}
                <div className="space-y-6" ref={discoverySectionRef}>
                  {/* Images (match Services) */}
                  <section className="rounded-3xl border border-[#ECECFB] bg-white p-5">
                    <h2 className="mb-3 text-sm font-semibold text-gray-900">Experience Images</h2>

                    <div className="overflow-hidden rounded-3xl bg-gray-200 relative">
                      {coverImageUrl ? (
                        <img src={coverImageUrl} alt="Experience cover" className="h-56 w-full object-cover" />
                      ) : (
                        <div className="flex h-56 items-center justify-center text-xs text-gray-500">
                          Upload a main experience image
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex gap-2">
                      {images.slice(0, 5).map((url) => (
                        <div
                          key={url}
                          className="relative h-14 w-14 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
                        >
                          <img src={url} alt="" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setImages((prev) => prev.filter((img) => img !== url))}
                            className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white shadow-md hover:bg-red-700"
                            aria-label="Remove image"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      {images.length < 6 && (
                        <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-[#F5F5F8] text-xl text-gray-500">
                          +
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleImageUpload(e.target.files)}
                          />
                        </label>
                      )}
                    </div>

                    <p className="mt-2 text-[10px] text-gray-500">
                      Upload a high-resolution cover image and up to 5 gallery images.
                    </p>
                  </section>

                  {/* Discovery (chips) */}
                  <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                    <h2 className="mb-4 text-sm font-semibold text-gray-900">Discovery</h2>

                    <div className="grid gap-4 text-xs">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-800">Categories (press Enter)</label>
                        <ChipInput items={categories} onChange={setCategories} placeholder="e.g. Wellness" />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-gray-800">Tags (press Enter)</label>
                        <ChipInput items={tags} onChange={setTags} placeholder="e.g. Yoga" />
                      </div>
                    </div>

                    {status === "published" && categories.length === 0 ? (
                      <p className="mt-3 text-[11px] text-red-600">Please add at least one category to publish.</p>
                    ) : null}
                  </section>
                </div>
              </div>
            )}

            {activeTab === "dates" && (
              <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">Dates / Sessions</h2>

                  <button
                    type="button"
                    onClick={() =>
                      setDates((prev) => [
                        ...prev,
                        {
                          id: uid(),
                          session_date: "",
                          start_time: "",
                          end_time: "",
                          timezone: prev[0]?.timezone ?? "Asia/Singapore",
                          doors_open_time: null,
                          capacity: 0,
                          cutoff_hours: 0,
                          status: "draft",
                        },
                      ])
                    }
                    className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                  >
                    + Add Date
                  </button>
                </div>

                <div className="space-y-4">
                  {dates.map((d, idx) => (
                    <div key={d.id} className="rounded-2xl border border-gray-200 bg-[#FBFBFE] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold text-purple-700">Session {idx + 1}</p>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setDates((prev) => [...prev, { ...d, id: uid() }])}
                            className="rounded-full border border-gray-300 bg-white px-3 py-1 text-[11px] font-semibold text-gray-700"
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => setDates((prev) => prev.filter((x) => x.id !== d.id))}
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <Field label="Date">
                          <input
                            type="date"
                            value={d.session_date}
                            onChange={(e) =>
                              setDates((prev) =>
                                prev.map((x) => (x.id === d.id ? { ...x, session_date: e.target.value } : x))
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Start">
                          <input
                            type="time"
                            value={d.start_time}
                            onChange={(e) =>
                              setDates((prev) =>
                                prev.map((x) => (x.id === d.id ? { ...x, start_time: e.target.value } : x))
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="End">
                          <input
                            type="time"
                            value={d.end_time}
                            onChange={(e) =>
                              setDates((prev) =>
                                prev.map((x) => (x.id === d.id ? { ...x, end_time: e.target.value } : x))
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Timezone">
                          <input
                            value={d.timezone}
                            onChange={(e) =>
                              setDates((prev) =>
                                prev.map((x) => (x.id === d.id ? { ...x, timezone: e.target.value } : x))
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                            placeholder="Asia/Singapore"
                          />
                        </Field>

                        <Field label="Doors open (optional)">
                          <input
                            type="time"
                            value={d.doors_open_time ?? ""}
                            onChange={(e) =>
                              setDates((prev) =>
                                prev.map((x) => (x.id === d.id ? { ...x, doors_open_time: e.target.value || null } : x))
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Status">
                          <select
                            value={d.status}
                            onChange={(e) =>
                              setDates((prev) =>
                                prev.map((x) => (x.id === d.id ? { ...x, status: e.target.value as DateStatus } : x))
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          >
                            <option value="draft">draft</option>
                            <option value="published">published</option>
                            <option value="sold_out">sold_out</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                        </Field>

                        <Field label="Capacity">
                          <input
                            type="number"
                            min={0}
                            value={d.capacity}
                            onChange={(e) =>
                              setDates((prev) =>
                                prev.map((x) => (x.id === d.id ? { ...x, capacity: Number(e.target.value || 0) } : x))
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Cutoff hours">
                          <input
                            type="number"
                            min={0}
                            value={d.cutoff_hours}
                            onChange={(e) =>
                              setDates((prev) =>
                                prev.map((x) => (x.id === d.id ? { ...x, cutoff_hours: Number(e.target.value || 0) } : x))
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeTab === "tickets" && (
              <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">Ticket Types</h2>
                  <button
                    type="button"
                    onClick={() =>
                      setTickets((prev) => [
                        ...prev,
                        {
                          id: uid(),
                          name: `Ticket ${prev.length + 1}`,
                          price: 0,
                          max_per_user: 4,
                          min_per_order: null,
                          sales_start: null,
                          sales_end: null,
                          allow_xp: false,
                          allow_corporate: false,
                          allow_promocodes: false,
                          experience_date_id: null,
                        },
                      ])
                    }
                    className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                  >
                    + Add Ticket
                  </button>
                </div>

                <div className="space-y-4">
                  {tickets.map((t, idx) => (
                    <div key={t.id} className="rounded-2xl border border-gray-200 bg-[#FBFBFE] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold text-purple-700">Ticket {idx + 1}</p>
                        <button
                          type="button"
                          onClick={() => setTickets((prev) => prev.filter((x) => x.id !== t.id))}
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <Field label="Name">
                          <input
                            value={t.name}
                            onChange={(e) =>
                              setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Price">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={t.price}
                            onChange={(e) =>
                              setTickets((prev) =>
                                prev.map((x) => (x.id === t.id ? { ...x, price: Number(e.target.value || 0) } : x))
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Max per user">
                          <input
                            type="number"
                            min={1}
                            value={t.max_per_user}
                            onChange={(e) =>
                              setTickets((prev) =>
                                prev.map((x) => (x.id === t.id ? { ...x, max_per_user: Number(e.target.value || 1) } : x))
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Min per order (optional)">
                          <input
                            type="number"
                            min={1}
                            value={t.min_per_order ?? ""}
                            onChange={(e) =>
                              setTickets((prev) =>
                                prev.map((x) =>
                                  x.id === t.id ? { ...x, min_per_order: e.target.value ? Number(e.target.value) : null } : x
                                )
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Sales start (ISO optional)">
                          <input
                            value={t.sales_start ?? ""}
                            onChange={(e) =>
                              setTickets((prev) =>
                                prev.map((x) => (x.id === t.id ? { ...x, sales_start: e.target.value || null } : x))
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                            placeholder="2026-02-01T00:00:00Z"
                          />
                        </Field>

                        <Field label="Sales end (ISO optional)">
                          <input
                            value={t.sales_end ?? ""}
                            onChange={(e) =>
                              setTickets((prev) =>
                                prev.map((x) => (x.id === t.id ? { ...x, sales_end: e.target.value || null } : x))
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                            placeholder="2026-02-10T00:00:00Z"
                          />
                        </Field>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4 text-xs">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={t.allow_xp}
                            onChange={(e) =>
                              setTickets((prev) =>
                                prev.map((x) => (x.id === t.id ? { ...x, allow_xp: e.target.checked } : x))
                              )
                            }
                          />
                          Allow XP
                        </label>

                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={t.allow_corporate}
                            onChange={(e) =>
                              setTickets((prev) =>
                                prev.map((x) => (x.id === t.id ? { ...x, allow_corporate: e.target.checked } : x))
                              )
                            }
                          />
                          Corporate seats
                        </label>

                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={t.allow_promocodes}
                            onChange={(e) =>
                              setTickets((prev) =>
                                prev.map((x) => (x.id === t.id ? { ...x, allow_promocodes: e.target.checked } : x))
                              )
                            }
                          />
                          Promo codes
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeTab === "policies" && (
              <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">No-show / Late entry (NOH)</h2>

                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="No-show grace minutes">
                    <input
                      type="number"
                      min={0}
                      value={noh.no_show_grace_minutes}
                      onChange={(e) => setNoh((p) => ({ ...p, no_show_grace_minutes: Number(e.target.value || 0) }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                    />
                  </Field>

                  <Field label="No-show penalty type">
                    <select
                      value={noh.no_show_penalty_type}
                      onChange={(e) => setNoh((p) => ({ ...p, no_show_penalty_type: e.target.value as any }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                    >
                      <option value="none">none</option>
                      <option value="partial">partial</option>
                      <option value="full">full</option>
                    </select>
                  </Field>

                  <Field label="No-show penalty value (optional)">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={noh.no_show_penalty_value ?? ""}
                      onChange={(e) =>
                        setNoh((p) => ({ ...p, no_show_penalty_value: e.target.value ? Number(e.target.value) : null }))
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                    />
                  </Field>

                  <Field label="Lock entry after minutes (optional)">
                    <input
                      type="number"
                      min={0}
                      value={noh.lock_entry_after_minutes ?? ""}
                      onChange={(e) =>
                        setNoh((p) => ({ ...p, lock_entry_after_minutes: e.target.value ? Number(e.target.value) : null }))
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                    />
                  </Field>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={noh.allow_late_entry}
                      onChange={(e) => setNoh((p) => ({ ...p, allow_late_entry: e.target.checked }))}
                    />
                    Allow late entry
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={noh.auto_mark_no_show}
                      onChange={(e) => setNoh((p) => ({ ...p, auto_mark_no_show: e.target.checked }))}
                    />
                    Auto mark no-show
                  </label>
                </div>

                <div className="mt-3 max-w-xs">
                  <Field label="Late entry grace minutes">
                    <input
                      type="number"
                      min={0}
                      value={noh.late_entry_grace_minutes ?? 0}
                      onChange={(e) => setNoh((p) => ({ ...p, late_entry_grace_minutes: Number(e.target.value || 0) }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                    />
                  </Field>
                </div>
              </section>
            )}
          </div>

          {/* Saving overlay (optional) */}
          {saving && (
            <div className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-black/10 sm:flex">
              <div className="pointer-events-auto rounded-2xl bg-white px-6 py-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <ClipLoader size={18} color="#6B46C1" />
                  <span className="text-xs font-semibold text-gray-800">Saving…</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals (match Services style) */}
      <AppModal
        open={showTitleErrorModal}
        title="Title Required"
        message={
          <>
            Please enter an <span className="font-medium text-[#5B33FF]">experience title</span> before saving.
          </>
        }
        primaryLabel="Go to Details"
        onPrimaryClick={() => {
          setShowTitleErrorModal(false);
          setActiveTab("details");
          detailsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onClose={() => setShowTitleErrorModal(false)}
      />

      <AppModal
        open={showCategoryErrorModal}
        title="Category Required"
        message={
          <>
            To <span className="font-medium text-[#5B33FF]">publish</span> this experience, please add at least one
            category.
          </>
        }
        primaryLabel="Go to Discovery"
        onPrimaryClick={() => {
          setShowCategoryErrorModal(false);
          setActiveTab("details");
          discoverySectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onClose={() => setShowCategoryErrorModal(false)}
      />
    </div>
  );
}

/* ---------- Small UI helpers ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-gray-800">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ChipInput({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");

  function commit() {
    const v = value.trim();
    if (!v) return;
    if (!items.includes(v)) onChange([...items, v]);
    setValue("");
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white px-2 py-2">
      {items.map((it) => (
        <span
          key={it}
          className="inline-flex items-center gap-1 rounded-full bg-[#EFEDFF] px-3 py-1 text-xs font-medium text-gray-800"
        >
          {it}
          <button
            type="button"
            className="ml-1 text-[10px] text-gray-500 hover:text-gray-800"
            onClick={() => onChange(items.filter((x) => x !== it))}
          >
            ✕
          </button>
        </span>
      ))}

      <input
        className="min-w-[120px] flex-1 border-none bg-transparent px-2 py-1 text-xs focus:outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !value && items.length > 0) {
            onChange(items.slice(0, -1));
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}
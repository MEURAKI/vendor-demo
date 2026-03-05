// app/pages/experiences/[experienceId]/edit/page.tsx
"use client";

import { useVendorProfile } from "../../../../../context/VendorShellContext";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import clsx from "clsx";
import ClipLoader from "react-spinners/ClipLoader";

import { supabase } from "../../../../../lib/supabase/client";
import AppModal from "../../../../../components/common/AppModal";
import { uploadProviderImage } from "../../../../../lib/uploadProviderImage";

type ExperienceStatus = "draft" | "published" | "cancelled";
type DateStatus = "draft" | "published" | "sold_out" | "cancelled";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed?: boolean;
};

type ExperienceDateRow = {
  id?: string;
  session_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  timezone: string;
  doors_open_time?: string | null;
  capacity: number;
  cutoff_hours: number;
  status: DateStatus;
};

type TicketRow = {
  id?: string;
  experience_date_id?: string | null; // nullable => global
  name: string;
  price: number;
  max_per_user: number;
  min_per_order?: number | null;
  sales_start?: string | null; // ISO
  sales_end?: string | null; // ISO
  allow_xp: boolean;
  allow_corporate: boolean;
  allow_promocodes: boolean;
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

type Experience = {
  id: string;
  title: string;
  short_description: string | null;
  full_description: string | null;

  categories: string[] | null;
  tags: string[] | null;

  cover_image_url: string | null;
  gallery_images: string[] | null;

  location_type: "online" | "in_person";
  address: string | null;
  map_link: string | null;

  host_name: string | null;
  host_profile: string | null;

  contact_email: string | null;
  contact_phone: string | null;

  refund_policy: string | null;

  status: ExperienceStatus;

  experience_dates?: ExperienceDateRow[];
  experience_tickets?: TicketRow[];
  experience_noh_policies?: NohPolicy[];
};

function uuid() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export default function EditExperiencePage() {
  const params = useParams<{ experienceId: string }>();
  const experienceId = params?.experienceId;
  const router = useRouter();

  // sidebar
  const [profile, setProfile] = useState<Profile | null>(null);

  // ui
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // modals (match services vibe)
  const [showTitleErrorModal, setShowTitleErrorModal] = useState(false);
  const [showCategoryErrorModal, setShowCategoryErrorModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const detailsRef = useRef<HTMLDivElement | null>(null);
  const discoveryRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<"details" | "dates" | "tickets" | "policies">(
    "details"
  );

  // form
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [status, setStatus] = useState<ExperienceStatus>("draft");

  // switch to arrays + chip input (same style as new/service)
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // images (same UX as services/new)
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

  // children
  const [dates, setDates] = useState<ExperienceDateRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);

  const [noh, setNoh] = useState<NohPolicy>({
    no_show_grace_minutes: 0,
    no_show_penalty_type: "none",
    no_show_penalty_value: null,
    allow_late_entry: false,
    late_entry_grace_minutes: 0,
    auto_mark_no_show: true,
    lock_entry_after_minutes: null,
  });

  const canSave = useMemo(() => title.trim().length > 0, [title]);
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

  async function load() {
    if (!experienceId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/experiences/${experienceId}`, { method: "GET" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load experience");

      const exp = json.experience as Experience;

      setTitle(exp.title ?? "");
      setShortDescription(exp.short_description ?? "");
      setFullDescription(exp.full_description ?? "");
      setStatus(exp.status ?? "draft");

      setCategories(exp.categories ?? []);
      setTags(exp.tags ?? []);

      // normalize images into [cover, ...gallery]
      const cover = exp.cover_image_url ?? "";
      const gallery = exp.gallery_images ?? [];
      const merged = [cover, ...gallery].filter(Boolean);
      setImages(merged.slice(0, 6));

      setLocationType(exp.location_type ?? "in_person");
      setAddress(exp.address ?? "");
      setMapLink(exp.map_link ?? "");

      setHostName(exp.host_name ?? "");
      setHostProfile(exp.host_profile ?? "");

      setContactEmail(exp.contact_email ?? "");
      setContactPhone(exp.contact_phone ?? "");

      setRefundPolicy(exp.refund_policy ?? "");

      setDates(
        (exp.experience_dates ?? []).map((d) => ({
          ...d,
          capacity: Number(d.capacity ?? 0),
          cutoff_hours: Number(d.cutoff_hours ?? 0),
          status: (d.status as DateStatus) ?? "draft",
        }))
      );

      setTickets(
        (exp.experience_tickets ?? []).map((t) => ({
          ...t,
          price: Number(t.price ?? 0),
          max_per_user: Number(t.max_per_user ?? 4),
          allow_xp: !!t.allow_xp,
          allow_corporate: !!t.allow_corporate,
          allow_promocodes: !!t.allow_promocodes,
        }))
      );

      const p = exp.experience_noh_policies?.[0];
      if (p) {
        setNoh({
          no_show_grace_minutes: p.no_show_grace_minutes ?? 0,
          no_show_penalty_type: p.no_show_penalty_type ?? "none",
          no_show_penalty_value: p.no_show_penalty_value ?? null,
          allow_late_entry: p.allow_late_entry ?? false,
          late_entry_grace_minutes: p.late_entry_grace_minutes ?? 0,
          auto_mark_no_show: p.auto_mark_no_show ?? true,
          lock_entry_after_minutes: p.lock_entry_after_minutes ?? null,
        });
      }
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experienceId]);

  async function handleImageUpload(files: FileList | null) {
    if (!files || !files.length) return;
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const url = await uploadProviderImage(file);
      if (url) newUrls.push(url);
    }
    setImages((prev) => [...prev, ...newUrls].slice(0, 6));
  }

  async function handleSave() {
    if (!experienceId || saving) return;

    if (!canSave) {
      setShowTitleErrorModal(true);
      setActiveTab("details");
      return;
    }

    if (status === "published" && categories.length === 0) {
      setShowCategoryErrorModal(true);
      setActiveTab("details");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/experiences/${experienceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience: {
            title: title.trim(),
            short_description: shortDescription || null,
            full_description: fullDescription || null,
            status,

            categories,
            tags,

            cover_image_url: coverImageUrl || null,
            gallery_images: images.slice(1),

            location_type: locationType,
            address: locationType === "in_person" ? address || null : null,
            map_link: locationType === "in_person" ? mapLink || null : null,

            host_name: hostName || null,
            host_profile: hostProfile || null,

            contact_email: contactEmail || null,
            contact_phone: contactPhone || null,

            refund_policy: refundPolicy || null,
          },
          dates,
          tickets,
          noh_policy: noh,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");

      await load();
      // keep your existing behavior, but you can swap this for a toast later
      alert("Saved!");
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!experienceId || deleting) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/experiences/${experienceId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete");

      router.push("/pages/experiences");
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
            <ClipLoader size={40} color="#6B46C1" />
          </div>
    );
  }

  return (
    <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <div>
              <h1 className="text-xl font-semibold text-[#1B1529]">Edit experience</h1>
              <p className="text-xs text-gray-600">Update details, sessions & ticket types.</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                disabled={deleting}
                className={clsx(
                  "h-9 rounded-full border px-4 text-xs font-medium",
                  deleting ? "border-gray-200 bg-gray-100 text-gray-400" : "border-red-200 bg-red-50 text-red-700"
                )}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave || saving}
                className={clsx(
                  "h-9 rounded-full px-6 text-xs font-semibold text-white",
                  canSave && !saving ? "bg-black hover:bg-gray-900" : "cursor-not-allowed bg-gray-300"
                )}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 px-8 pt-6">
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

          {/* Error */}
          {error && (
            <div className="mx-8 mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-auto px-6 py-6">
            {activeTab === "details" && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,2.4fr)_minmax(320px,1fr)]">
                {/* LEFT */}
                <div className="space-y-6" ref={detailsRef}>
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

                      <div className="grid gap-3 md:grid-cols-2">
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
                        <label className="text-[11px] font-semibold text-gray-800">Short description</label>
                        <textarea
                          rows={3}
                          value={shortDescription}
                          onChange={(e) => setShortDescription(e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-gray-800">Full description</label>
                        <textarea
                          rows={6}
                          value={fullDescription}
                          onChange={(e) => setFullDescription(e.target.value)}
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

                      <div>
                        <label className="text-[11px] font-semibold text-gray-800">Host profile</label>
                        <textarea
                          rows={3}
                          value={hostProfile}
                          onChange={(e) => setHostProfile(e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
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
                      </div>
                    </div>
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
                <div className="space-y-6" ref={discoveryRef}>
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

                  <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                    <h2 className="mb-4 text-sm font-semibold text-gray-900">Discovery</h2>

                    <div className="space-y-4 text-xs">
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
                          id: uuid(),
                          session_date: "",
                          start_time: "09:00",
                          end_time: "10:00",
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
                    <div key={d.id ?? `${idx}-${d.session_date}`} className="rounded-2xl border border-gray-200 bg-[#FBFBFE] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold text-purple-700">Session {idx + 1}</p>
                        <button
                          type="button"
                          onClick={() => setDates((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <Field label="Date">
                          <input
                            type="date"
                            value={d.session_date}
                            onChange={(e) =>
                              setDates((prev) => prev.map((x, i) => (i === idx ? { ...x, session_date: e.target.value } : x)))
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Start">
                          <input
                            type="time"
                            value={d.start_time}
                            onChange={(e) =>
                              setDates((prev) => prev.map((x, i) => (i === idx ? { ...x, start_time: e.target.value } : x)))
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="End">
                          <input
                            type="time"
                            value={d.end_time}
                            onChange={(e) =>
                              setDates((prev) => prev.map((x, i) => (i === idx ? { ...x, end_time: e.target.value } : x)))
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Timezone">
                          <input
                            value={d.timezone}
                            onChange={(e) =>
                              setDates((prev) => prev.map((x, i) => (i === idx ? { ...x, timezone: e.target.value } : x)))
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Doors open (optional)">
                          <input
                            type="time"
                            value={d.doors_open_time ?? ""}
                            onChange={(e) =>
                              setDates((prev) => prev.map((x, i) => (i === idx ? { ...x, doors_open_time: e.target.value || null } : x)))
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Status">
                          <select
                            value={d.status}
                            onChange={(e) =>
                              setDates((prev) => prev.map((x, i) => (i === idx ? { ...x, status: e.target.value as DateStatus } : x)))
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
                              setDates((prev) => prev.map((x, i) => (i === idx ? { ...x, capacity: Number(e.target.value || 0) } : x)))
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
                              setDates((prev) => prev.map((x, i) => (i === idx ? { ...x, cutoff_hours: Number(e.target.value || 0) } : x)))
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
                          id: uuid(),
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
                    <div key={t.id ?? `${idx}-${t.name}`} className="rounded-2xl border border-gray-200 bg-[#FBFBFE] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold text-purple-700">Ticket {idx + 1}</p>
                        <button
                          type="button"
                          onClick={() => setTickets((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <Field label="Name">
                          <input
                            value={t.name}
                            onChange={(e) => setTickets((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Price">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={t.price}
                            onChange={(e) => setTickets((prev) => prev.map((x, i) => (i === idx ? { ...x, price: Number(e.target.value || 0) } : x)))}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Max per user">
                          <input
                            type="number"
                            min={1}
                            value={t.max_per_user}
                            onChange={(e) => setTickets((prev) => prev.map((x, i) => (i === idx ? { ...x, max_per_user: Number(e.target.value || 1) } : x)))}
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
                                prev.map((x, i) =>
                                  i === idx ? { ...x, min_per_order: e.target.value ? Number(e.target.value) : null } : x
                                )
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          />
                        </Field>

                        <Field label="Sales start (ISO optional)">
                          <input
                            value={t.sales_start ?? ""}
                            onChange={(e) => setTickets((prev) => prev.map((x, i) => (i === idx ? { ...x, sales_start: e.target.value || null } : x)))}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                            placeholder="2026-02-01T00:00:00Z"
                          />
                        </Field>

                        <Field label="Sales end (ISO optional)">
                          <input
                            value={t.sales_end ?? ""}
                            onChange={(e) => setTickets((prev) => prev.map((x, i) => (i === idx ? { ...x, sales_end: e.target.value || null } : x)))}
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
                              setTickets((prev) => prev.map((x, i) => (i === idx ? { ...x, allow_xp: e.target.checked } : x)))
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
                                prev.map((x, i) => (i === idx ? { ...x, allow_corporate: e.target.checked } : x))
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
                                prev.map((x, i) => (i === idx ? { ...x, allow_promocodes: e.target.checked } : x))
                              )
                            }
                          />
                          Promo codes
                        </label>
                      </div>

                      <div className="mt-3">
                        <Field label="Applies to date (optional)">
                          <select
                            value={t.experience_date_id ?? ""}
                            onChange={(e) =>
                              setTickets((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, experience_date_id: e.target.value || null } : x))
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                          >
                            <option value="">Global (all dates)</option>
                            {dates.map((d, di) => (
                              <option key={`${di}-${d.session_date}-${d.start_time}`} value={d.id ?? ""} disabled={!d.id}>
                                {d.id ? `${d.session_date} ${d.start_time}-${d.end_time}` : "(Save first to attach per-date tickets)"}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <p className="mt-1 text-[11px] text-gray-500">
                          To attach a ticket to a specific date, that date must already exist in DB (has an id). Save once, then set this.
                        </p>
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
                      disabled={!noh.allow_late_entry}
                    />
                  </Field>
                </div>
              </section>
            )}
          </div>

      {/* Title modal */}
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
          detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onClose={() => setShowTitleErrorModal(false)}
      />

      {/* Category modal */}
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
          discoveryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onClose={() => setShowCategoryErrorModal(false)}
      />

      {/* Delete confirm modal (instead of confirm()) */}
      <AppModal
        open={showDeleteModal}
        title="Delete experience?"
        message={
          <>
            This action <span className="font-semibold text-red-700">cannot be undone</span>. Are you sure you want to
            delete this experience?
          </>
        }
        primaryLabel={deleting ? "Deleting…" : "Yes, delete"}
        onPrimaryClick={handleDeleteConfirmed}
        onClose={() => (!deleting ? setShowDeleteModal(false) : null)}
      />
    </>
  );
}

/* ---------- Helpers (same as new/service style) ---------- */

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
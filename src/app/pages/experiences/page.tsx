// app/pages/experiences/page.tsx
"use client";

import { useVendorProfile } from "../../../context/VendorShellContext";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";

import { supabase } from "../../../lib/supabase/client";
import ClipLoader from "react-spinners/ClipLoader";
import AppModal from "../../../components/common/AppModal";

/* ---------- Types ---------- */

type UserStatus = "active" | "inactive" | "pending";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed?: boolean;
  full_name: string | null;
};

type ExperienceStatus = "draft" | "published" | "cancelled";

type ExperienceDate = {
  id: string;
  session_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm:ss or HH:mm
  end_time: string;
  status: string;
};

type ExperienceRow = {
  id: string;
  title: string;
  short_description: string | null;
  status: ExperienceStatus;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  experience_dates: ExperienceDate[];
};

/* ---------- Helpers ---------- */

function toComparableDateTime(d: { session_date: string; start_time: string }) {
  // Safe string comparable if session_date is YYYY-MM-DD and start_time starts with HH:mm
  const t = (d.start_time || "").slice(0, 5);
  return `${d.session_date}T${t}`;
}

function getNextSession(dates: ExperienceDate[] | undefined) {
  if (!dates?.length) return null;

  const sorted = [...dates]
    .filter((x) => x.session_date && x.start_time)
    .sort((a, b) => toComparableDateTime(a).localeCompare(toComparableDateTime(b)));

  // If you have statuses like "cancelled" on date-level, you can filter here.
  return sorted[0] ?? null;
}

function formatTimeHHmm(t: string) {
  if (!t) return "";
  return t.slice(0, 5);
}

function formatDateISO(d: string) {
  // Keep it simple (your current UI shows raw session_date)
  return d;
}

function statusPillClasses(status: ExperienceStatus) {
  if (status === "published") return "border-transparent bg-[#DCFCE7] text-[#166534]";
  if (status === "cancelled") return "border-transparent bg-[#FEE2E2] text-[#B91C1C]";
  return "border-transparent bg-[#E5E7EB] text-gray-700"; // draft
}

/* ---------- Main Page ---------- */

export default function ExperiencesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  const [rows, setRows] = useState<ExperienceRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // selection state (for future bulk actions)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // trash modal
  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const [experienceIdToTrash, setExperienceIdToTrash] = useState<string | null>(null);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [trashLoading, setTrashLoading] = useState(false);

  function openTrashModal(id: string) {
    setExperienceIdToTrash(id);
    setTrashError(null);
    setTrashModalOpen(true);
  }

  function closeTrashModal() {
    setTrashModalOpen(false);
    setExperienceIdToTrash(null);
    setTrashError(null);
  }

  // load profile for sidebar (same as Services)
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data } = await supabase
        .from("profiles")
        .select("id,email,full_name,status")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (data) setProfile(data as Profile);
    })();
  }, []);
  async function reloadExperiences() {
    setLoading(true);
    try {
      const res = await fetch("/api/experiences", { method: "GET" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Failed to load experiences", json);
        return;
      }

      const raw = (json as any).experiences ?? (json as any) ?? [];
      const mapped: ExperienceRow[] = (raw as any[]).map((x: any) => ({
        id: x.id,
        title: x.title,
        short_description: x.short_description ?? null,
        status: (x.status as ExperienceStatus) ?? "draft",
        cover_image_url: x.cover_image_url ?? null,
        created_at: x.created_at,
        updated_at: x.updated_at,
        experience_dates: Array.isArray(x.experience_dates) ? x.experience_dates : [],
      }));

      setRows(mapped);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadExperiences();
  }, []);

  const filteredRows = rows.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      (r.short_description ?? "").toLowerCase().includes(q)
    );
  });

  const allSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selectedIds.includes(r.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredRows.some((r) => r.id === id)));
    } else {
      const idsToAdd = filteredRows.map((r) => r.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
    }
  }

  function toggleRowSelection(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleEdit(id: string) {
    window.location.href = `/pages/experiences/${id}/edit`;
  }

  // inline status change (mirrors Services approach)
  async function handleStatusChange(experienceId: string, newStatus: ExperienceStatus) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/experiences/bulk-edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          experienceIds: [experienceId],
          status: newStatus,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error("Failed to update experience status", j);
        alert((j as any).error || "Failed to update experience status");
        return;
      }

      setRows((prev) =>
        prev.map((row) => (row.id === experienceId ? { ...row, status: newStatus } : row))
      );
    } catch (err) {
      console.error(err);
      alert("Error updating experience status");
    }
  }

  async function handleConfirmTrash() {
    if (!experienceIdToTrash) return;

    setTrashLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setTrashError("You are not logged in.");
        return;
      }

      // Adjust this endpoint if your API differs
      const res = await fetch(`/api/experiences/${experienceIdToTrash}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTrashError((data as any).error || "Failed to trash experience.");
        return;
      }

      closeTrashModal();
      await reloadExperiences();
      setSelectedIds([]);
    } finally {
      setTrashLoading(false);
    }
  }

  return (
    <div className="relative min-h-full flex-1 overflow-auto">
      {/* Background image */}
      <div className="absolute top-0 left-0 right-0 h-[420px] overflow-hidden pointer-events-none">
        <img src="/images/vendor bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-[#F6F6FC]" />
      </div>

      <div className="relative px-6 sm:px-8 py-6 sm:py-8 space-y-6">
        {/* Glass panel: header / search / filters */}
        <div className="rounded-3xl bg-white/[0.25] backdrop-blur-3xl border border-white/40 shadow-[0_22px_90px_rgba(124,58,237,0.35)] p-4 sm:p-6 xl:p-10">
          {/* ✅ MOBILE TOP BAR */}
          <div className="sm:hidden">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#1B1529]">
                    All Experiences
                  </div>
                  <div className="text-[11px] text-gray-500">{rows.length} experiences</div>
                </div>

                <button
                  type="button"
                  onClick={() => (window.location.href = "/pages/experiences/new")}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-lg text-white"
                  aria-label="Add experience"
                >
                  +
                </button>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search experience…"
                className="w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-[12px] text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#E9D8FD]"
              />

              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Select all
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={reloadExperiences}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ✅ DESKTOP TOP BAR */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#1B1529]">All Experiences</h1>
              <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
                {rows.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Experience"
                className="w-60 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#E9D8FD] transition-all"
              />

              <button
                type="button"
                onClick={reloadExperiences}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700"
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={() => (window.location.href = "/pages/experiences/new")}
                className="ml-2 flex h-10 w-10 items-center justify-center rounded-full bg-black text-xl text-white"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Content card */}
        <div className="rounded-2xl bg-white shadow-sm p-6 sm:p-6">
          {/* ✅ MOBILE CARD VIEW */}
          <div className="sm:hidden space-y-3">
              {loading ? (
                <div className="py-12 flex justify-center">
                  <ClipLoader size={40} color="#6B46C1" />
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="py-16 text-center text-xs text-gray-500">
                  No experiences found. Try adjusting your search.
                </div>
              ) : (
                filteredRows.map((row) => {
                  const nextSession = getNextSession(row.experience_dates);
                  return (
                    <div key={row.id} className="rounded-2xl border border-[#ECECFB] bg-white p-4">
                      <div className="flex gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => toggleRowSelection(row.id)}
                          className="mt-1 h-4 w-4 rounded border-gray-300"
                        />

                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 gap-3">
                              <div className="relative mt-0.5 h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-200">
                                {row.cover_image_url ? (
                                  <Image
                                    src={row.cover_image_url}
                                    alt={row.title}
                                    fill
                                    className="object-cover"
                                  />
                                ) : null}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-gray-900">
                                  {row.title}
                                </div>
                                {row.short_description ? (
                                  <div className="text-[11px] text-gray-500 line-clamp-2">
                                    {row.short_description}
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-gray-400">—</div>
                                )}

                                <div className="mt-2 flex flex-wrap gap-2">
                                  {nextSession ? (
                                    <span className="rounded-full bg-[#F3E8FF] px-3 py-1 text-[10px] font-semibold text-purple-700">
                                      Next: {formatDateISO(nextSession.session_date)}{" "}
                                      {formatTimeHHmm(nextSession.start_time)}
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-[#EFEDFF] px-3 py-1 text-[10px] font-semibold text-gray-700">
                                      No sessions
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <select
                              value={row.status}
                              onChange={(e) =>
                                handleStatusChange(row.id, e.target.value as ExperienceStatus)
                              }
                              className={clsx(
                                "rounded-full border px-3 py-1 text-[11px] font-semibold",
                                statusPillClasses(row.status)
                              )}
                            >
                              <option value="draft">Draft</option>
                              <option value="published">Published</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(row.id)}
                              className="flex-1 rounded-full bg-black py-2 text-[11px] font-semibold text-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openTrashModal(row.id)}
                              className="flex-1 rounded-full border border-gray-300 bg-white py-2 text-[11px] font-semibold text-gray-700"
                            >
                              Trash
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ✅ DESKTOP TABLE VIEW */}
            <div className="hidden sm:block">
              <div className="min-h-0 overflow-x-auto overflow-y-hidden rounded-2xl border border-[#ECECFB] bg-white">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-[#F6F5FF] text-[11px] font-semibold text-gray-500 shadow-sm">
                    <tr>
                      <th className="w-10 px-3 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </th>
                      <th className="px-3 py-3 text-left">Experience</th>
                      <th className="px-3 py-3 text-left">Description</th>
                      <th className="px-3 py-3 text-left">Next Session</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-3 py-3 text-left">Updated</th>
                      <th className="px-3 py-3 text-center">Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-xs text-gray-500">
                          <ClipLoader size={55} color="#6B46C1" />
                        </td>
                      </tr>
                    ) : filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center text-xs text-gray-500">
                          No experiences found. Try adjusting your search.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, idx) => {
                        const nextSession = getNextSession(row.experience_dates);
                        return (
                          <tr
                            key={row.id}
                            className={clsx("border-t border-gray-100", idx % 2 === 1 && "bg-[#FBFBFE]")}
                          >
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(row.id)}
                                onChange={() => toggleRowSelection(row.id)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                            </td>

                            <td className="px-3 py-3">
                              <div className="flex items-start gap-3">
                                <div className="relative mt-0.5 h-10 w-10 overflow-hidden rounded-xl bg-gray-200">
                                  {row.cover_image_url ? (
                                    <Image
                                      src={row.cover_image_url}
                                      alt={row.title}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : null}
                                </div>

                                <div className="space-y-1">
                                  <div className="text-xs font-semibold text-gray-900">{row.title}</div>
                                </div>
                              </div>
                            </td>

                            <td className="px-3 py-3 text-[11px] text-gray-700">
                              {row.short_description ? (
                                <div className="max-w-[360px] line-clamp-2">{row.short_description}</div>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td className="px-3 py-3 text-[11px] text-gray-700">
                              {nextSession ? (
                                <span className="rounded-full bg-[#F3E8FF] px-3 py-1 text-[10px] font-semibold text-purple-700">
                                  {formatDateISO(nextSession.session_date)} {formatTimeHHmm(nextSession.start_time)}
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-400">—</span>
                              )}
                            </td>

                            <td className="px-3 py-3 text-center">
                              <div className="relative inline-flex">
                                <select
                                  value={row.status}
                                  onChange={(e) =>
                                    handleStatusChange(row.id, e.target.value as ExperienceStatus)
                                  }
                                  className={clsx(
                                    "rounded-full border pl-3 pr-8 py-1.5 text-[11px] font-semibold focus:outline-none appearance-none",
                                    statusPillClasses(row.status)
                                  )}
                                >
                                  <option value="draft">Draft</option>
                                  <option value="published">Published</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
                                  ▾
                                </span>
                              </div>
                            </td>

                            <td className="px-3 py-3 text-[11px] text-gray-700">
                              {(row.updated_at || "").slice(0, 10) || "—"}
                            </td>

                            <td className="px-3 py-3 text-center">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(row.id)}
                                  className="rounded-full bg-black px-4 py-1.5 text-[11px] font-semibold text-white"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openTrashModal(row.id)}
                                  className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-[11px] text-gray-700"
                                >
                                  Trash
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* FOOTER SUMMARY */}
            <div className="mt-4 text-[11px] text-gray-500">
              Showing {filteredRows.length} of {rows.length} experiences
            </div>

            {/* Trash modal */}
            <AppModal
              open={trashModalOpen}
              title="Move experience to trash?"
              message={
                <div className="space-y-2 text-xs">
                  <p>This will remove the experience from your storefront.</p>
                  <p className="text-[11px] text-gray-500">
                    You can restore or recreate this experience later if needed.
                  </p>

                  {trashError && <p className="mt-2 text-[11px] text-red-600">{trashError}</p>}
                </div>
              }
              primaryLabel={trashLoading ? "Deleting..." : "Yes, move to trash"}
              onPrimaryClick={trashLoading ? undefined : handleConfirmTrash}
              onClose={trashLoading ? undefined : closeTrashModal}
            />
          </div>
        </div>
      </div>
  );
}
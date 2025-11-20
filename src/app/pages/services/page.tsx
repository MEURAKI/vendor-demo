// app/pages/services/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";

import Sidebar from "../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../components/sidebar/sidebar.config";
import { supabase } from "../../../lib/supabase/client";
import ClipLoader from "react-spinners/ClipLoader";
import AppModal from "../../../components/common/AppModal";
import { useAuthGuard } from "../../../hooks/useAuthGuard";

type ServiceStatus = "draft" | "active" | "unavailable";
type LocationType = "online" | "in_person";

type UserStatus = "active" | "inactive" | "pending";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};
type ProviderSummary = {
  id: string;
  name: string;
};

type ServiceRow = {
  id: string;
  name: string;
  typeLabel: string | null;
  locations: LocationType[];
  expiry: "fixed" | "anytime" | null;
  price: number | null;
  pricesCount: number; // 👈 NEW
  durationMinutes: number | null;
  minParticipants: number | null;  // 👈 NEW
  maxParticipants: number | null;
  ticketsSold: number | null;
  ticketsAvailable: number | null;
  status: ServiceStatus;
  coverImageUrl: string | null;
  providers: ProviderSummary[];
};


/* ---------- Bulk Upload Modal ---------- */

type BulkUploadModalProps = {
  open: boolean;
  onClose: () => void;
  onUploaded: () => Promise<void> | void;
};

function BulkUploadModal({ open, onClose, onUploaded }: BulkUploadModalProps) {
  const [servicesFile, setServicesFile] = useState<File | null>(null);
  const [spacesFile, setSpacesFile] = useState<File | null>(null);
  const [providersFile, setProvidersFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  if (!open) return null;

  async function uploadOne(
    file: File | null,
    endpoint: string,
    label: string
  ) {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch(endpoint, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: session?.access_token
          ? `Bearer ${session.access_token}`
          : "",
      },
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({} as any));
      throw new Error(
        j.error || `Bulk upload failed for ${label} (${endpoint})`
      );
    }
  }

  async function handleUpload() {
    if (!servicesFile && !spacesFile && !providersFile) {
      alert("Please choose at least one CSV file to upload.");
      return;
    }

    setUploading(true);
    try {
      await uploadOne(servicesFile, "/api/services/bulk-upload", "Services");
      await uploadOne(spacesFile, "/api/spaces/bulk-upload", "Spaces");
      await uploadOne(
        providersFile,
        "/api/providers/bulk-upload",
        "Providers"
      );

      await onUploaded();
      onClose();
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-gradient-to-br from-[#FFFFFF] via-[#F9F7FF] to-[#EEF2FF] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.55)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Bulk Import
            </div>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              Upload CSVs for Services, Spaces &amp; Providers
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              You can upload one, two, or all three at once. We’ll process each
              file and import your data.
            </p>
          </div>

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-60"
            onClick={onClose}
            disabled={uploading}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="mt-6 grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
          {/* Services */}
          <div className="group rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm transition hover:border-violet-400 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-900">
                Services CSV
              </div>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-[13px]">
                🧾
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Core service definitions (names, pricing, duration, etc.).
            </p>
            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-black">
              <span>{servicesFile ? "Change file" : "Choose file"}</span>
              <span className="text-[10px] opacity-80">.csv</span>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setServicesFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            {servicesFile && (
              <p className="mt-2 line-clamp-2 text-[11px] text-slate-600">
                Selected:{" "}
                <span className="font-medium">{servicesFile.name}</span>
              </p>
            )}
          </div>

          {/* Spaces */}
          <div className="group rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm transition hover:border-violet-400 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-900">Spaces CSV</div>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-[13px]">
                🏢
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Physical spaces / venues linked to your services.
            </p>
            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-black">
              <span>{spacesFile ? "Change file" : "Choose file"}</span>
              <span className="text-[10px] opacity-80">.csv</span>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setSpacesFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            {spacesFile && (
              <p className="mt-2 line-clamp-2 text-[11px] text-slate-600">
                Selected: <span className="font-medium">{spacesFile.name}</span>
              </p>
            )}
          </div>

          {/* Providers */}
          <div className="group rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm transition hover:border-violet-400 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-900">Providers CSV</div>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[13px]">
                👤
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Coaches / practitioners who deliver these services.
            </p>
            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-black">
              <span>{providersFile ? "Change file" : "Choose file"}</span>
              <span className="text-[10px] opacity-80">.csv</span>
              <input
                type="file"
                accept=".csv"
                onChange={(e) =>
                  setProvidersFile(e.target.files?.[0] ?? null)
                }
                className="hidden"
              />
            </label>
            {providersFile && (
              <p className="mt-2 line-clamp-2 text-[11px] text-slate-600">
                Selected:{" "}
                <span className="font-medium">{providersFile.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-7 flex items-center justify-between text-[11px]">
          <p className="text-slate-500">
            You can safely close this window after the upload completes.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={
                uploading || (!servicesFile && !spacesFile && !providersFile)
              }
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-slate-900 to-violet-600 px-6 py-2 text-[11px] font-semibold text-white shadow-[0_10px_30px_rgba(15,23,42,0.4)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
                  Uploading…
                </>
              ) : (
                <>
                  <span>Upload CSVs</span>
                  <span className="text-xs opacity-80">↗</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */

export default function ServicesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [bulkOpen, setBulkOpen] = useState(false);

  // modal state
const [trashModalOpen, setTrashModalOpen] = useState(false);
const [serviceIdToTrash, setServiceIdToTrash] = useState<string | null>(null);
const [trashError, setTrashError] = useState<string | null>(null);
const [trashLoading, setTrashLoading] = useState(false);

// open modal
function openTrashModal(serviceId: string) {
  setServiceIdToTrash(serviceId);
  setTrashError(null);
  setTrashModalOpen(true);
}

function closeTrashModal() {
  setTrashModalOpen(false);
  setServiceIdToTrash(null);
  setTrashError(null);
}

  const { checking } = useAuthGuard();

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <ClipLoader size={28} />
      </div>
    );
  }

  // load profile for sidebar
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

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? "",
        role: "Vendor",
       status: profile?.status ?? "active"
      }),
    [profile]
  );

  // function to (re)load services from API
async function reloadServices() {
  setLoading(true);
  try {
    const res = await fetch("/api/services");
    const json = await res.json();
    if (!res.ok) {
      console.error("Failed to load services", json);
      return;
    }

    const raw = json.services ?? json;
const mapped: ServiceRow[] = (raw as any[]).map((s) => {
  const locationsRaw = Array.isArray(s.locations) ? s.locations : [];

  // locationTypes (as before)
  const locationTypes: LocationType[] =
    Array.isArray(s.locationTypes) && s.locationTypes.length
      ? s.locationTypes
      : locationsRaw.map((loc: any) => loc.locationType).filter(Boolean);

  // PRICE VALUES (as we did before)
  const priceValues = locationsRaw
    .map((loc: any) => loc.priceCents)
    .filter((v: any) => typeof v === "number");

  const pricesCount = priceValues.length;
  const basePriceCentsFromLocations =
    priceValues.length > 0 ? Math.min(...priceValues) : undefined;

  // ✅ PARTICIPANTS FROM LOCATIONS
  const participantValues = locationsRaw
    .map((loc: any) => loc.maxParticipants ?? loc.max_participants)
    .filter((v: any) => typeof v === "number");

  let minParticipants: number | null = null;
  let maxParticipants: number | null = null;

  if (participantValues.length > 0) {
    minParticipants = Math.min(...participantValues);
    maxParticipants = Math.max(...participantValues);
  } else if (typeof s.maxParticipants === "number") {
    // fallback if API sends a flat maxParticipants
    minParticipants = s.maxParticipants;
    maxParticipants = s.maxParticipants;
  }

  return {
    id: s.id,
    name: s.name,
    typeLabel:
      (s.typeLabel as string | null) ??
      (Array.isArray(s.serviceTypes) && s.serviceTypes[0]) ??
      null,

    locations: locationTypes as LocationType[],
    expiry: (s.expiry as "fixed" | "anytime" | null) ?? null,

    price:
      typeof s.price === "number"
        ? s.price
        : typeof s.priceCents === "number"
        ? s.priceCents / 100
        : typeof basePriceCentsFromLocations === "number"
        ? basePriceCentsFromLocations / 100
        : null,

    pricesCount,

    durationMinutes:
      typeof s.durationMinutes === "number" ? s.durationMinutes : null,

    // ✅ use derived min/max participants
    minParticipants,
    maxParticipants,

    ticketsSold: typeof s.ticketsSold === "number" ? s.ticketsSold : null,
    ticketsAvailable:
      typeof s.ticketsAvailable === "number" ? s.ticketsAvailable : null,

    status: s.status as ServiceStatus,

    coverImageUrl:
      (s.imageUrl as string | null) ??
      (s.coverImageUrl as string | null) ??
      (s.cover_image_url as string | null) ??
      null,

    providers:
      (s.providers as ProviderSummary[]) ??
      (Array.isArray(s.provider_names)
        ? s.provider_names.map((name: string, idx: number) => ({
            id: `p-${idx}`,
            name,
          }))
        : []),
  };
});


    setRows(mapped);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
}


  // initial load
  useEffect(() => {
    void reloadServices();
  }, []);

  const filteredRows = rows.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const providerNames = r.providers.map((p) => p.name).join(" ").toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.typeLabel ?? "").toLowerCase().includes(q) ||
      providerNames.includes(q)
    );
  });

  function renderStatusChip(status: ServiceStatus) {
    if (status === "active") {
      return (
        <span className="inline-flex h-7 items.center rounded-full bg-[#DCFCE7] px-3 text-[11px] font-semibold text-[#166534]">
          Active
        </span>
      );
    }
    if (status === "unavailable") {
      return (
        <span className="inline-flex h-7 items-center rounded-full bg-[#FEE2E2] px-3 text-[11px] font-semibold text-[#B91C1C]">
          Unavailable
        </span>
      );
    }
    return (
      <span className="inline-flex h-7 items-center rounded-full bg-[#E5E7EB] px-3 text-[11px] font-semibold text-gray-700">
        Draft
      </span>
    );
  }

  function renderLocations(locations: LocationType[]) {
    if (!locations?.length)
      return <span className="text-[11px] text-gray-400">—</span>;
    return (
      <div className="flex flex-col gap-0.5 text-[11px]">
        {locations.map((loc) => (
          <button
            key={loc}
            type="button"
            className={clsx(
              "text-xs font-semibold underline",
              loc === "online" ? "text-[#6D28D9]" : "text-[#0EA5E9]"
            )}
          >
            {loc === "online" ? "Online" : "In-person"}
          </button>
        ))}
      </div>
    );
  }

  function renderExpiry(expiry: ServiceRow["expiry"]) {
    if (!expiry) return "—";
    return expiry === "fixed" ? "Fixed Dates" : "ANYTIME";
  }

  function renderDuration(minutes: number | null) {
    if (!minutes) return "—";
    if (minutes < 60) return `${minutes} mins`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (!mins) return `${hours} Hour${hours > 1 ? "s" : ""}`;
    return `${hours}h ${mins}m`;
  }

  function handleEdit(id: string) {
    window.location.href = `/pages/services/${id}/edit`;
  }

  async function handleConfirmTrash() {
  if (!serviceIdToTrash) return;

  setTrashLoading(true);
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setTrashError("You are not logged in.");
      return;
    }

    const res = await fetch(`/api/services/${serviceIdToTrash}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      setTrashError(data.error || "Failed to trash service.");
      return;
    }

    // success — close modal & refresh list
    closeTrashModal();
    window.location.reload(); // or router.refresh()
  } finally {
    setTrashLoading(false);
  }
}

  return (
    <div className="flex h-screen w-screen bg-[#050509] overflow-hidden">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* TOP BAR */}
          <div className="flex items-center justify-between border-b border-[#E5E0FF] bg-gradient.to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#1B1529]">
                All Services
              </h1>
              <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
                {rows.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700"
              >
                Bulk Actions
                <span>▾</span>
              </button>

              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700"
              >
                Filter by
                <span>▾</span>
              </button>


                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Service"
className="
      w-60
      rounded-full
      bg-white
      pl-11
      pr-4
      py-2
      text-xs
      text-gray-700
      shadow-sm
      border border-gray-200
      placeholder:text-gray-400
      focus:border-[#7C3AED]
      focus:ring-2 
      focus:ring-[#E9D8FD] 
      focus:outline-none
      transition-all
    "
             />

              {/* Bulk Upload Button */}
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700"
              >
                Bulk Upload CSV
              </button>

              {/* Add Single Service Button */}
              <button
                type="button"
                onClick={() => (window.location.href = "/pages/services/new")}
                className="ml-2 flex h-10 w-10 items-center justify-center rounded-full bg-black text-xl text-white"
              >
                +
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="flex-1 overflow-auto p-6">
            <div className="min-h-0 overflow-auto rounded-2xl border border-[#ECECFB] bg-white">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-10 bg-[#F6F5FF] text-[11px] font-semibold text-gray-500 shadow-sm">
                  <tr>
                    <th className="px-3 py-3 text-left">Service Name</th>
                    <th className="px-3 py-3 text-left">Type</th>
                    <th className="px-3 py-3 text-left">Locations</th>
                    <th className="px-3 py-3 text-left">Expiry</th>
                    <th className="px-3 py-3 text-left">Price</th>
                    <th className="px-3 py-3 text-left">Duration</th>
                    <th className="px-3 py-3 text-left">Max Participants</th>
                    <th className="px-3 py-3 text-left">Tickets Sold</th>
                    <th className="px-3 py-3 text-left">Tickets Available</th>
                    <th className="px-3 py-3 text-center">Availability</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-10 text-center text-xs text-gray-500"
                      >
                                <ClipLoader size={55} color="#6B46C1" />

                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-16 text-center text-xs text-gray-500"
                      >
                        No services found. Try adjusting your search.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={clsx(
                          "border-t border-gray-100",
                          idx % 2 === 1 && "bg-[#FBFBFE]"
                        )}
                      >
                        {/* NAME + PROVIDERS + IMAGE */}
                        <td className="px-3 py-3">
                          <div className="flex items-start gap-3">
                            <div className="relative mt-0.5 h-10 w-10 overflow-hidden rounded-xl bg-gray-200">
                              {row.coverImageUrl && (
                                <Image
                                  src={row.coverImageUrl}
                                  alt={row.name}
                                  fill
                                  className="object-cover"
                                />
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-gray-900">
                                {row.name}
                              </div>
                              <div className="space-y-0.5">
                                {row.providers.map((p) => (
                                  <div
                                    key={p.id}
                                    className="text-[11px] font-semibold text-[#6B21A8]"
                                  >
                                    By {p.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* TYPE */}
                        <td className="px-3 py-3 text-[11px] text-gray-700">
                          {row.typeLabel ?? "—"}
                        </td>

                        {/* LOCATIONS */}
                        <td className="px-3 py-3">
                          {renderLocations(row.locations)}
                        </td>

                        {/* EXPIRY */}
                        <td className="px-3 py-3 text-[11px] text-gray-700">
                          {renderExpiry(row.expiry)}
                        </td>

                        {/* PRICE */}
                        {/* PRICE + COUNT */}
<td className="px-3 py-3 text-[11px] text-gray-700">
  {row.price != null ? (
    <div className="flex flex-col leading-tight">
      <span>{`$${row.price.toFixed(2)}`}</span>
      {row.pricesCount > 1 && (
        <span className="text-[10px] text-gray-400">
          {row.pricesCount} prices
        </span>
      )}
    </div>
  ) : row.pricesCount > 0 ? (
    <span className="text-[10px] text-gray-400">
      {row.pricesCount} prices
    </span>
  ) : (
    "—"
  )}
</td>


                        {/* DURATION */}
                        <td className="px-3 py-3 text-[11px] text-gray-700">
                          {renderDuration(row.durationMinutes)}
                        </td>

                        {/* MAX PARTICIPANTS */}
                        <td className="px-3 py-3 text-[11px] text-gray-700">
  {row.maxParticipants != null ? (
    row.minParticipants != null &&
    row.minParticipants !== row.maxParticipants ? (
      // e.g. 10–100 Slots
      `${row.minParticipants}–${row.maxParticipants} Slots`
    ) : (
      // single value
      `${row.maxParticipants} Slot${
        row.maxParticipants === 1 ? "" : "s"
      }`
    )
  ) : (
    "—"
  )}
</td>


                        {/* TICKETS SOLD */}
                        <td className="px-3 py-3 text-[11px] text-gray-700">
                          {row.ticketsSold != null ? row.ticketsSold : "—"}
                        </td>

                        {/* TICKETS AVAILABLE */}
                        <td className="px-3 py-3 text-[11px] text-gray-700">
                          {row.ticketsAvailable != null
                            ? row.ticketsAvailable
                            : "—"}
                        </td>

                        {/* STATUS */}
                        <td className="px-3 py-3 text-center">
                          {renderStatusChip(row.status)}
                        </td>

                        {/* ACTIONS */}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <AppModal
  open={trashModalOpen}
  title="Move service to trash?"
  message={
    <div className="space-y-2 text-xs">
      <p>This will remove the service from your storefront.</p>
      <p className="text-[11px] text-gray-500">
        You can restore or recreate this service later if needed.
      </p>

      {trashError && (
        <p className="mt-2 text-[11px] text-red-600">{trashError}</p>
      )}
    </div>
  }
  primaryLabel={trashLoading ? "Deleting..." : "Yes, move to trash"}
  onPrimaryClick={trashLoading ? undefined : handleConfirmTrash}
  onClose={trashLoading ? undefined : closeTrashModal}
/>

            {/* FOOTER SUMMARY */}
            <div className="mt-4 text-[11px] text-gray-500">
              Showing {filteredRows.length} of {rows.length} services
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onUploaded={reloadServices}
      />
    </div>
  );
}
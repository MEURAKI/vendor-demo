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

/* ---------- Types ---------- */

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
  pricesCount: number;
  durationMinutes: number | null;
  minParticipants: number | null;
  maxParticipants: number | null;
  ticketsSold: number | null;
  ticketsAvailable: number | null;
  status: ServiceStatus;
  coverImageUrl: string | null;
  providers: ProviderSummary[];
};

type DiscountType = "fixed" | "percent" | null;

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

  const handleCancel = () => {
    if (uploading) return;

    // Clear selected files
    setSpacesFile(null);
    setProvidersFile(null);
    setServicesFile(null);

    // Close modal / drawer
    onClose();
  };

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
              Upload your CSVs in this order: Spaces → Providers → Services
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
          {/* Spaces (Step 1) */}
          <div className="group rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm transition hover:border-violet-400 hover:shadow-md">
            <div className="mb-1 text-[10px] font-semibold text-pink-600">
              Step 1 — Upload Spaces
            </div>

            <div className="flex items-center justify-between">
              <div className="font-semibold text-maroon-900">Spaces CSV</div>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-[13px]">
                🏢
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Physical spaces / venues linked to your services.
            </p>

            {/* template link */}
            <a
              href="/templates/spaces-template.csv"
              download
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 underline-offset-2 hover:underline"
            >
              ⬇ Download template
            </a>

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

          {/* Providers (Step 2) */}
          <div className="group rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm transition hover:border-violet-400 hover:shadow-md">
            <div className="mb-1 text-[10px] font-semibold text-red-600">
              Step 2 — Upload Providers
            </div>

            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-900">Providers CSV</div>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-[13px]">
                👤
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Coaches / practitioners who deliver these services.
            </p>

            {/* template link */}
            <a
              href="/templates/providers-template.csv"
              download
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 underline-offset-2 hover:underline"
            >
              ⬇ Download template
            </a>

            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-black">
              <span>{providersFile ? "Change file" : "Choose file"}</span>
              <span className="text-[10px] opacity-80">.csv</span>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setProvidersFile(e.target.files?.[0] ?? null)}
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

          {/* Services (Step 3) */}
          <div className="group rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm transition hover:border-violet-400 hover:shadow-md">
            <div className="mb-1 text-[10px] font-semibold text-violet-600">
              Step 3 — Upload Services
            </div>

            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-900">Services CSV</div>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-[13px]">
                🧾
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Core service definitions (names, pricing, duration, etc.).
            </p>

            {/* template link */}
            <a
              href="/templates/services-template.csv"
              download
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 underline-offset-2 hover:underline"
            >
              ⬇ Download template
            </a>

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
        </div>

        {/* Footer */}
        <div className="mt-7 flex items-center justify-between text-[11px]">
          <p className="text-slate-500">
            You can safely close this window after the upload completes.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
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

/* ---------- Bulk Edit Modal (price / discount / status) ---------- */

type BulkEditModalProps = {
  open: boolean;
  onClose: () => void;
  selectedRows: ServiceRow[];
  onApply: (payload: {
    serviceIds: string[];
    price?: number | null;
    discountType?: DiscountType;
    discountValue?: number | null;
    status?: ServiceStatus | null;
  }) => Promise<void> | void;
};

function BulkEditModal({
  open,
  onClose,
  selectedRows,
  onApply,
}: BulkEditModalProps) {
  const [priceEnabled, setPriceEnabled] = useState(false);
  const [price, setPrice] = useState<number | undefined>(undefined);

  const [discountType, setDiscountType] = useState<DiscountType>(null);
  const [discountValue, setDiscountValue] = useState<number | undefined>(
    undefined
  );

  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedCount = selectedRows.length;

  if (!open) return null;

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await onApply({
        serviceIds: selectedRows.map((r) => r.id),
        price: priceEnabled ? price ?? 0 : undefined,
        discountType,
        discountValue:
          discountType && typeof discountValue === "number"
            ? discountValue
            : undefined,
        status,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 px-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.55)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900">
              Bulk Editing
            </h2>
            <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
              {selectedCount}
            </span>
            <span className="text-xs text-gray-500">Services</span>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-9 items-center rounded-full bg-black px-5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>

        {/* Body */}
        <div className="grid gap-4 bg-[#F7F7FB] px-6 py-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)]">
          {/* Left column – pricing & discount + status */}
          <div className="space-y-4">
            {/* Pricing & Discount */}
            <section className="rounded-2xl bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Product Pricing &amp; Stock
              </h3>

              {/* Price */}
              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-800">
                    Price
                  </label>
                  <p className="text-[10px] text-gray-500">
                    Leave off if you don&apos;t want to change price.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={priceEnabled}
                    onChange={(e) => setPriceEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span>Update price</span>
                </label>
              </div>

              <div className="mt-2 flex items-center gap-1">
                <span className="inline-flex h-9 items-center rounded-2xl border border-gray-200 bg-white px-3 text-[11px] text-gray-500">
                  SGD
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!priceEnabled}
                  value={priceEnabled && typeof price === "number" ? price : ""}
                  onChange={(e) =>
                    setPrice(
                      e.target.value === "" ? undefined : Number(e.target.value)
                    )
                  }
                  className={clsx(
                    "h-9 flex-1 rounded-2xl border bg-[#FBFBFE] px-3 text-xs focus:border-purple-500 focus:outline-none",
                    priceEnabled ? "border-gray-200" : "border-dashed"
                  )}
                  placeholder="Leave unchanged"
                />
              </div>

              {/* Discount */}
              <div className="mt-5">
                <label className="text-[11px] font-semibold text-gray-800">
                  Discount
                </label>
                <div className="mt-2 flex items-center gap-1">
                  <div className="flex rounded-2xl border border-gray-200 bg-white text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setDiscountType(
                          discountType === "fixed" ? null : "fixed"
                        )
                      }
                      className={clsx(
                        "rounded-l-2xl px-3 py-1.5",
                        discountType === "fixed"
                          ? "bg-[#F5EBFF] text-purple-700"
                          : "text-gray-600"
                      )}
                    >
                      SGD
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDiscountType(
                          discountType === "percent" ? null : "percent"
                        )
                      }
                      className={clsx(
                        "rounded-r-2xl px-3 py-1.5",
                        discountType === "percent"
                          ? "bg-[#F5EBFF] text-purple-700"
                          : "text-gray-600"
                      )}
                    >
                      %
                    </button>
                  </div>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={!discountType}
                    value={
                      discountType && typeof discountValue === "number"
                        ? discountValue
                        : ""
                    }
                    onChange={(e) =>
                      setDiscountValue(
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value)
                      )
                    }
                    className={clsx(
                      "h-9 flex-1 rounded-2xl border bg-[#FBFBFE] px-3 text-xs focus:border-purple-500 focus:outline-none",
                      discountType ? "border-gray-200" : "border-dashed"
                    )}
                    placeholder="Leave unchanged"
                  />
                </div>
                <p className="mt-1 text-[10px] text-gray-500">
                  If no type is selected, discount will not be changed.
                </p>
              </div>
            </section>

            {/* Status */}
            <section className="rounded-2xl bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Change Status
              </h3>
              <p className="mt-1 text-[10px] text-gray-500">
                Choose a new status for all selected services, or leave
                unchanged.
              </p>

              <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
                {([
                  { value: null, label: "No change" },
                  { value: "draft", label: "In-Active" },
                  { value: "active", label: "Active" },
                ] as { value: ServiceStatus | null; label: string }[]).map(
                  (opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      className={clsx(
                        "h-9 rounded-full border px-3 text-[11px]",
                        status === opt.value
                          ? "border-black bg-black text-white"
                          : "border-gray-300 bg-[#F8FAFC] text-gray-700"
                      )}
                    >
                      {opt.label}
                    </button>
                  )
                )}
              </div>
            </section>
          </div>

          {/* Right column – summary of selected services */}
          <div className="space-y-4">
            <section className="rounded-2xl bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">
                You are editing {selectedCount} services
              </h3>
              <p className="mt-1 text-[10px] text-gray-500">
                These changes will apply to all selected services.
              </p>

              <div className="mt-3 flex max-h-52 flex-wrap gap-2 overflow-auto text-[11px]">
                {selectedRows.map((row) => (
                  <span
                    key={row.id}
                    className="inline-flex items-center gap-1 rounded-full bg-[#F3E8FF] px-3 py-1 text-[11px] text-gray-800"
                  >
                    {row.name}
                  </span>
                ))}
              </div>
            </section>
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
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  // selection state for bulk edit
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // trash modal state
  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const [serviceIdToTrash, setServiceIdToTrash] = useState<string | null>(null);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [trashLoading, setTrashLoading] = useState(false);

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

  // load profile for sidebar
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data } = await supabase
        .from('profiles')
        .select('id,email,full_name,status')
        .eq('id', auth.user.id)
        .maybeSingle();

      if (data) setProfile(data as Profile);
    })();
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name ?? '',
        email: profile?.email ?? '',
        role: 'Vendor',
        status: profile?.status ?? 'active',
      }),
    [profile]
  );

  // function to (re)load services from API
  async function reloadServices() {
    setLoading(true);
    try {
      const res = await fetch('/api/services');
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error('Failed to load services', json);
        return;
      }

      const raw = (json as any).services ?? json;

      const mapped: ServiceRow[] = (raw as any[]).map((s: any) => {
        const locationsRaw = Array.isArray(s.locations) ? s.locations : [];

        const locationTypes: LocationType[] =
          Array.isArray(s.locationTypes) && s.locationTypes.length
            ? s.locationTypes
            : locationsRaw.map((loc: any) => loc.locationType).filter(Boolean);

        const priceValues = locationsRaw
          .map((loc: any) => loc.priceCents)
          .filter((v: any) => typeof v === 'number');

        const pricesCount = priceValues.length;
        const basePriceCentsFromLocations =
          priceValues.length > 0 ? Math.min(...priceValues) : undefined;

        const participantValues = locationsRaw
          .map((loc: any) => loc.maxParticipants ?? loc.max_participants)
          .filter((v: any) => typeof v === 'number');

        let minParticipants: number | null = null;
        let maxParticipants: number | null = null;

        if (participantValues.length > 0) {
          minParticipants = Math.min(...participantValues);
          maxParticipants = Math.max(...participantValues);
        } else if (typeof s.maxParticipants === 'number') {
          minParticipants = s.maxParticipants;
          maxParticipants = s.maxParticipants;
        }

        const providers: ProviderSummary[] =
          Array.isArray(s.providers) && s.providers.length
            ? (s.providers as ProviderSummary[])
            : Array.isArray(s.provider_names)
              ? (s.provider_names as string[]).map((name: string, idx: number) => ({
                  id: `p-${idx}`,
                  name,
                }))
              : [];

        return {
          id: s.id,
          name: s.name,
          typeLabel:
            (s.typeLabel as string | null) ??
            (Array.isArray(s.serviceTypes) && s.serviceTypes[0]) ??
            null,
          locations: locationTypes,
          expiry: (s.expiry as 'fixed' | 'anytime' | null) ?? null,
          price:
            typeof s.price === 'number'
              ? s.price
              : typeof s.priceCents === 'number'
                ? s.priceCents / 100
                : typeof basePriceCentsFromLocations === 'number'
                  ? basePriceCentsFromLocations / 100
                  : null,
          pricesCount,
          durationMinutes: typeof s.durationMinutes === 'number' ? s.durationMinutes : null,
          minParticipants,
          maxParticipants,
          ticketsSold: typeof s.ticketsSold === 'number' ? s.ticketsSold : null,
          ticketsAvailable: typeof s.ticketsAvailable === 'number' ? s.ticketsAvailable : null,
          status: s.status as ServiceStatus,
          coverImageUrl:
            (s.imageUrl as string | null) ??
            (s.coverImageUrl as string | null) ??
            (s.cover_image_url as string | null) ??
            null,
          providers,
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
    const providerNames = r.providers.map((p) => p.name).join(' ').toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.typeLabel ?? '').toLowerCase().includes(q) ||
      providerNames.includes(q)
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

  function renderLocationsTable(locations: LocationType[]) {
    if (!locations?.length) return <span className="text-[11px] text-gray-400">—</span>;
    return (
      <div className="flex flex-col gap-0.5 text-[11px]">
        {locations.map((loc) => (
          <span
            key={loc}
            className={clsx(
              'text-xs font-semibold underline',
              loc === 'online' ? 'text-[#6D28D9]' : 'text-[#0EA5E9]'
            )}
          >
            {loc === 'online' ? 'Online' : 'In-person'}
          </span>
        ))}
      </div>
    );
  }

  function renderLocationsChips(locations: LocationType[]) {
    if (!locations?.length) return <span className="text-[11px] text-gray-400">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {locations.map((loc) => (
          <span
            key={loc}
            className={clsx(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
              loc === 'online' ? 'bg-[#EDE9FE] text-[#6D28D9]' : 'bg-[#E0F2FE] text-[#0369A1]'
            )}
          >
            {loc === 'online' ? 'Online' : 'In-person'}
          </span>
        ))}
      </div>
    );
  }

  function renderExpiry(expiry: ServiceRow['expiry']) {
    if (!expiry) return '—';
    return expiry === 'fixed' ? 'Fixed Dates' : 'ANYTIME';
  }

  function renderDuration(minutes: number | null) {
    if (!minutes) return '—';
    if (minutes < 60) return `${minutes} mins`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (!mins) return `${hours} Hour${hours > 1 ? 's' : ''}`;
    return `${hours}h ${mins}m`;
  }

  function renderParticipants(row: ServiceRow) {
    if (row.maxParticipants == null) return '—';
    if (row.minParticipants != null && row.minParticipants !== row.maxParticipants) {
      return `${row.minParticipants}–${row.maxParticipants} Slots`;
    }
    return `${row.maxParticipants} Slot${row.maxParticipants === 1 ? '' : 's'}`;
  }

  function handleEdit(id: string) {
    window.location.href = `/pages/services/${id}/edit`;
  }

  // inline status change
  async function handleStatusChange(serviceId: string, newStatus: ServiceStatus) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch('/api/services/bulk-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify({
          serviceIds: [serviceId],
          status: newStatus,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error('Failed to update service status', j);
        alert((j as any).error || 'Failed to update service status');
        return;
      }

      // update local state
      setRows((prev) => prev.map((row) => (row.id === serviceId ? { ...row, status: newStatus } : row)));
    } catch (err) {
      console.error(err);
      alert('Error updating service status');
    }
  }

  async function handleConfirmTrash() {
    if (!serviceIdToTrash) return;

    setTrashLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setTrashError('You are not logged in.');
        return;
      }

      const res = await fetch(`/api/services/${serviceIdToTrash}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTrashError((data as any).error || 'Failed to trash service.');
        return;
      }

      closeTrashModal();
      await reloadServices();
    } finally {
      setTrashLoading(false);
    }
  }

  // bulk apply handler
  async function handleBulkApply(payload: {
    serviceIds: string[];
    price?: number | null;
    discountType?: DiscountType;
    discountValue?: number | null;
    status?: ServiceStatus | null;
  }) {
    try {
      await fetch('/api/services/bulk-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      await reloadServices();
      setSelectedIds([]);
    } catch (err) {
      console.error('Bulk update failed', err);
      alert('Bulk update failed – check console for details.');
    }
  }

  const selectedRows = rows.filter((r) => selectedIds.includes(r.id));

  return (
    <div className="flex min-h-dvh w-full bg-white sm:bg-[#050509] overflow-x-hidden">

     {/* Sidebar: hidden on mobile, fixed on desktop */}
{/* Sidebar: fixed rail on mobile, normal on desktop */}
<div className="shrink-0">
  <Sidebar
    config={sidebarConfig}
    initialCollapsed={true}          // 👈 collapsed on mobile
    // variant="default"
    // disableFlyoutOnCollapsed={true}  // 👈 prevents overlay flyout
  />
</div>



      <div className="flex flex-1 items-stretch justify-center px-0 py-0 sm:px-6 sm:py-4">
        <div
          className="
            flex h-full w-full flex-col overflow-hidden bg-[#F6F6FC]
            rounded-none border-0 shadow-none
            sm:rounded-[32px] sm:border-[3px] sm:border-black sm:shadow-[0_24px_60px_rgba(0,0,0,0.7)]
          "
        >
          {/* ✅ MOBILE TOP BAR */}
          <div className="sm:hidden border-b border-[#E5E0FF] bg-white/90 backdrop-blur">
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#1B1529]">All Services</div>
                  <div className="text-[11px] text-gray-500">{rows.length} services</div>
                </div>

                <button
                  type="button"
                  onClick={() => (window.location.href = '/pages/services/new')}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-lg text-white"
                  aria-label="Add service"
                >
                  +
                </button>
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search service…"
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
                    disabled={selectedIds.length === 0}
                    onClick={() => setBulkEditOpen(true)}
                    className={clsx(
                      'rounded-full px-3 py-1.5 text-[11px] font-semibold',
                      selectedIds.length === 0 ? 'bg-gray-200 text-gray-400' : 'bg-black text-white'
                    )}
                  >
                    Bulk
                  </button>

                  <button
                    type="button"
                    onClick={() => setBulkUploadOpen(true)}
                    className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700"
                  >
                    CSV
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ✅ DESKTOP TOP BAR */}
          <div className="hidden sm:flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#1B1529]">All Services</h1>
              <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
                {rows.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={() => setBulkEditOpen(true)}
                className={clsx(
                  'inline-flex h-9 items-center gap-2 rounded-full border px-4 text-xs font-semibold',
                  selectedIds.length === 0
                    ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                    : 'border-gray-200 bg-white text-gray-700'
                )}
              >
                Bulk Actions <span>▾</span>
              </button>

              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700"
              >
                Filter by <span>▾</span>
              </button>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Service"
                className="w-60 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-[#7C3AED] focus:outline-none focus:ring-2 focus:ring-[#E9D8FD] transition-all"
              />

              <button
                type="button"
                onClick={() => setBulkUploadOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700"
              >
                Bulk Upload CSV
              </button>

              <button
                type="button"
                onClick={() => (window.location.href = '/pages/services/new')}
                className="ml-2 flex h-10 w-10 items-center justify-center rounded-full bg-black text-xl text-white"
              >
                +
              </button>
            </div>
          </div>

          {/* CONTENT */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-6">

            {/* ✅ MOBILE CARD VIEW */}
            <div className="sm:hidden space-y-3">
              {loading ? (
                <div className="py-12 flex justify-center">
                  <ClipLoader size={40} color="#6B46C1" />
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="py-16 text-center text-xs text-gray-500">No services found. Try adjusting your search.</div>
              ) : (
                filteredRows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-[#ECECFB] bg-white p-4">
                    <div className="flex gap-3">
                      {/* Selection */}
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleRowSelection(row.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300"
                      />

                      <div className="flex-1 space-y-3">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 gap-3">
                            <div className="relative mt-0.5 h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-200">
                              {row.coverImageUrl ? (
                                <Image src={row.coverImageUrl} alt={row.name} fill className="object-cover" />
                              ) : null}
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-gray-900">{row.name}</div>
                              {row.typeLabel ? (
                                <div className="text-[11px] text-gray-500">{row.typeLabel}</div>
                              ) : (
                                <div className="text-[11px] text-gray-400">—</div>
                              )}

                              {row.providers.map((p) => (
                                <div key={p.id} className="text-[11px] font-semibold text-[#6B21A8]">
                                  By {p.name}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Status */}
                          <select
                            value={row.status}
                            onChange={(e) => handleStatusChange(row.id, e.target.value as ServiceStatus)}
                            className={clsx(
                              'rounded-full border px-3 py-1 text-[11px] font-semibold',
                              row.status === 'active' && 'border-transparent bg-[#DCFCE7] text-[#166534]',
                              row.status === 'unavailable' && 'border-transparent bg-[#FEE2E2] text-[#B91C1C]',
                              row.status === 'draft' && 'border-transparent bg-[#E5E7EB] text-gray-700'
                            )}
                          >
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="unavailable">Unavailable</option>
                          </select>
                        </div>

                        {/* Locations */}
                        <div className="space-y-1">
                          <div className="text-[10px] font-semibold text-gray-400">Locations</div>
                          {renderLocationsChips(row.locations)}
                        </div>

                        {/* Meta grid */}
                        <div className="grid grid-cols-2 gap-3 text-[11px] text-gray-700">
                          <div>
                            <div className="text-gray-400">Expiry</div>
                            <div className="font-semibold">{renderExpiry(row.expiry)}</div>
                          </div>

                          <div>
                            <div className="text-gray-400">Duration</div>
                            <div className="font-semibold">{renderDuration(row.durationMinutes)}</div>
                          </div>

                          <div>
                            <div className="text-gray-400">Price</div>
                            <div className="font-semibold">
                              {row.price != null ? `$${row.price.toFixed(2)}` : '—'}
                              {row.pricesCount > 1 ? (
                                <span className="ml-1 text-[10px] text-gray-400">({row.pricesCount} prices)</span>
                              ) : null}
                            </div>
                          </div>

                          <div>
                            <div className="text-gray-400">Participants</div>
                            <div className="font-semibold">{renderParticipants(row)}</div>
                          </div>

                          <div>
                            <div className="text-gray-400">Tickets Sold</div>
                            <div className="font-semibold">{row.ticketsSold ?? '—'}</div>
                          </div>

                          <div>
                            <div className="text-gray-400">Tickets Available</div>
                            <div className="font-semibold">{row.ticketsAvailable ?? '—'}</div>
                          </div>
                        </div>

                        {/* Actions */}
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
                ))
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
                        <td colSpan={12} className="px-4 py-10 text-center text-xs text-gray-500">
                          <ClipLoader size={55} color="#6B46C1" />
                        </td>
                      </tr>
                    ) : filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-16 text-center text-xs text-gray-500">
                          No services found. Try adjusting your search.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row, idx) => (
                        <tr
                          key={row.id}
                          className={clsx('border-t border-gray-100', idx % 2 === 1 && 'bg-[#FBFBFE]')}
                        >
                          {/* selection checkbox */}
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(row.id)}
                              onChange={() => toggleRowSelection(row.id)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </td>

                          {/* NAME + PROVIDERS + IMAGE */}
                          <td className="px-3 py-3">
                            <div className="flex items-start gap-3">
                              <div className="relative mt-0.5 h-10 w-10 overflow-hidden rounded-xl bg-gray-200">
                                {row.coverImageUrl && (
                                  <Image src={row.coverImageUrl} alt={row.name} fill className="object-cover" />
                                )}
                              </div>

                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-gray-900">{row.name}</div>
                                <div className="space-y-0.5">
                                  {row.providers.map((p) => (
                                    <div key={p.id} className="text-[11px] font-semibold text-[#6B21A8]">
                                      By {p.name}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* TYPE */}
                          <td className="px-3 py-3 text-[11px] text-gray-700">{row.typeLabel ?? '—'}</td>

                          {/* LOCATIONS */}
                          <td className="px-3 py-3">{renderLocationsTable(row.locations)}</td>

                          {/* EXPIRY */}
                          <td className="px-3 py-3 text-[11px] text-gray-700">{renderExpiry(row.expiry)}</td>

                          {/* PRICE + COUNT */}
                          <td className="px-3 py-3 text-[11px] text-gray-700">
                            {row.price != null ? (
                              <div className="flex flex-col leading-tight">
                                <span>{`$${row.price.toFixed(2)}`}</span>
                                {row.pricesCount > 1 && (
                                  <span className="text-[10px] text-gray-400">{row.pricesCount} prices</span>
                                )}
                              </div>
                            ) : row.pricesCount > 0 ? (
                              <span className="text-[10px] text-gray-400">{row.pricesCount} prices</span>
                            ) : (
                              '—'
                            )}
                          </td>

                          {/* DURATION */}
                          <td className="px-3 py-3 text-[11px] text-gray-700">{renderDuration(row.durationMinutes)}</td>

                          {/* MAX PARTICIPANTS */}
                          <td className="px-3 py-3 text-[11px] text-gray-700">{renderParticipants(row)}</td>

                          {/* TICKETS SOLD */}
                          <td className="px-3 py-3 text-[11px] text-gray-700">{row.ticketsSold ?? '—'}</td>

                          {/* TICKETS AVAILABLE */}
                          <td className="px-3 py-3 text-[11px] text-gray-700">{row.ticketsAvailable ?? '—'}</td>

                          {/* STATUS */}
                          <td className="px-3 py-3 text-center">
                            <div className="relative inline-flex">
                              <select
                                value={row.status}
                                onChange={(e) => handleStatusChange(row.id, e.target.value as ServiceStatus)}
                                className={clsx(
                                  'rounded-full border pl-3 pr-8 py-1.5 text-[11px] font-semibold focus:outline-none appearance-none',
                                  row.status === 'active' && 'border-transparent bg-[#DCFCE7] text-[#166534]',
                                  row.status === 'unavailable' && 'border-transparent bg-[#FEE2E2] text-[#B91C1C]',
                                  row.status === 'draft' && 'border-transparent bg-[#E5E7EB] text-gray-700'
                                )}
                              >
                                <option value="draft">Draft</option>
                                <option value="active">Active</option>
                                <option value="unavailable">Unavailable</option>
                              </select>

                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
                                ▾
                              </span>
                            </div>
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
            </div>

            {/* FOOTER SUMMARY */}
            <div className="mt-4 text-[11px] text-gray-500">
              Showing {filteredRows.length} of {rows.length} services
            </div>

            {/* Trash modal */}
            <AppModal
              open={trashModalOpen}
              title="Move service to trash?"
              message={
                <div className="space-y-2 text-xs">
                  <p>This will remove the service from your storefront.</p>
                  <p className="text-[11px] text-gray-500">You can restore or recreate this service later if needed.</p>

                  {trashError && <p className="mt-2 text-[11px] text-red-600">{trashError}</p>}
                </div>
              }
              primaryLabel={trashLoading ? 'Deleting...' : 'Yes, move to trash'}
              onPrimaryClick={trashLoading ? undefined : handleConfirmTrash}
              onClose={trashLoading ? undefined : closeTrashModal}
            />
          </div>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onUploaded={reloadServices}
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        selectedRows={selectedRows}
        onApply={handleBulkApply}
      />
    </div>
  );
}

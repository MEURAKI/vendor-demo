"use client";

import { useVendorProfile } from "../../../../context/VendorShellContext";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";
import ClipLoader from "react-spinners/ClipLoader";
import AppModal from "../../../../components/common/AppModal";

type BundleStatus = "draft" | "active" | "out_of_stock";

type BundleRow = {
  id: string;
  name: string;
  type: "Single" | "Multiple";
  productsIncluded: number;
  sku: string;
  price: number;
  discountDisplay: string | null;
  status: BundleStatus;
  imageUrl?: string | null;
};

/* ---------------- Bulk Edit Modal ---------------- */

type BulkEditFormState = {
  price: string;
  status: BundleStatus | null;
};

interface BulkEditModalProps {
  open: boolean;
  onClose: () => void;
  selectedBundles: BundleRow[];
  onSaved: () => void;
}

function BulkEditModal({
  open,
  onClose,
  selectedBundles,
  onSaved,
}: BulkEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BulkEditFormState>({
    price: "",
    status: null,
  });

  useEffect(() => {
    if (open) {
      setForm({
        price: "",
        status: null,
      });
    }
  }, [open]);

  if (!open) return null;

  const bundleCount = selectedBundles.length;

  async function handleSave() {
    if (!bundleCount) return;
    setSaving(true);

    try {
      const body: any = {
        bundleIds: selectedBundles.map((b) => b.id),
      };

      if (form.price.trim() !== "") {
        body.priceCents = Math.round(Number(form.price || "0") * 100);
      }

      if (form.status) {
        body.status = form.status;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      await fetch("/api/bundles/bulk-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: session?.access_token
            ? `Bearer ${session.access_token}`
            : "",
        },
        body: JSON.stringify(body),
      });

      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Error saving bulk changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Bulk Edit Bundles</h2>
            <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
              {bundleCount} selected
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm hover:bg-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="grid max-h-[65vh] grid-cols-1 gap-4 overflow-auto px-6 py-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)] text-xs">
          {/* Left: price + status */}
          <div className="space-y-4">
            <section className="rounded-2xl bg-[#F8F7FF] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]">
              <h3 className="mb-3 text-sm font-semibold">Bundle Pricing</h3>
              <label className="mb-1 block text-[11px] font-medium text-gray-600">
                Price
              </label>
              <div className="flex items-center gap-1">
                <span className="inline-flex h-9 items-center rounded-xl border border-gray-200 bg-white px-3 text-[11px] text-gray-600">
                  SGD
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                  className="h-9 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                  placeholder="Leave blank to keep"
                />
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                If left blank, the existing bundle price will not be changed.
              </p>
            </section>

            <section className="rounded-2xl bg-[#F8F7FF] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]">
              <h3 className="mb-3 text-sm font-semibold">Change Status</h3>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {(
                  [
                    { value: "draft", label: "Draft" },
                    { value: "active", label: "Active" },
                    { value: "out_of_stock", label: "Out of Stock" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        status:
                          f.status === opt.value ? null : opt.value,
                      }))
                    }
                    className={clsx(
                      "inline-flex h-9 items-center rounded-full border px-4 font-medium",
                      form.status === opt.value
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-gray-700"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                If no status is selected, bundle status will not be changed.
              </p>
            </section>
          </div>

          {/* Right: list of bundles */}
          <div className="space-y-3">
            <section className="rounded-2xl bg-[#F8F7FF] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]">
              <h3 className="mb-2 text-sm font-semibold">
                You are editing {bundleCount} bundle
                {bundleCount === 1 ? "" : "s"}
              </h3>
              <div className="flex max-h-64 flex-wrap gap-2 overflow-auto text-[11px] text-gray-700">
                {selectedBundles.map((b) => (
                  <span
                    key={b.id}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm"
                  >
                    {b.name}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="mr-3 rounded-full border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !bundleCount}
            className="rounded-full bg-black px-6 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main Page ---------------- */

export default function AllBundlesPage() {
  const router = useRouter();
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState<any>(null);

  // selection for bulk edit
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedBundles = bundles.filter((b) => selectedIds.includes(b.id));
  const [bulkOpen, setBulkOpen] = useState(false);

  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const [bundleIdToTrash, setBundleIdToTrash] = useState<string | null>(null);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [trashLoading, setTrashLoading] = useState(false);

  function openTrashModal(bundleId: string) {
    setBundleIdToTrash(bundleId);
    setTrashError(null);
    setTrashModalOpen(true);
  }

  function closeTrashModal() {
    setTrashModalOpen(false);
    setBundleIdToTrash(null);
    setTrashError(null);
  }

  async function handleConfirmTrash() {
    if (!bundleIdToTrash) return;

    setTrashLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setTrashError("You are not logged in.");
        return;
      }

      const res = await fetch(`/api/bundles/${bundleIdToTrash}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("[Trash Error]", data);
        setTrashError(data.error || "Failed to delete bundle.");
        return;
      }

      closeTrashModal();
      await reloadBundles(); // refresh list
    } finally {
      setTrashLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id,email,status,onboarding_completed,full_name")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (mounted && prof) setProfile(prof);
      }

      await reloadBundles(mounted);
    }

    void init();
    return () => {
      mounted = false;
    };
  }, []);

  async function reloadBundles(mounted = true) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch("/api/bundles", {
      method: "GET",
      headers: {
        Authorization: session?.access_token
          ? `Bearer ${session.access_token}`
          : "",
      },
    });

    const data = await res.json();

    const mapped: BundleRow[] = (data.bundles ?? []).map((b: any) => ({
      id: String(b.id),
      name: b.name,
      type: b.type ?? "Multiple",
      productsIncluded: b.productsIncluded ?? 0,
      sku: b.sku,
      price: (b.priceCents ?? 0) / 100,
      discountDisplay: b.discountDisplay ?? null,
      status: b.status,
      imageUrl: b.imageUrl ?? null,
    }));

    if (mounted) {
      setBundles(mapped);
      setLoading(false);
      setSelectedIds([]); // reset selection after reload
    }
  }
  const filtered = bundles.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  // selection helpers
  const allVisibleIds = filtered.map((b) => b.id);
  const allSelectedOnPage =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selectedIds.includes(id));

  function toggleRow(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAllPage() {
    setSelectedIds((prev) =>
      allSelectedOnPage
        ? prev.filter((id) => !allVisibleIds.includes(id))
        : Array.from(new Set([...prev, ...allVisibleIds]))
    );
  }

  return (
    <>
          {/* Top bar */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#1B1529]">
                All Bundles
              </h1>
              <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
                {bundles.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Bulk actions */}
              <button
                type="button"
                onClick={() =>
                  selectedBundles.length && setBulkOpen(true)
                }
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-semibold shadow-sm",
                  selectedBundles.length
                    ? "border-black bg-black text-white"
                    : "border-gray-200 bg-white text-gray-700"
                )}
              >
                Bulk Actions
                {selectedBundles.length > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">
                    {selectedBundles.length}
                  </span>
                )}
                <span>▾</span>
              </button>

              {/* Filter skeleton (not wired yet) */}
              <button className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-[11px] font-semibold text-gray-700 shadow-sm">
                Filter by ▾
              </button>

              {/* Search */}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Bundle"
                className="w-60 rounded-full bg-white pl-4 pr-4 py-2 text-xs text-gray-700 shadow-sm border border-gray-200 placeholder:text-gray-400 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#E9D8FD] focus:outline-none transition-all"
              />

              <button
                type="button"
                onClick={() => router.push("/pages/products/bundles/new")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-lg font-semibold text-white shadow-md hover:bg-gray-900"
              >
                +
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-6">
            <div className="min-h-0 overflow-auto rounded-2xl border border-[#ECECFB] bg-white">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-20 bg-[#F6F5FF] text-[11px] font-semibold text-gray-500 shadow-sm">
                  <tr>
                    <th className="w-8 px-3 py-3">
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={allSelectedOnPage}
                        onChange={toggleSelectAllPage}
                      />
                    </th>
                    <th className="px-3 py-3 text-left">Bundle Name</th>
                    <th className="px-3 py-3 text-left">Type</th>
                    <th className="px-3 py-3 text-left">Products Included</th>
                    <th className="px-3 py-3 text-left">SKU</th>
                    <th className="px-3 py-3 text-right">Price</th>
                    <th className="px-3 py-3 text-right">Discount</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-10 text-center text-xs text-gray-500"
                      >
                        <ClipLoader
                          size={40}
                          color="#6B46C1"
                          cssOverride={{ animationDuration: "3s" }}
                        />
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-16 text-center text-xs text-gray-500"
                      >
                        No bundles found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((b, idx) => {
                      const checked = selectedIds.includes(b.id);
                      return (
                        <tr
                          key={b.id}
                          className={clsx(
                            "border-t border-gray-100",
                            idx % 2 === 1 && "bg-[#FBFBFE]"
                          )}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              className="h-3 w-3"
                              checked={checked}
                              onChange={() => toggleRow(b.id)}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-gray-200">
                                <Image
                                  src={
                                    b.imageUrl ||
                                    "/images/bundle-placeholder.svg"
                                  }
                                  alt={b.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                              <div className="text-xs font-semibold text-gray-900">
                                {b.name}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-[11px] text-gray-600">
                            {b.type}
                          </td>
                          <td className="px-3 py-3 text-[11px] text-gray-600">
                            {b.productsIncluded}
                          </td>
                          <td className="px-3 py-3 text-[11px] text-gray-600">
                            {b.sku}
                          </td>
                          <td className="px-3 py-3 text-right text-[11px] text-gray-800">
                            ${b.price.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-right text-[11px] text-gray-800">
                            {b.discountDisplay ? b.discountDisplay : "—"}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={clsx(
                                "inline-flex h-7 items-center rounded-full px-3 text-[11px] font-semibold",
                                b.status === "active" &&
                                  "bg-[#DCFCE7] text-[#166534]",
                                b.status === "draft" &&
                                  "bg-gray-200 text-gray-700",
                                b.status === "out_of_stock" &&
                                  "bg-[#FEE2E2] text-[#B91C1C]"
                              )}
                            >
                              {b.status === "out_of_stock"
                                ? "Out of Stock"
                                : b.status === "active"
                                ? "Active"
                                : "Draft"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                className="rounded-full bg-black px-4 py-1.5 text-[11px] font-semibold text-white"
                                onClick={() =>
                                  router.push(
                                    `/pages/products/bundles/${b.id}/edit`
                                  )
                                }
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => openTrashModal(b.id)}
                                className="rounded-full border border-gray-300 px-4 py-1.5 text-[11px] text-gray-700 hover:bg-red-50 hover:text-red-700 transition"
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

            <AppModal
              open={trashModalOpen}
              title="Move bundle to trash?"
              message={
                <div className="space-y-2 text-xs">
                  <p>
                    This will remove the bundle from your storefront. The
                    products themselves will not be deleted.
                  </p>
                  <p className="text-[11px] text-gray-500">
                    You can always create a new bundle with the same products
                    later.
                  </p>
                  {trashError && (
                    <p className="mt-2 text-[11px] text-red-600">
                      {trashError}
                    </p>
                  )}
                </div>
              }
              primaryLabel={trashLoading ? "Deleting..." : "Yes, move to trash"}
              onPrimaryClick={trashLoading ? undefined : handleConfirmTrash}
              onClose={trashLoading ? undefined : closeTrashModal}
            />

            <div className="mt-4 flex items-center justify-between text-[11px] text-gray-500">
              <span>Showing {filtered.length} bundles</span>
              <div className="space-x-2">
                <button className="rounded-full border border-gray-300 px-3 py-1">
                  &lt; Back
                </button>
                <button className="rounded-full border border-gray-300 px-3 py-1">
                  1
                </button>
                <button className="rounded-full border border-gray-300 px-3 py-1">
                  Next &gt;
                </button>
              </div>
            </div>
          </div>

      {/* Bulk edit modal */}
      <BulkEditModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        selectedBundles={selectedBundles}
        onSaved={() => reloadBundles()}
      />
    </>
  );
}
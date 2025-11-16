"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import Sidebar from "../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../components/sidebar/sidebar.config";
import { supabase } from "../../../lib/supabase/client";
import { error } from "console";

/* ---------- Types ---------- */

type ProductStatus = "draft" | "active" | "out_of_stock" | "published" | "inactive";

type ProductRow = {
  id: string;
  name: string;
  type: "Single" | "Variant";
  category: string;
  price: number;
  stock: number;
  sku: string;
  status: ProductStatus;
  variantCount: number;
  imageUrl?: string | null;
};

type VariantOptionValue = {
  id: string;
  label: string;
  colorHex?: string;
};

type VariantOptionGroup = {
  id: string;
  name: string;
  kind: "size" | "color" | "volume" | "weight" | "custom";
  values: VariantOptionValue[];
};

type ListVariantRow = {
  id: string;
  sku: string;
  price: number;
  inventory: number;
  imageUrl?: string | null;
  options_json: Record<string, string>;
};

type UserStatus = "active" | "inactive" | "pending";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

type DiscountType = "fixed" | "percent" | null;

/* ---------- Bulk edit modal ---------- */

type BulkEditFormState = {
  price: string;
  discountType: DiscountType;
  discountValue: string;
  discountStart: string;
  discountEnd: string;
  applyToAllVariants: boolean;
  status: ProductStatus | "trash" | null;
  wellness: string;
  categories: string;
  tags: string;
};

interface BulkEditModalProps {
  open: boolean;
  onClose: () => void;
  selectedProducts: ProductRow[];
  onSaved: () => void;
}

function BulkEditModal({
  open,
  onClose,
  selectedProducts,
  onSaved,
}: BulkEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BulkEditFormState>({
    price: "",
    discountType: null,
    discountValue: "",
    discountStart: "",
    discountEnd: "",
    applyToAllVariants: false,
    status: null,
    wellness: "",
    categories: "",
    tags: "",
  });

  useEffect(() => {
    if (open) {
      // reset when opened
      setForm({
        price: "",
        discountType: null,
        discountValue: "",
        discountStart: "",
        discountEnd: "",
        applyToAllVariants: false,
        status: null,
        wellness: "",
        categories: "",
        tags: "",
      });
    }
  }, [open]);

  if (!open) return null;

  const productCount = selectedProducts.length;

  async function handleSave() {
    if (!productCount) return;
    setSaving(true);

    try {
      const body: any = {
        productIds: selectedProducts.map((p) => p.id),
      };

      if (form.price.trim() !== "") {
        body.priceCents = Math.round(Number(form.price || "0") * 100);
      }

      if (form.discountType && form.discountValue.trim() !== "") {
        body.discount = {
          type: form.discountType,
          value: Number(form.discountValue || "0"),
          start: form.discountStart || null,
          end: form.discountEnd || null,
          applyToVariants: form.applyToAllVariants,
        };
      }

      if (form.status) {
        body.status = form.status === "trash" ? "draft" : form.status;
        body.trash = form.status === "trash";
      }

      if (form.wellness.trim() !== "") {
        body.wellness = form.wellness
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      }
      if (form.categories.trim() !== "") {
        body.categories = form.categories
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      }
      if (form.tags.trim() !== "") {
        body.tags = form.tags
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      }

      await fetch("/api/products/bulk-update", {
        method: "POST",
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
      <div className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-8 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Bulk Editing</h2>
            <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
              {productCount} Products
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 items-center justify-center rounded-full bg-black px-5 text-xs font-semibold text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="grid max-h-[70vh] grid-cols-1 gap-4 overflow-auto px-8 py-5 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)]">
          {/* Left side: pricing / status */}
          <div className="space-y-4">
            {/* Product Pricing & Stock */}
            <section className="rounded-2xl bg-[#F8F7FF] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.02)]">
              <h3 className="mb-3 text-sm font-semibold">
                Product Pricing &amp; Stock
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
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
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">
                    Discount
                  </label>
                  <div className="flex gap-1">
                    <select
                      value={form.discountType ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          discountType: (e.target.value ||
                            null) as DiscountType,
                        }))
                      }
                      className="h-9 w-20 rounded-xl border border-gray-200 bg-white px-2 text-[11px] focus:border-purple-500 focus:outline-none"
                    >
                      <option value="">None</option>
                      <option value="fixed">SGD</option>
                      <option value="percent">%</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.discountValue}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          discountValue: e.target.value,
                        }))
                      }
                      className="h-9 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">
                    Discount Start Date
                  </label>
                  <input
                    type="datetime-local"
                    value={form.discountStart}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, discountStart: e.target.value }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">
                    Discount End Date
                  </label>
                  <input
                    type="datetime-local"
                    value={form.discountEnd}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, discountEnd: e.target.value }))
                    }
                    className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-2 mt-1 flex items-center gap-2">
                  <input
                    id="apply-all-variants"
                    type="checkbox"
                    checked={form.applyToAllVariants}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        applyToAllVariants: e.target.checked,
                      }))
                    }
                    className="h-3 w-3"
                  />
                  <label
                    htmlFor="apply-all-variants"
                    className="text-[11px] text-gray-600"
                  >
                    Apply to all variants?{" "}
                    <span className="text-gray-400">
                      (Yes, include discounted variants)
                    </span>
                  </label>
                </div>
              </div>
            </section>

            {/* Change status */}
            <section className="rounded-2xl bg-[#F8F7FF] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.02)]">
              <h3 className="mb-3 text-sm font-semibold">Change Status</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  { value: "draft", label: "In-Active" },
                  { value: "active", label: "Active" },
                  { value: "out_of_stock", label: "Out of Stock" },
                  { value: "trash", label: "Trash" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        status:
                          f.status === opt.value ? null : (opt
                            .value as BulkEditFormState["status"]),
                      }))
                    }
                    className={clsx(
                      "inline-flex h-9 items-center rounded-full border px-4 text-[11px] font-medium",
                      form.status === opt.value
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-gray-700"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Selected products summary */}
            <section className="rounded-2xl bg-[#F8F7FF] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.02)]">
              <h3 className="mb-2 text-sm font-semibold">
                You are editing {productCount} products
              </h3>
              <div className="flex flex-wrap gap-2 text-[11px] text-gray-700">
                {selectedProducts.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm"
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </section>
          </div>

          {/* Right side: wellness / categories / tags */}
          <div className="space-y-4">
            <section className="rounded-2xl bg-[#F8F7FF] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.02)]">
              <h3 className="mb-3 text-sm font-semibold">
                Wellness Dimension, Category &amp; Tags
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">
                    Wellness Dimension
                  </label>
                  <input
                    placeholder="Choose 1 or more dimensions"
                    value={form.wellness}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, wellness: e.target.value }))
                    }
                    className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">
                    Categories
                  </label>
                  <input
                    placeholder="Choose 1 or more categories"
                    value={form.categories}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, categories: e.target.value }))
                    }
                    className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">
                    Tags
                  </label>
                  <input
                    placeholder="Use ',' to add more tags"
                    value={form.tags}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tags: e.target.value }))
                    }
                    className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t px-8 py-4">
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
            disabled={saving || !productCount}
            className="rounded-full bg-black px-6 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Variants modal from before (unchanged) ---------- */

interface ProductVariantsModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  optionGroups: VariantOptionGroup[];
  variants: ListVariantRow[];
  loading?: boolean;
  onChangeVariant?: (updated: ListVariantRow[]) => void;
  onSave?: (rows: ListVariantRow[]) => Promise<void> | void;
}

function ProductVariantsModal({
  open,
  onClose,
  productName,
  optionGroups,
  variants,
  loading = false,
  onChangeVariant,
  onSave,
}: ProductVariantsModalProps) {
  if (!open) return null;

  const activeGroups = optionGroups.filter((g) => g.values.length > 0);

  const updateVariantField = (
    id: string,
    patch: Partial<Pick<ListVariantRow, "price" | "inventory">>
  ) => {
    if (!onChangeVariant) return;
    onChangeVariant(
      variants.map((v) => (v.id === id ? { ...v, ...patch } : v))
    );
  };

  const handleSaveClick = async () => {
    try {
      if (onSave) {
        await onSave(variants);
      }
      onClose();
    } catch (e) {
      console.error("Failed to save variants", e);
      
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="max-h-[80vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Variant Inventory Settings</h2>
            <p className="text-xs text-gray-500">
              {productName} · Update stock, price and images for each variant.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveClick}
              className="rounded-full bg-black px-5 py-1.5 text-xs font-semibold text-white"
              disabled={loading}
            >
              Save Changes
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-lg leading-none text-gray-500 hover:bg-gray-200 hover:text-black"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-auto px-6 py-4 text-xs">
          {loading ? (
            <p className="py-10 text-center text-xs text-gray-500">
              Loading variants…
            </p>
          ) : variants.length === 0 ? (
            <p className="py-10 text-center text-xs text-gray-500">
              No variants found for this product.
            </p>
          ) : (
            <table className="w-full border-separate border-spacing-y-2">
              <thead className="text-[11px] text-gray-500">
                <tr>
                  <th className="px-2 text-left">Re order</th>
                  {activeGroups.map((g) => (
                    <th key={g.id} className="px-2 text-left">
                      {g.kind === "size"
                        ? "Choose Tee Size"
                        : g.kind === "color"
                        ? "Choose Tee Color"
                        : g.name}
                    </th>
                  ))}
                  <th className="px-2 text-left">Price</th>
                  <th className="px-2 text-left">Inventory Stock</th>
                  <th className="px-2 text-left">Upload Image</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="align-middle">
                    <td className="cursor-move rounded-l-xl bg-[#F7F7FB] px-3 py-2 text-lg text-gray-400">
                      ≡
                    </td>

                    {activeGroups.map((g) => (
                      <td key={g.id} className="bg-[#F7F7FB] px-3 py-2">
                        <div className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[11px] text-gray-800">
                          {v.options_json[g.name] ?? "—"}
                        </div>
                      </td>
                    ))}

                    <td className="bg-[#F7F7FB] px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="rounded-xl border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-500">
                          SGD
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={v.price}
                          onChange={(e) =>
                            updateVariantField(v.id, {
                              price: Number(e.target.value) || 0,
                            })
                          }
                          className="h-8 w-24 rounded-xl border border-gray-300 bg-white px-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </td>

                    <td className="bg-[#F7F7FB] px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="rounded-xl border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-500">
                          QTY
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={v.inventory}
                          onChange={(e) =>
                            updateVariantField(v.id, {
                              inventory: Number(e.target.value) || 0,
                            })
                          }
                          className="h-8 w-20 rounded-xl border border-gray-300 bg-white px-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </td>

                    <td className="rounded-r-xl bg-[#F7F7FB] px-3 py-2">
                      {v.imageUrl ? (
                        <div className="relative h-10 w-10 overflow-hidden rounded-full border border-gray-200 bg-white">
                          <Image
                            src={v.imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-gray-300 bg-white text-lg text-gray-400">
                          +
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Main page ---------- */

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function AllProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [variantsModalOpen, setVariantsModalOpen] = useState(false);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(
    null
  );
  const [variantOptionGroups, setVariantOptionGroups] = useState<
    VariantOptionGroup[]
  >([]);
  const [productVariants, setProductVariants] = useState<ListVariantRow[]>([]);

  // bulk edit
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        setLoading(true);

        const { data: auth } = await supabase.auth.getUser();

        if (auth?.user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("id,email,status,onboarding_completed,full_name")
            .eq("id", auth.user.id)
            .maybeSingle();

          if (isMounted && prof) {
            setProfile(prof as Profile);
          }
        }

        await loadProducts(isMounted);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    async function loadProducts(isStillMounted: boolean) {
  const res = await fetch("/api/products");
  const data = await res.json();

  console.log("API /api/products raw:", data);

  const mapped: ProductRow[] = (data.products ?? data ?? []).map(
    (p: any): ProductRow => ({
      id: String(p.id),
      name: p.name,
      // API already has "Variant"/"Single" as a string
      type: p.type === "Variant" ? "Variant" : "Single",
      // you don't have category in this payload yet
      category: p.categoryName ?? "—",
      price: typeof p.priceCents === "number" ? p.priceCents / 100 : 0,
      // 👇 use stock from the response
      stock: p.stock ?? p.totalStock ?? p.inventoryQty ?? 0,
      sku: p.baseSku ?? p.sku ?? "",
      status: p.status as ProductStatus,
      variantCount: p.variantCount ?? 0,
      imageUrl: p.imageUrl ?? null,
    })
  );

  console.log("mapped products:", mapped);

  if (isStillMounted) {
    setProducts(mapped);
  }
}

    void init();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleOpenVariants(product: ProductRow) {
    setSelectedProduct(product);
    setVariantsModalOpen(true);
    setVariantsLoading(true);

    try {
      const res = await fetch(`/api/products/${product.id}/variants`);
      const data = await res.json();

      setVariantOptionGroups(data.optionGroups ?? []);
      setProductVariants(
        (data.variants ?? []).map((v: any) => ({
          id: String(v.id),
          sku: v.sku,
          price: (v.priceCents ?? 0) / 100,
          inventory: v.inventoryQty ?? 0,
          imageUrl: v.imageUrl ?? null,
          options_json: v.options ?? v.optionsJson ?? {},
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setVariantsLoading(false);
    }
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? "",
        role: "Vendor",
        status: "Incomplete Registration",
      }),
    [profile]
  );

  const allVisibleIds = filtered.map((p) => p.id);
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

  const selectedProducts = products.filter((p) =>
    selectedIds.includes(p.id)
  );

  async function reloadAfterBulk() {
    try {
      setLoading(true);
      const res = await fetch("/api/products");
      const data = await res.json();
      const mapped: ProductRow[] = (data.products ?? data ?? []).map(
        // console.log(data.products),
        (p: any): ProductRow => ({
          id: String(p.id),
          name: p.name,
          type: p.type === "Variant" ? "Variant" : "Single",
          category: p.categoryName ?? "—",
          price: (p.priceCents ?? 0) / 100,
          stock: p.totalStock ?? p.inventoryQty ?? 0,
          sku: p.baseSku ?? p.sku ?? "",
          status: p.status as ProductStatus,
          variantCount: p.variantCount ?? 0,
          imageUrl: p.imageUrl ?? null,
        })
      );
      setProducts(mapped);
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  }

return (
  <div className="flex h-screen w-screen bg-[#050509] overflow-hidden">
    {/* Left sidebar stays fixed on the left */}
    <Sidebar config={sidebarConfig} />

    {/* Black bezel + inner tablet */}
    <div className="flex flex-1 items-stretch justify-center px-6 py-4">
      {/* This is the big rounded tablet container */}
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
        {/* Sticky top bar INSIDE the tablet */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-[#1B1529]">
              All Products
            </h1>
            <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
              {products.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Bulk Actions */}
            <button
              type="button"
              onClick={() => selectedProducts.length && setBulkOpen(true)}
              className={clsx(
                "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-semibold shadow-sm",
                selectedProducts.length
                  ? "border-black bg-black text-white"
                  : "border-gray-200 bg-white text-gray-700"
              )}
            >
              Bulk Actions
              {selectedProducts.length > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white text-[10px] font-bold text-black">
                  {selectedProducts.length}
                </span>
              )}
              <span>▾</span>
            </button>

            {/* Filter dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((o) => !o)}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-[11px] font-semibold text-gray-700 shadow-sm"
              >
                Filter by ▾
              </button>

              {filterOpen && (
                <div className="absolute right-0 z-40 mt-2 w-60 rounded-2xl border border-gray-200 bg-white p-3 text-[11px] shadow-xl">
                  {/* filter content here */}
                </div>
              )}
            </div>

            {/* Search */}
            <div className="flex items-center rounded-full border border-gray-200 bg-[#F5F5F8] px-3 py-1">
              <span className="mr-1 text-xs text-gray-400">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Product"
                className="w-48 bg-transparent text-xs text-gray-700 focus:outline-none"
              />
            </div>

            <button className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white">
              Search
            </button>

            <button
              type="button"
              onClick={() => router.push("/pages/products/new")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-lg font-semibold text-white shadow-md hover:bg-gray-900"
            >
              +
            </button>
          </div>
        </div>

        {/* Scrollable body INSIDE tablet */}
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
                  <th className="px-3 py-3 text-left">Product Name</th>
                  <th className="px-3 py-3 text-left">Type</th>
                  <th className="px-3 py-3 text-left">Category</th>
                  <th className="px-3 py-3 text-right">Price</th>
                  <th className="px-3 py-3 text-center">Variants</th>
                  <th className="px-3 py-3 text-right">Stock</th>
                  <th className="px-3 py-3 text-left">SKU</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-center">Action</th>
                </tr>
              </thead>

            <tbody>
  {loading ? (
    <tr>
      <td
        colSpan={10}
        className="px-4 py-10 text-center text-xs text-gray-500"
      >
        Loading products…
      </td>
    </tr>
  ) : filtered.length === 0 ? (
    <tr>
      <td
        colSpan={10}
        className="px-4 py-16 text-center text-xs text-gray-500"
      >
        {/* empty state */}
        ...
      </td>
    </tr>
  ) : (
    filtered.map((p, idx) => {
      const checked = selectedIds.includes(p.id);
      return (
        <tr
          key={p.id}
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
              onChange={() => toggleRow(p.id)}
            />
          </td>

          <td className="px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-gray-200">
                {p.imageUrl && (
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    fill
                    className="object-cover"
                  />
                )}
              </div>
              <div className="text-xs font-semibold text-gray-900">
                {p.name}
              </div>
            </div>
          </td>

          <td className="px-3 py-3 text-[11px] text-gray-600">
            {p.type}
          </td>

          <td className="px-3 py-3 text-[11px] text-gray-600">
            {p.category}
          </td>

          <td className="px-3 py-3 text-right text-[11px] text-gray-800">
            {formatMoney(p.price)}
          </td>

          <td className="px-3 py-3 text-center">
            {p.type === "Variant" ? (
              <button
                type="button"
                onClick={() => handleOpenVariants(p)}
                className="inline-flex h-7 min-w-[32px] items-center justify-center rounded-full bg-[#F3E8FF] px-2 text-[11px] font-semibold text-[#6D28D9] hover:bg-[#EDE0FF]"
              >
                {p.variantCount}
              </button>
            ) : (
              <span className="text-[11px] text-gray-400">
                {p.variantCount}
              </span>
            )}
          </td>

          <td className="px-3 py-3 text-right text-[11px] text-gray-800">
            {p.stock}
          </td>

          <td className="px-3 py-3 text-[11px] text-gray-600">
            {p.sku}
          </td>

          <td className="px-3 py-3 text-center">
            <span
              className={clsx(
                "inline-flex h-7 items-center rounded-full px-3 text-[11px] font-semibold",
                p.status === "active" && "bg-[#DCFCE7] text-[#166534]",
                p.status === "draft" && "bg-gray-200 text-gray-700",
                p.status === "out_of_stock" && "bg-[#FEE2E2] text-[#B91C1C]"
              )}
            >
              {p.status === "out_of_stock"
                ? "Out of Stock"
                : p.status === "active"
                ? "Active"
                : "Draft"}
            </span>
          </td>

          <td className="px-3 py-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <button
                className="rounded-full bg-black px-4 py-1.5 text-[11px] font-semibold text-white"
                onClick={() => router.push(`/pages/products/${p.id}/edit`)}
              >
                Edit
              </button>
              <button className="rounded-full border border-gray-300 px-4 py-1.5 text-[11px] text-gray-700">
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

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-[11px] text-gray-500">
            <span>Showing {filtered.length} products</span>
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
      </div>
    </div>

    {/* Modals live outside tablet but still above everything */}
    <ProductVariantsModal
  open={variantsModalOpen}
  onClose={() => setVariantsModalOpen(false)}
  productName={selectedProduct?.name ?? ""}
  optionGroups={variantOptionGroups}
  variants={productVariants}
  loading={variantsLoading}
  onChangeVariant={(rows) => setProductVariants(rows)}
  onSave={async (rows) => {
    if (!selectedProduct) return;
    await fetch(`/api/products/${selectedProduct.id}/variants`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variants: rows }),
    });
    // optional: reload product list or show toast
  }}
/>
    <BulkEditModal
      open={bulkOpen}
      onClose={() => setBulkOpen(false)}
      selectedProducts={selectedProducts}
      onSaved={reloadAfterBulk}
    />
  </div>
);
}
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import Sidebar from "../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../components/sidebar/sidebar.config";
import { supabase } from "../../../lib/supabase/client";

/* ---------- Types ---------- */

type ProductStatus =
  | "draft"
  | "active"
  | "out_of_stock"
  | "published"
  | "inactive";

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

/* ---------- Variants modal ---------- */

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

/* ---------- Helper components for add + bulk upload ---------- */

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

interface AddProductChoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSingleProduct: () => void;
  onBulkUpload: () => void;
}

function AddProductChoiceModal({
  open,
  onClose,
  onSingleProduct,
  onBulkUpload,
}: AddProductChoiceModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">
            Choose how you’d like to add your product
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <button
            type="button"
            onClick={onSingleProduct}
            className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-[#F8F7FF] px-4 py-3 text-left shadow-sm hover:border-black"
          >
            <div>
              <div className="text-sm font-semibold">Single Product</div>
              <div className="text-xs text-gray-500">
                Add one product manually
              </div>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-white text-center text-xl">
              🧾
            </div>
          </button>

          <button
            type="button"
            onClick={onBulkUpload}
            className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-[#F8F7FF] px-4 py-3 text-left shadow-sm hover:border-black"
          >
            <div>
              <div className="text-sm font-semibold">Bulk Upload</div>
              <div className="text-xs text-gray-500">
                Import multiple products at once
              </div>
            </div>
            <div className="flex h-10 w-14 items-center justify-center">
              <span className="inline-block h-9 w-7 rounded-2xl bg-white" />
              <span className="inline-block h-9 w-7 -ml-3 rounded-2xl bg-white" />
              <span className="inline-block h-9 w-7 -ml-3 rounded-2xl bg-white" />
            </div>
          </button>
        </div>

        <button
          type="button"
          className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-gray-700 underline"
          onClick={() => {
            window.location.href = "/templates/products-bulk-template.csv";
          }}
        >
          ⬇ Download CSV Template
        </button>
      </div>
    </div>
  );
}

type CsvMappingKey =
  | "productUniqueCode"
  | "sku"
  | "name"
  | "type"
  | "category"
  | "wellness"
  | "price"
  | "inventory";

// interface BulkUploadModalProps {
//   open: boolean;
//   onClose: () => void;
//   onUploaded: () => Promise<void> | void;
// }

// Make sure you have:
// import { supabase } from "@/lib/supabase/client"; (or your path)

type ProductCsvMappingKey =
  | "productUniqueCode"
  | "sku"
  | "name"
  | "type"
  | "category"
  | "wellness"
  | "price"
  | "inventory";

type VariantCsvMappingKey =
  | "productBaseSku" // parent product base_sku
  | "variantSku"
  | "price"
  | "inventory"
  | "optionSize"
  | "optionColor"
  | "optionVolume"
  | "optionWeight"
  | "customOption";

type BulkUploadMode = "products" | "variants";

type BulkUploadModalProps = {
  open: boolean;
  onClose: () => void;
  onUploaded: () => Promise<void> | void;
  mode: BulkUploadMode; // 👈 NEW: choose which upload this modal is for
};

function BulkUploadModal({ open, onClose, onUploaded, mode }: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);

  // separate mappings for products vs variants
  const [productMapping, setProductMapping] = useState<
    Record<ProductCsvMappingKey, string>
  >({
    productUniqueCode: "",
    sku: "",
    name: "",
    type: "",
    category: "",
    wellness: "",
    price: "",
    inventory: "",
  });

  const [variantMapping, setVariantMapping] = useState<
    Record<VariantCsvMappingKey, string>
  >({
    productBaseSku: "",
    variantSku: "",
    price: "",
    inventory: "",
    optionSize: "",
    optionColor: "",
    optionVolume: "",
    optionWeight: "",
    customOption: "",
  });

  const [uploading, setUploading] = useState(false);

  if (!open) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = () => {
      const text = (reader.result as string) || "";
      const firstLine = text.split(/\r?\n/)[0] || "";
      const cols = firstLine
        .split(",")
        .map((c) => c.trim().replace(/^"|"$/g, ""));
      setHeaders(cols);
    };
    reader.readAsText(f);
  }

  function handleChangeProductMapping(key: ProductCsvMappingKey, value: string) {
    setProductMapping((m) => ({ ...m, [key]: value }));
  }

  function handleChangeVariantMapping(key: VariantCsvMappingKey, value: string) {
    setVariantMapping((m) => ({ ...m, [key]: value }));
  }

  async function handleUpload() {
    if (!file) {
      alert("Please choose a CSV file first.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      // pick endpoint + mapping based on mode
      const endpoint =
        mode === "products"
          ? "/api/products/bulk-upload"
          : "/api/products/variants-bulk-upload";

      const mappingToSend =
        mode === "products" ? productMapping : variantMapping;

      formData.append("mapping", JSON.stringify(mappingToSend));

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
        throw new Error(j.error || "Bulk upload failed");
      }

      await onUploaded();
      onClose();
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const headerOptions = (
    <>
      <option value="">Choose a field to match</option>
      {headers.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </>
  );

  const isProducts = mode === "products";

  return (
    <div className="fixed inset-0 z-[70] flex.items-center justify-center bg-black/40">
      <div className="w-full max-w-5xl rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isProducts ? "CSV Bulk Upload – Products" : "CSV Bulk Upload – Variants"}
          </h2>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-[#F8F7FF] px-4 py-3">
          <div className="text-xs text-gray-600">
            <div className="font-semibold">Upload your CSV file</div>
            <div>We’ll read the first row and show the columns here.</div>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="text-xs"
          />
        </div>

        {/* Mapping UI changes based on mode */}
        <div className="mt-6 grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-semibold text-gray-500">
              {isProducts
                ? "Import to Products (Vendor Portal)"
                : "Import to Product Variants (Vendor Portal)"}
            </div>

            {isProducts ? (
              <div className="space-y-2">
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Product Unique Code (used later for variants)
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Product SKU (Single Item Code)
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Product Name
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Product Type (Single / Variant)
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Category
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Wellness Dimension
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Price (SGD)
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Inventory Stock
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Product Base SKU (parent product base_sku)
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Variant SKU
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Price (SGD)
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Inventory Stock
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Option: Size
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Option: Color
                </div>
                 <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Option: Volume
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Option: Weight
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Option: Custom
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold text-gray-500">
              What (CSV) column field matches best?
            </div>

            {isProducts ? (
              <div className="space-y-2">
                <select
                  value={productMapping.productUniqueCode}
                  onChange={(e) =>
                    handleChangeProductMapping("productUniqueCode", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.sku}
                  onChange={(e) =>
                    handleChangeProductMapping("sku", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.name}
                  onChange={(e) =>
                    handleChangeProductMapping("name", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.type}
                  onChange={(e) =>
                    handleChangeProductMapping("type", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.category}
                  onChange={(e) =>
                    handleChangeProductMapping("category", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.wellness}
                  onChange={(e) =>
                    handleChangeProductMapping("wellness", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.price}
                  onChange={(e) =>
                    handleChangeProductMapping("price", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.inventory}
                  onChange={(e) =>
                    handleChangeProductMapping("inventory", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                >
                  {headerOptions}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={variantMapping.productBaseSku}
                  onChange={(e) =>
                    handleChangeVariantMapping("productBaseSku", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                >
                  {headerOptions}
                </select>

                <select
                  value={variantMapping.variantSku}
                  onChange={(e) =>
                    handleChangeVariantMapping("variantSku", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                >
                  {headerOptions}
                </select>

                <select
                  value={variantMapping.price}
                  onChange={(e) =>
                    handleChangeVariantMapping("price", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                >
                  {headerOptions}
                </select>

                <select
                  value={variantMapping.inventory}
                  onChange={(e) =>
                    handleChangeVariantMapping("inventory", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                >
                  {headerOptions}
                </select>

                <select
                  value={variantMapping.optionSize}
                  onChange={(e) =>
                    handleChangeVariantMapping("optionSize", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg.white px-3 text-xs"
                >
                  {headerOptions}
                </select>

                <select
                  value={variantMapping.optionColor}
                  onChange={(e) =>
                    handleChangeVariantMapping("optionColor", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg.white px-3 text-xs"
                >
                  {headerOptions}
                </select>
                <select
                  value={variantMapping.optionVolume}
                  onChange={(e) =>
                    handleChangeVariantMapping("optionVolume", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg.white px-3 text-xs"
                >
                  {headerOptions}
                </select>
                <select
                  value={variantMapping.optionWeight}
                  onChange={(e) =>
                    handleChangeVariantMapping("optionWeight", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg.white px-3 text-xs"
                >
                  {headerOptions}
                </select>
                <select
                  value={variantMapping.customOption}
                  onChange={(e) =>
                    handleChangeVariantMapping("customOption", e.target.value)
                  }
                  className="h-9 w-full rounded-2xl border border-gray-200 bg.white px-3 text-xs"
                >
                  {headerOptions}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-300 px-4 py-2"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !file}
            className="rounded-full bg-black px-6 py-2 font-semibold text-white.disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main page ---------- */

export default function AllProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  // searchInput = what user is typing; search = active filter term
  const [searchInput, setSearchInput] = useState("");
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

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  const [addChoiceOpen, setAddChoiceOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [filters, setFilters] = useState({
    type: [] as string[],
    status: [] as string[],
    discount: [] as string[],
  });

  function toggleFilter(
    group: "type" | "status" | "discount",
    value: string,
    checked: boolean
  ) {
    setFilters((prev) => {
      const arr = prev[group];
      return {
        ...prev,
        [group]: checked ? [...arr, value] : arr.filter((v) => v !== value),
      };
    });
  }

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/products", {
        headers: {
          Authorization: session?.access_token
            ? `Bearer ${session.access_token}`
            : "",
        },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch products");
      }
      const data = await res.json();

      const mapped: ProductRow[] = (data.products ?? data ?? []).map(
        (p: any): ProductRow => ({
          id: String(p.id),
          name: p.name,
          type: p.type === "Variant" ? "Variant" : "Single",
          category: p.categoryName ?? "—",
          price: typeof p.priceCents === "number" ? p.priceCents / 100 : 0,
          stock: p.stock ?? p.totalStock ?? p.inventoryQty ?? 0,
          sku: p.baseSku ?? p.sku ?? "",
          status: p.status as ProductStatus,
          variantCount: p.variantCount ?? 0,
          imageUrl: p.imageUrl ?? null,
        })
      );

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/products/${product.id}/variants`, {
        headers: {
          Authorization: session?.access_token
            ? `Bearer ${session.access_token}`
            : "",
        },
      });
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

  // Apply search term
  const filtered = products.filter((p) =>
    p?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const currentRows = filtered.slice(startIndex, startIndex + pageSize);
  const fromItem = filtered.length === 0 ? 0 : startIndex + 1;
  const toItem = startIndex + currentRows.length;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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

  const allVisibleIds = currentRows.map((p) => p.id);
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/products", {
        headers: {
          Authorization: session?.access_token
            ? `Bearer ${session.access_token}`
            : "",
        },
      });
      const data = await res.json();

      const mapped: ProductRow[] = (data.products ?? data ?? []).map(
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

  async function handleTrash(productId: string) {
    try {

      const {
        data: { session },
      } = await supabase.auth.getSession();
      await fetch("/api/products/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: session?.access_token ? `Bearer ${session.access_token}` : "" },
        body: JSON.stringify({
          productIds: [productId],
          status: "draft",
          trash: true,
        }),
      });

      await reloadAfterBulk();
    } catch (err) {
      console.error(err);
      alert("Failed to move product to trash");
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Top bar */}
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

              {/* Filters */}
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
                    <div className="space-y-4">
                      {/* Filter by Type */}
                      <div>
                        <p className="mb-1 font-semibold text-gray-700">
                          Filter by: Type
                        </p>
                        <label className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={filters.type.includes("single")}
                            onChange={(e) =>
                              toggleFilter("type", "single", e.target.checked)
                            }
                          />
                          <span>Single</span>
                        </label>
                        <label className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={filters.type.includes("variant")}
                            onChange={(e) =>
                              toggleFilter("type", "variant", e.target.checked)
                            }
                          />
                          <span>Variant</span>
                        </label>
                      </div>

                      {/* Filter by Status */}
                      <div>
                        <p className="mb-1 font-semibold text-gray-700">
                          Filter by: Status
                        </p>
                        <label className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={filters.status.includes("draft")}
                            onChange={(e) =>
                              toggleFilter("status", "draft", e.target.checked)
                            }
                          />
                          <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 font-medium text-gray-600">
                            Draft
                          </span>
                        </label>

                        <label className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={filters.status.includes("inactive")}
                            onChange={(e) =>
                              toggleFilter(
                                "status",
                                "inactive",
                                e.target.checked
                              )
                            }
                          />
                          <span className="inline-flex items-center rounded-full bg-gray-300 px-2 py-0.5 font-medium text-gray-700">
                            In-active
                          </span>
                        </label>

                        <label className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={filters.status.includes("active")}
                            onChange={(e) =>
                              toggleFilter(
                                "status",
                                "active",
                                e.target.checked
                              )
                            }
                          />
                          <span className="inline-flex items-center rounded-full bg-[#DCFCE7] px-2 py-0.5 font-medium text-[#166534]">
                            Active
                          </span>
                        </label>

                        <label className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={filters.status.includes("out_of_stock")}
                            onChange={(e) =>
                              toggleFilter(
                                "status",
                                "out_of_stock",
                                e.target.checked
                              )
                            }
                          />
                          <span className="inline-flex items-center rounded-full bg-[#FEE2E2] px-2 py-0.5 font-medium text-[#B91C1C]">
                            Out of Stock
                          </span>
                        </label>

                        <label className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={filters.status.includes("published")}
                            onChange={(e) =>
                              toggleFilter(
                                "status",
                                "published",
                                e.target.checked
                              )
                            }
                          />
                          <span className="inline-flex items-center rounded-full bg-[#E0F2FE] px-2 py-0.5 font-medium text-[#0369A1]">
                            Published
                          </span>
                        </label>
                      </div>

                      {/* Filter by Discount (visual only; not wired to data) */}
                      <div>
                        <p className="mb-1 font-semibold text-gray-700">
                          Filter by: Discount
                        </p>
                        <label className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={filters.discount.includes("no_discount")}
                            onChange={(e) =>
                              toggleFilter(
                                "discount",
                                "no_discount",
                                e.target.checked
                              )
                            }
                          />
                          <span>No Discounts</span>
                        </label>
                        <label className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={filters.discount.includes("active")}
                            onChange={(e) =>
                              toggleFilter(
                                "discount",
                                "active",
                                e.target.checked
                              )
                            }
                          />
                          <span>Active Discounts</span>
                        </label>
                        <label className="flex items-center gap-2 py-1">
                          <input
                            type="checkbox"
                            checked={filters.discount.includes("expired")}
                            onChange={(e) =>
                              toggleFilter(
                                "discount",
                                "expired",
                                e.target.checked
                              )
                            }
                          />
                          <span>Expired Discounts</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Search box + button */}
              <div className="flex items-center rounded-full border border-gray-200 bg-[#F5F5F8] px-3 py-1">
                <span className="mr-1 text-xs text-gray-400">🔍</span>
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSearch(searchInput);
                      setCurrentPage(1);
                    }
                  }}
                  placeholder="Search Product"
                  className="w-48 bg-transparent text-xs text-gray-700 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setSearch(searchInput); // trigger search
                  setCurrentPage(1);
                }}
                className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white"
              >
                Search
              </button>

              <button
                type="button"
                onClick={() => setAddChoiceOpen(true)}
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
                        No products found.
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((p, idx) => {
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
                                (p.status === "active" ||
                                  p.status === "published") &&
                                  "bg-[#DCFCE7] text-[#166534]",
                                p.status === "draft" &&
                                  "bg-gray-200 text-gray-700",
                                p.status === "out_of_stock" &&
                                  "bg-[#FEE2E2] text-[#B91C1C]"
                              )}
                            >
                              {p.status === "out_of_stock"
                                ? "Out of Stock"
                                : p.status === "active"
                                ? "Active"
                                : p.status === "published"
                                ? "Published"
                                : "Draft"}
                            </span>
                          </td>

                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                className="rounded-full bg-black px-4 py-1.5 text-[11px] font-semibold text-white"
                                onClick={() =>
                                  router.push(`/pages/products/${p.id}/edit`)
                                }
                              >
                                Edit
                              </button>
                              <button
                                className="rounded-full border border-gray-300 px-4 py-1.5 text-[11px] text-gray-700"
                                onClick={() => handleTrash(p.id)}
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

            {/* Pagination */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-500">
              <span>
                Showing {fromItem}-{toItem} of {filtered.length} products
              </span>

              <div className="flex items-center gap-3">
                <button
                  className="rounded-full border border-gray-300 px-3 py-1 disabled:opacity-40"
                  onClick={() =>
                    setCurrentPage((p) => Math.max(1, p - 1))
                  }
                  disabled={safePage === 1}
                >
                  &lt; Back
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      className={clsx(
                        "min-w-[28px] rounded-md border px-2 py-1",
                        page === safePage
                          ? "border-black bg-black text-white"
                          : "border-gray-300 bg-white text-gray-700"
                      )}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  className="rounded-full border border-gray-300 px-3 py-1 disabled:opacity-40"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={safePage === totalPages}
                >
                  Next &gt;
                </button>

                <div className="ml-3 flex items-center gap-1">
                  <span>Result per page</span>
                  <select
                    className="rounded-md border border-gray-300 bg-white px-2 py-1"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProductVariantsModal
        open={variantsModalOpen}
        onClose={() => setVariantsModalOpen(false)}
        productName={selectedProduct?.name ?? ""}
        optionGroups={variantOptionGroups}
        variants={productVariants}
        loading={variantsLoading}
        onChangeVariant={setProductVariants}
        onSave={async (rows) => {
          if (!selectedProduct) return;
          await fetch(`/api/products/${selectedProduct.id}/variants`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ variants: rows }),
          });
        }}
      />

      <AddProductChoiceModal
        open={addChoiceOpen}
        onClose={() => setAddChoiceOpen(false)}
        onSingleProduct={() => {
          setAddChoiceOpen(false);
          router.push("/pages/products/new");
        }}
        onBulkUpload={() => {
          setAddChoiceOpen(false);
          setBulkUploadOpen(true);
        }}
      />

      <BulkUploadModal
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onUploaded={reloadAfterBulk}
         mode="variants"
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
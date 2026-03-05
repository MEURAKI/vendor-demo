"use client";

import { useVendorProfile } from "../../../context/VendorShellContext";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import { Listbox, Transition,Popover } from "@headlessui/react";
import { Fragment } from "react";
import { ChevronDown, Filter, Search, Check } from "lucide-react";
import ClipLoader from "react-spinners/ClipLoader";

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
  categories: string;
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
                      <ClipLoader size={40} color="#6B46C1" cssOverride={{ animationDuration: "3s" }}/>


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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl animate-slideUp">
        {/* Header */}
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Add New Product
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm hover:bg-gray-200 transition"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Choose the method you prefer for adding products.
        </p>

        {/* Option Buttons */}
        <div className="mt-6 space-y-4">
          {/* Single */}
          <button
            type="button"
            onClick={onSingleProduct}
            className="group flex w-full items-center justify-between rounded-3xl border border-gray-200 bg-[#FAF9FF] px-4 py-4 text-left shadow-sm transition hover:border-purple-500 hover:shadow-md"
          >
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Single Product
              </div>
              <div className="text-xs text-gray-500">
                Add one product manually.
              </div>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl group-hover:scale-110 transition">
              🧾
            </div>
          </button>

          {/* Bulk Upload */}
          <button
            type="button"
            onClick={onBulkUpload}
            className="group flex w-full items-center justify-between rounded-3xl border border-gray-200 bg-[#FAF9FF] px-4 py-4 text-left shadow-sm transition hover:border-purple-500 hover:shadow-md"
          >
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Bulk Upload
              </div>
              <div className="text-xs text-gray-500">
                Import multiple products at once.
              </div>
            </div>

            <div className="flex h-12 w-16 items-center justify-center gap-[2px]">
              <span className="inline-block h-10 w-7 rounded-2xl bg-white group-hover:scale-105 transition" />
              <span className="inline-block h-10 w-7 -ml-3 rounded-2xl bg-white group-hover:scale-105 transition" />
              <span className="inline-block h-10 w-7 -ml-3 rounded-2xl bg-white group-hover:scale-105 transition" />
            </div>
          </button>
        </div>

        {/* Download Button */}
        <button
          type="button"
          className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-gray-700 underline hover:text-black transition"
          onClick={() => {
            window.location.href = "/templates/products-bulk-template.csv";
          }}
        >
          ⬇ Download CSV Template
        </button>
      </div>

      {/* Animations */}
      <style jsx>{`
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.25s ease-out;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            backdrop-filter: blur(0px);
          }
          to {
            opacity: 1;
            backdrop-filter: blur(4px);
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
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
  | "description"
  | "type"
  | "category"
  | "wellness"
  | "price"
  | "inventory"
  | "tags"
  | "discountType"
  | "discountValue"
  | "discountStart"
  | "discountEnd";

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

function BulkUploadModal({
  open,
  onClose,
  onUploaded,
  mode,
}: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);

  const [productMapping, setProductMapping] = useState<
    Record<ProductCsvMappingKey, string>
  >({
    productUniqueCode: "",
    sku: "",
    name: "",
    description: "",
    type: "",
    category: "",
    wellness: "",
    price: "",
    inventory: "",
    tags: "",
    discountType: "",
    discountValue: "",
    discountStart: "",
    discountEnd: "",
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

  // allow switching mode inside modal
  const [currentMode, setCurrentMode] = useState<"products" | "variants">(
    mode ?? "products"
  );

  useEffect(() => {
    if (mode) setCurrentMode(mode);
  }, [mode]);

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

      const endpoint =
        currentMode === "products"
          ? "/api/products/bulk-upload"
          : "/api/products/variants-bulk-upload";

      const mappingToSend =
        currentMode === "products" ? productMapping : variantMapping;

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

  const isProducts = currentMode === "products";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-5xl rounded-[28px] border border-gray-100 bg-white/95 p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              CSV Bulk Upload
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Map your CSV columns to product fields before importing.
            </p>
          </div>

          {/* Close */}
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-700 hover:bg-gray-200 transition"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="mt-4 flex justify-end">
          <div className="inline-flex rounded-full bg-gray-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setCurrentMode("products")}
              className={clsx(
                "rounded-full px-3 py-1.5 font-semibold transition",
                isProducts
                  ? "bg-black text-white shadow-sm"
                  : "text-gray-600 hover:bg-white"
              )}
            >
              Products
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode("variants")}
              className={clsx(
                "rounded-full px-3 py-1.5 font-semibold transition",
                !isProducts
                  ? "bg-black text-white shadow-sm"
                  : "text-gray-600 hover:bg-white"
              )}
            >
              Variants
            </button>
          </div>
        </div>

        {/* File Upload Row */}
        <div className="mt-4 flex items-center justify-between gap-4 rounded-3xl bg-[#F8F7FF] px-5 py-4">
          <div className="text-xs text-gray-600">
            <div className="font-semibold text-gray-800">
              Upload your CSV file
            </div>
            <div className="mt-1">
              We’ll read the first row and show the column headers for mapping.
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-gray-900 transition">
            Choose CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Mapping */}
        <div className="mt-6 grid grid-cols-1 gap-6 text-xs md:grid-cols-2">
          {/* LEFT: Description of fields */}
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {isProducts
                ? "Import to Products (Subscriber Portal)"
                : "Import to Product Variants (Subscriber Portal)"}
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
                  Product Description
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
                   Tags
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Price (SGD)
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Inventory Stock
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Discount Type
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Discount Value
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Discount Start Date
                </div>
                <div className="rounded-2xl bg-[#F8F7FF] px-3 py-2">
                  Discount End Date
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

          {/* RIGHT: Select headers */}
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Match to CSV columns
            </div>

            {isProducts ? (
              <div className="space-y-2">
                <select
                  value={productMapping.productUniqueCode}
                  onChange={(e) =>
                    handleChangeProductMapping(
                      "productUniqueCode",
                      e.target.value
                    )
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.sku}
                  onChange={(e) =>
                    handleChangeProductMapping("sku", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.name}
                  onChange={(e) =>
                    handleChangeProductMapping("name", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.description}
                  onChange={(e) =>
                    handleChangeProductMapping("description", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.type}
                  onChange={(e) =>
                    handleChangeProductMapping("type", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.category}
                  onChange={(e) =>
                    handleChangeProductMapping("category", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.wellness}
                  onChange={(e) =>
                    handleChangeProductMapping("wellness", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.tags}
                  onChange={(e) =>
                    handleChangeProductMapping("tags", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.price}
                  onChange={(e) =>
                    handleChangeProductMapping("price", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.inventory}
                  onChange={(e) =>
                    handleChangeProductMapping("inventory", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.discountType}
                  onChange={(e) =>
                    handleChangeProductMapping("discountType", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.discountValue}
                  onChange={(e) =>
                    handleChangeProductMapping("discountValue", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>


                <select
                  value={productMapping.discountStart}
                  onChange={(e) =>
                    handleChangeProductMapping("discountStart", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={productMapping.discountEnd}
                  onChange={(e) =>
                    handleChangeProductMapping("discountEnd", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
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
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={variantMapping.variantSku}
                  onChange={(e) =>
                    handleChangeVariantMapping("variantSku", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={variantMapping.price}
                  onChange={(e) =>
                    handleChangeVariantMapping("price", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={variantMapping.inventory}
                  onChange={(e) =>
                    handleChangeVariantMapping("inventory", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={variantMapping.optionSize}
                  onChange={(e) =>
                    handleChangeVariantMapping("optionSize", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={variantMapping.optionColor}
                  onChange={(e) =>
                    handleChangeVariantMapping("optionColor", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={variantMapping.optionVolume}
                  onChange={(e) =>
                    handleChangeVariantMapping("optionVolume", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={variantMapping.optionWeight}
                  onChange={(e) =>
                    handleChangeVariantMapping("optionWeight", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>

                <select
                  value={variantMapping.customOption}
                  onChange={(e) =>
                    handleChangeVariantMapping("customOption", e.target.value)
                  }
                  className="h-9 w-full rounded-full border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                >
                  {headerOptions}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 transition"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !file}
            className="rounded-full bg-black px-6 py-2 font-semibold text-white hover:bg-gray-900 disabled:opacity-60 transition"
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

  const pageOptions = [15, 25, 50];

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

  async function handleTrash(productId: string) {
  const confirmation = window.confirm(
    "Are you sure you want to permanently delete this product?"
  );

  if (!confirmation) return;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch(`/api/products/${productId}`, {
      method: "DELETE",
      headers: {
        Authorization: session?.access_token
          ? `Bearer ${session.access_token}`
          : "",
      },
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Failed to delete product");
    }

    // Update UI instantly
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setSelectedIds((prev) => prev.filter((id) => id !== productId));
  } catch (err) {
    console.error(err);
    alert((err as Error).message || "Error deleting product");
  }
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
          categories: p.categories ?? "—",
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

  async function handleStatusChange(productId: string, newStatus: ProductStatus) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    await fetch("/api/products/bulk-update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: session?.access_token
          ? `Bearer ${session.access_token}`
          : "",
      },
      body: JSON.stringify({
        productIds: [productId],
        status: newStatus,
        trash: false,
      }),
    });

    // Update local state so UI reflects change immediately
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, status: newStatus } : p
      )
    );
  } catch (err) {
    console.error(err);
    alert("Failed to update product status");
  }
}

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
          categories: p.categories ?? "—",
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


  const activeFilterCount =
  filters.type.length +
  filters.status.length +
  filters.discount.length;

const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className="relative min-h-full flex-1 overflow-auto">
      {/* Background image */}
      <div className="absolute top-0 left-0 right-0 h-[420px] overflow-hidden pointer-events-none">
        <img src="/images/vendor bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-[#F6F6FC]" />
      </div>

      <div className="relative px-6 sm:px-8 py-6 sm:py-8 space-y-6">
        {/* ============ HEADER (glass panel) ============ */}
        <div className="rounded-3xl bg-white/[0.25] backdrop-blur-3xl border border-white/40 shadow-[0_22px_90px_rgba(124,58,237,0.35)] p-4 sm:p-6 xl:p-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold text-[#1B1529] tracking-tight">
                  All Products
                </h1>
                <span className="inline-flex h-7 items-center rounded-full bg-purple-600 px-3 text-xs font-semibold text-white">
                  {products.length}
                </span>
                {hasActiveFilters && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-medium text-amber-800">
                    {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Bulk Actions */}
                <button
                  type="button"
                  onClick={() => selectedProducts.length && setBulkOpen(true)}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                    selectedProducts.length
                      ? "border-gray-900 bg-gray-900 text-white hover:bg-gray-800"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  Bulk Actions
                  {selectedProducts.length > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white text-[10px] font-bold text-gray-900">
                      {selectedProducts.length}
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </button>

                {/* Filters */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setFilterOpen((o) => !o)}
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                      hasActiveFilters
                        ? "border-purple-300 bg-purple-50 text-purple-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Filters
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {filterOpen && (
                    <div className="absolute right-0 z-40 mt-2 w-64 rounded-2xl border border-gray-200 bg-white p-4 text-xs shadow-xl">
                      <div className="space-y-4">
                        {/* Filter by Type */}
                        <div>
                          <p className="mb-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            Type
                          </p>
                          <label className="flex items-center gap-2 py-1 cursor-pointer">
                            <input type="checkbox" className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" checked={filters.type.includes("single")} onChange={(e) => toggleFilter("type", "single", e.target.checked)} />
                            <span className="text-gray-700">Single</span>
                          </label>
                          <label className="flex items-center gap-2 py-1 cursor-pointer">
                            <input type="checkbox" className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" checked={filters.type.includes("variant")} onChange={(e) => toggleFilter("type", "variant", e.target.checked)} />
                            <span className="text-gray-700">Variant</span>
                          </label>
                        </div>

                        {/* Filter by Status */}
                        <div>
                          <p className="mb-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            Status
                          </p>
                          {[
                            { key: "draft", label: "Draft", cls: "bg-gray-100 text-gray-600" },
                            { key: "inactive", label: "Inactive", cls: "bg-gray-200 text-gray-700" },
                            { key: "active", label: "Active", cls: "bg-green-50 text-green-700" },
                            { key: "out_of_stock", label: "Out of Stock", cls: "bg-red-50 text-red-700" },
                            { key: "published", label: "Published", cls: "bg-blue-50 text-blue-700" },
                          ].map((s) => (
                            <label key={s.key} className="flex items-center gap-2 py-1 cursor-pointer">
                              <input type="checkbox" className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" checked={filters.status.includes(s.key)} onChange={(e) => toggleFilter("status", s.key, e.target.checked)} />
                              <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", s.cls)}>{s.label}</span>
                            </label>
                          ))}
                        </div>

                        {/* Filter by Discount */}
                        <div>
                          <p className="mb-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                            Discount
                          </p>
                          {[
                            { key: "no_discount", label: "No Discounts" },
                            { key: "active", label: "Active Discounts" },
                            { key: "expired", label: "Expired Discounts" },
                          ].map((d) => (
                            <label key={d.key} className="flex items-center gap-2 py-1 cursor-pointer">
                              <input type="checkbox" className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" checked={filters.discount.includes(d.key)} onChange={(e) => toggleFilter("discount", d.key, e.target.checked)} />
                              <span className="text-gray-700">{d.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setCurrentPage(1); } }}
                    placeholder="Search product..."
                    className="w-56 rounded-full border border-gray-200 bg-white py-2 pl-10 pr-4 text-xs text-gray-700 shadow-sm placeholder:text-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none transition-all"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => { setSearch(searchInput); setCurrentPage(1); }}
                  className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800 transition-colors"
                >
                  Search
                </button>

                <button
                  type="button"
                  onClick={() => setAddChoiceOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-lg font-semibold text-white shadow-md hover:bg-gray-800 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
        </div>

        {/* ============ TABLE BODY ============ */}
        <div className="rounded-2xl bg-white shadow-sm">
            <div className="min-h-0 overflow-auto">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-50/80 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        checked={allSelectedOnPage}
                        onChange={toggleSelectAllPage}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-center">Variants</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="w-28 px-4 py-3 text-center"></th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <ClipLoader size={40} color="#6B46C1" cssOverride={{ animationDuration: "3s" }} />
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center text-sm text-gray-400">
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
                            "group transition-colors hover:bg-purple-50/30",
                            checked && "bg-purple-50/40"
                          )}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              checked={checked}
                              onChange={() => toggleRow(p.id)}
                            />
                          </td>

                          {/* Product: image + name + SKU + type badge */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-gray-100 shrink-0">
                                {p.imageUrl && (
                                  <Image
                                    src={p.imageUrl}
                                    alt={p.name}
                                    fill
                                    className="object-cover"
                                  />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate max-w-[220px]">
                                  {p.name}
                                </p>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span className="text-[11px] text-gray-400 font-mono">{p.sku}</span>
                                  <span className={clsx(
                                    "inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                                    p.type === "Variant" ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-500"
                                  )}>
                                    {p.type}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-xs text-gray-500">
                            {p.categories}
                          </td>

                          <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                            {formatMoney(p.price)}
                          </td>

                          <td className="px-4 py-3 text-center">
                            {p.type === "Variant" ? (
                              <button
                                type="button"
                                onClick={() => handleOpenVariants(p)}
                                className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-purple-50 px-2 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
                              >
                                {p.variantCount}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                            {p.stock}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span className={clsx(
                              "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold",
                              (p.status === "active" || p.status === "published") && "bg-green-50 text-green-700",
                              p.status === "draft" && "bg-gray-100 text-gray-500",
                              p.status === "out_of_stock" && "bg-red-50 text-red-600",
                              p.status === "inactive" && "bg-gray-100 text-gray-400"
                            )}>
                              {p.status === "out_of_stock" ? "Out of Stock" : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                className="rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-gray-800 transition-colors"
                                onClick={() => router.push(`/pages/products/${p.id}/edit`)}
                              >
                                Edit
                              </button>
                              <button
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
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

            {/* ============ PAGINATION ============ */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
              <span className="text-xs text-gray-500">
                Showing <span className="font-medium text-gray-900">{fromItem}-{toItem}</span> of <span className="font-medium text-gray-900">{filtered.length}</span> products
              </span>

              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      className={clsx(
                        "min-w-[32px] rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        page === safePage
                          ? "border-purple-600 bg-purple-600 text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      )}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  Next
                </button>

                <div className="ml-3 flex items-center gap-2 text-xs text-gray-500">
                  <span className="whitespace-nowrap">Per page</span>
                  <Listbox value={pageSize} onChange={(v) => setPageSize(v)}>
                    <div className="relative">
                      <Listbox.Button className="relative w-20 cursor-pointer rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-left text-xs text-gray-800 hover:bg-gray-50 focus:outline-none transition-colors">
                        <span className="block truncate">{pageSize}</span>
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                          <ChevronDown className="h-3 w-3 text-gray-400" />
                        </span>
                      </Listbox.Button>

                      <Transition
                        as={Fragment}
                        leave="transition ease-in duration-150"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                      >
                        <Listbox.Options className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white py-1 shadow-lg focus:outline-none">
                          {pageOptions.map((opt) => (
                            <Listbox.Option
                              key={opt}
                              value={opt}
                              className={({ active }) =>
                                clsx(
                                  "relative cursor-pointer select-none py-2 pl-3 pr-8 text-xs",
                                  active ? "bg-purple-50 text-purple-700" : "text-gray-700"
                                )
                              }
                            >
                              {({ selected }) => (
                                <>
                                  <span className={clsx("block truncate", selected && "font-semibold text-gray-900")}>
                                    {opt}
                                  </span>
                                  {selected && (
                                    <span className="absolute inset-y-0 right-3 flex items-center text-purple-600">
                                      <Check className="h-3 w-3" />
                                    </span>
                                  )}
                                </>
                              )}
                            </Listbox.Option>
                          ))}
                        </Listbox.Options>
                      </Transition>
                    </div>
                  </Listbox>
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
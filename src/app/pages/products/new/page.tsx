"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import clsx from "clsx";

type DiscountType = "fixed" | "percent";

type DescriptionSection = {
  id: string;
  title: string;
  body: string;
};

type OptionGroupKind = "size" | "volume" | "weight" | "color" | "custom";

type OptionValue = {
  id: string;
  label: string;
  colorHex?: string;
};

type OptionGroup = {
  id: string;
  name: string;
  kind: OptionGroupKind;
  values: OptionValue[];
};

type VariantRow = {
  id: string;
  sku: string;
  price: number;
  inventory: number;
  imageUrl?: string;
  options: Record<string, string>; // { "Size": "M", "Color": "Black" }
};

function uuid() {
  return crypto.randomUUID();
}

function slugifySkuPart(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function generateBaseSku(name: string) {
  return slugifySkuPart(name || "PRODUCT");
}

export default function NewProductPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseSku, setBaseSku] = useState("");
  const [isCustomSku, setIsCustomSku] = useState(false);

  const [isVariant, setIsVariant] = useState(false);

  // single-product pricing
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [inventory, setInventory] = useState<number | undefined>(undefined);
  const [discountType, setDiscountType] = useState<DiscountType | null>(null);
  const [discountValue, setDiscountValue] = useState<number | undefined>(
    undefined
  );
  const [discountStart, setDiscountStart] = useState<string>("");
  const [discountEnd, setDiscountEnd] = useState<string>("");
  const [discountAllVariants, setDiscountAllVariants] = useState(false);

  // taxonomy (for now just string arrays, plug in autocomplete later)
  const [wellness, setWellness] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string>("");

  // description accordions
  const [sections, setSections] = useState<DescriptionSection[]>([
    { id: uuid(), title: "Product Details", body: "" },
  ]);

  // variants
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [showVariantModal, setShowVariantModal] = useState(false);

  // auto-generate base SKU from name
  useMemo(() => {
    if (!isCustomSku) {
      setBaseSku(generateBaseSku(name));
    }
  }, [name, isCustomSku]);

  const canSave =
    name.trim().length > 0 &&
    (!isVariant
      ? price !== undefined && !Number.isNaN(price)
      : variants.length > 0);

  function addSection() {
    if (sections.length >= 5) return;
    setSections((prev) => [
      ...prev,
      { id: uuid(), title: "", body: "" },
    ]);
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  function toggleDefaultVariant(kind: OptionGroupKind) {
    setOptionGroups((prev) => {
      const exists = prev.find((g) => g.kind === kind);
      if (exists) {
        return prev.filter((g) => g.kind !== kind);
      }
      const defaultName =
        kind === "size"
          ? "Size"
          : kind === "volume"
          ? "Volume"
          : kind === "weight"
          ? "Weight"
          : kind === "color"
          ? "Color"
          : "Custom Variant";
      return [
        ...prev,
        { id: uuid(), name: defaultName, kind, values: [] },
      ];
    });
  }

  function addCustomGroup() {
    setOptionGroups((prev) => [
      ...prev,
      {
        id: uuid(),
        name: "Custom Variant",
        kind: "custom",
        values: [],
      },
    ]);
  }

  function addOptionValue(groupId: string) {
    setOptionGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              values: [
                ...g.values,
                { id: uuid(), label: `Option ${g.values.length + 1}` },
              ],
            }
          : g
      )
    );
  }

  function updateOptionValue(
    groupId: string,
    valueId: string,
    patch: Partial<OptionValue>
  ) {
    setOptionGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              values: g.values.map((v) =>
                v.id === valueId ? { ...v, ...patch } : v
              ),
            }
          : g
      )
    );
  }

  function removeOptionValue(groupId: string, valueId: string) {
    setOptionGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              values: g.values.filter((v) => v.id !== valueId),
            }
          : g
      )
    );
  }

  // simple manual variant row
  function addVariantRow() {
    const sku = `${baseSku}-${variants.length + 1}`;
    setVariants((prev) => [
      ...prev,
      {
        id: uuid(),
        sku,
        price: 0,
        inventory: 0,
        options: {},
      },
    ]);
  }

  async function handleSave(status: "draft" | "published") {
    if (!canSave) return;

    // shape body for your /api/products route
    const body = {
      status,
      name,
      description,
      baseSku,
      isVariant,
      priceCents: isVariant ? 0 : Math.round((price ?? 0) * 100),
      inventoryQty: isVariant ? 0 : inventory ?? 0,
      discount: discountType
        ? {
            type: discountType,
            value: discountValue ?? 0,
            start: discountStart || null,
            end: discountEnd || null,
            applyToVariants: discountAllVariants,
          }
        : null,
      wellnessIds: wellness, // you’ll map to IDs in the API
      categoryIds: categories,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      sections: sections.map((s, idx) => ({
        title: s.title,
        body: s.body,
        sortOrder: idx,
      })),
      optionGroups,
      variants,
    };

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Error saving product");
        return;
      }
      router.push("/dashboard/products");
    } catch (err) {
      console.error(err);
      alert("Network error");
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F8] px-6 py-6">
      <div className="mx-auto max-w-6xl rounded-3xl bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-8 py-5">
          <div>
            <h1 className="text-2xl font-semibold">Add new product</h1>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleSave("draft")}
              className="h-10 rounded-full border border-gray-300 px-4 text-sm font-medium"
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => handleSave("published")}
              className={clsx(
                "h-10 rounded-full px-6 text-sm font-semibold text-white",
                canSave
                  ? "bg-black hover:bg-gray-900"
                  : "bg-gray-300 cursor-not-allowed"
              )}
            >
              Add Product
            </button>
          </div>
        </div>

        <div className="grid gap-6 px-8 py-6 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            {/* General information */}
            <section className="rounded-2xl border bg-[#FBFBFE] p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                General Information
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-800">
                    Product Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-purple-500 focus:outline-none"
                    placeholder="ENTERDRIVETM™ Grunge Tee"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-800">
                    Product Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-purple-500 focus:outline-none"
                    placeholder="Describe the product, materials, fit, etc."
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-[2fr_minmax(0,1fr)] items-end">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-800">
                        Base SKU
                      </span>
                      <label className="flex items-center gap-2 text-[11px] text-gray-500">
                        <input
                          type="checkbox"
                          checked={isCustomSku}
                          onChange={(e) =>
                            setIsCustomSku(e.target.checked)
                          }
                          className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        Customise SKU
                      </label>
                    </div>
                    <input
                      value={baseSku}
                      onChange={(e) => setBaseSku(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="text-xs">
                    <label className="font-semibold text-gray-800">
                      Product has variants
                    </label>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1">
                      <span className="text-[11px] text-gray-500">
                        Single / Variant
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsVariant((v) => !v)}
                        className={clsx(
                          "relative h-6 w-11 rounded-full transition-colors",
                          isVariant ? "bg-purple-500" : "bg-gray-300"
                        )}
                      >
                        <span
                          className={clsx(
                            "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform",
                            isVariant ? "translate-x-[22px]" : "translate-x-[2px]"
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Pricing & stock */}
            <section className="rounded-2xl border bg-[#FBFBFE] p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                Product Pricing & Stock
              </h2>

              {isVariant && (
                <p className="mb-3 rounded-xl bg-purple-50 px-3 py-2 text-xs text-purple-700">
                  Pricing and inventory are managed per variant. Configure them
                  in the “Variant Inventory Settings” section below.
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                {/* Inventory */}
                <div>
                  <label className="text-xs font-semibold text-gray-800">
                    Inventory Stock
                  </label>
                  <div className="mt-2 flex rounded-2xl border border-gray-200 bg-white text-sm">
                    <span className="flex items-center border-r px-3 text-[11px] text-gray-500">
                      QTY
                    </span>
                    <input
                      type="number"
                      min={0}
                      disabled={isVariant}
                      value={inventory ?? ""}
                      onChange={(e) =>
                        setInventory(
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value)
                        )
                      }
                      className="flex-1 rounded-r-2xl px-3 py-2.5 focus:outline-none disabled:bg-gray-100"
                    />
                  </div>
                </div>

                {/* Price */}
                <div>
                  <label className="text-xs font-semibold text-gray-800">
                    Price
                  </label>
                  <div className="mt-2 flex rounded-2xl border border-gray-200 bg-white text-sm">
                    <span className="flex items-center border-r px-3 text-[11px] text-gray-500">
                      SGD
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={isVariant}
                      value={price ?? ""}
                      onChange={(e) =>
                        setPrice(
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value)
                        )
                      }
                      className="flex-1 rounded-r-2xl px-3 py-2.5 focus:outline-none disabled:bg-gray-100"
                    />
                  </div>
                </div>

                {/* Discount */}
                <div>
                  <label className="text-xs font-semibold text-gray-800">
                    Discount
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={discountType ?? ""}
                      disabled={isVariant}
                      onChange={(e) =>
                        setDiscountType(
                          e.target.value
                            ? (e.target.value as DiscountType)
                            : null
                        )
                      }
                      className="h-10 rounded-2xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none disabled:bg-gray-100"
                    >
                      <option value="">None</option>
                      <option value="fixed">SGD</option>
                      <option value="percent">%</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={isVariant || !discountType}
                      value={discountValue ?? ""}
                      onChange={(e) =>
                        setDiscountValue(
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value)
                        )
                      }
                      className="h-10 w-24 rounded-2xl border border-gray-200 bg-white px-3 text-sm focus:border-purple-500 focus:outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <div className="mt-2 grid gap-2 text-[11px] text-gray-500 md:grid-cols-2">
                    <input
                      type="date"
                      disabled={isVariant || !discountType}
                      value={discountStart}
                      onChange={(e) => setDiscountStart(e.target.value)}
                      className="h-9 rounded-xl border border-gray-200 bg-white px-2 focus:border-purple-500 focus:outline-none disabled:bg-gray-100"
                    />
                    <input
                      type="date"
                      disabled={isVariant || !discountType}
                      value={discountEnd}
                      onChange={(e) => setDiscountEnd(e.target.value)}
                      className="h-9 rounded-xl border border-gray-200 bg-white px-2 focus:border-purple-500 focus:outline-none disabled:bg-gray-100"
                    />
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                    <input
                      type="checkbox"
                      disabled={!isVariant || !discountType}
                      checked={discountAllVariants}
                      onChange={(e) =>
                        setDiscountAllVariants(e.target.checked)
                      }
                      className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:bg-gray-100"
                    />
                    Apply discount to all variants
                  </label>
                </div>
              </div>
            </section>

            {/* Description tabs */}
            <section className="rounded-2xl border bg-[#FBFBFE] p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                  Description Tabs
                </h2>
                <button
                  type="button"
                  onClick={addSection}
                  disabled={sections.length >= 5}
                  className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Add section
                </button>
              </div>

              <div className="mt-4 space-y-5">
                {sections.map((s, idx) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4"
                  >
                    <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-800">
                      <span>Section {idx + 1}</span>
                      {sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSection(s.id)}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      <input
                        value={s.title}
                        onChange={(e) =>
                          setSections((prev) =>
                            prev.map((sec) =>
                              sec.id === s.id
                                ? { ...sec, title: e.target.value }
                                : sec
                            )
                          )
                        }
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                        placeholder="Section title (displayed on app)"
                      />
                      <textarea
                        value={s.body}
                        rows={3}
                        onChange={(e) =>
                          setSections((prev) =>
                            prev.map((sec) =>
                              sec.id === s.id
                                ? { ...sec, body: e.target.value }
                                : sec
                            )
                          )
                        }
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                        placeholder="Section description"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Product variants */}
            <section className="rounded-2xl border bg-[#FBFBFE] p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                  Product Variants
                </h2>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Enable</span>
                  <button
                    type="button"
                    onClick={() => setIsVariant((v) => !v)}
                    className={clsx(
                      "relative h-6 w-11 rounded-full transition-colors",
                      isVariant ? "bg-purple-500" : "bg-gray-300"
                    )}
                  >
                    <span
                      className={clsx(
                        "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform",
                        isVariant ? "translate-x-[22px]" : "translate-x-[2px]"
                      )}
                    />
                  </button>
                </div>
              </div>

              {!isVariant && (
                <p className="mt-4 text-xs text-gray-500">
                  Turn this on if this product has multiple sizes, colors or
                  other options.
                </p>
              )}

              {isVariant && (
                <>
                  {/* Default types */}
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold text-gray-700">
                      Default Variants
                    </p>
                    <div className="space-y-2 rounded-2xl bg-white p-3">
                      {[
                        { kind: "size", label: "Size Variant (e.g S, M, L)" },
                        {
                          kind: "volume",
                          label: "Volume Variant (e.g 30ml, 70ml)",
                        },
                        {
                          kind: "weight",
                          label: "Weight Variant (e.g 100g, 1kg)",
                        },
                        {
                          kind: "color",
                          label: "Color Variant (e.g Black, Purple)",
                        },
                      ].map((item) => {
                        const checked = !!optionGroups.find(
                          (g) => g.kind === item.kind
                        );
                        return (
                          <label
                            key={item.kind}
                            className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-xs"
                          >
                            <span>{item.label}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleDefaultVariant(
                                  item.kind as OptionGroupKind
                                )
                              }
                              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                          </label>
                        );
                      })}
                      <button
                        type="button"
                        onClick={addCustomGroup}
                        className="mt-1 w-full rounded-xl border border-dashed border-purple-300 px-3 py-2 text-center text-xs font-medium text-purple-700"
                      >
                        + Add your own variants
                      </button>
                    </div>
                  </div>

                  {/* Settings */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-800">
                        Variant Settings
                      </h3>
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setShowVariantModal(true)}
                          disabled={variants.length === 0}
                          className="rounded-full border border-gray-300 px-3 py-1 text-xs"
                        >
                          Edit inventory
                        </button>
                        <button
                          type="button"
                          onClick={addVariantRow}
                          className="rounded-full bg-purple-600 px-3 py-1 text-xs font-medium text-white"
                        >
                          Create variations manually
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      {optionGroups.map((g) => (
                        <div
                          key={g.id}
                          className="rounded-2xl border border-gray-200 bg-white p-4"
                        >
                          <label className="text-xs font-semibold text-gray-800">
                            {g.kind === "custom"
                              ? "Custom Variant Name (Displayed on store)"
                              : `${g.name} Variant Name (Displayed on store)`}
                          </label>
                          <input
                            value={g.name}
                            onChange={(e) =>
                              setOptionGroups((prev) =>
                                prev.map((og) =>
                                  og.id === g.id
                                    ? { ...og, name: e.target.value }
                                    : og
                                )
                              )
                            }
                            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                            placeholder={
                              g.kind === "size"
                                ? "Choose Tee Size"
                                : g.kind === "color"
                                ? "Choose Tee Color"
                                : "Choose Variant Name"
                            }
                          />

                          <p className="mt-3 text-[11px] font-semibold text-gray-700">
                            Variants
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {g.values.map((v) => (
                              <div
                                key={v.id}
                                className={clsx(
                                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs border",
                                  g.kind === "color"
                                    ? "border-gray-300"
                                    : "border-gray-200 bg-[#F5F3FF]"
                                )}
                              >
                                {g.kind === "color" && (
                                  <span
                                    className="h-4 w-4 rounded-full border border-gray-200"
                                    style={{
                                      backgroundColor: v.colorHex || "#000000",
                                    }}
                                  />
                                )}
                                <input
                                  value={v.label}
                                  onChange={(e) =>
                                    updateOptionValue(g.id, v.id, {
                                      label: e.target.value,
                                    })
                                  }
                                  className="w-20 bg-transparent text-xs focus:outline-none"
                                />
                                {g.kind === "color" && (
                                  <input
                                    type="color"
                                    value={v.colorHex || "#000000"}
                                    onChange={(e) =>
                                      updateOptionValue(g.id, v.id, {
                                        colorHex: e.target.value,
                                      })
                                    }
                                    className="h-4 w-4 cursor-pointer border-none bg-transparent p-0"
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeOptionValue(g.id, v.id)
                                  }
                                  className="text-xs text-gray-400 hover:text-red-500"
                                >
                                  ×
                                </button>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() => addOptionValue(g.id)}
                              className="inline-flex h-8 items-center justify-center rounded-full border border-dashed border-gray-300 px-3 text-xs text-gray-600"
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* compact list of variants */}
                    {variants.length > 0 && (
                      <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-xs">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-semibold text-gray-800">
                            {variants.length} variants
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowVariantModal(true)}
                            className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white"
                          >
                            Variant Inventory Settings
                          </button>
                        </div>
                        <div className="max-h-40 overflow-y-auto text-[11px] text-gray-600">
                          {variants.map((v) => (
                            <div
                              key={v.id}
                              className="flex items-center justify-between py-1"
                            >
                              <span className="truncate">
                                {v.sku} · {v.inventory} qty · SGD {v.price}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN – media + meta */}
          <div className="space-y-6">
            {/* Product images */}
            <section className="rounded-2xl border bg-[#FBFBFE] p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                Product Images
              </h2>
              <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-200">
                <Image
                  src="/images/auth-hero.svg"
                  alt=""
                  width={640}
                  height={480}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-3 text-xs text-gray-500">
                TODO: plug your image uploader here.
              </p>
            </section>

            {/* Wellness / category / tags */}
            <section className="rounded-2xl border bg-[#FBFBFE] p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                Wellness Dimension, Category & Tags
              </h2>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-gray-800">
                    Wellness Dimensions
                  </label>
                  <input
                    placeholder="Emotional, Physical"
                    value={wellness.join(", ")}
                    onChange={(e) =>
                      setWellness(
                        e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean)
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-800">
                    Categories
                  </label>
                  <input
                    placeholder="Tops, Graphic Tees"
                    value={categories.join(", ")}
                    onChange={(e) =>
                      setCategories(
                        e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean)
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-800">
                    Tags
                  </label>
                  <input
                    placeholder="Use ',' to add more tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Variant inventory modal – simple version */}
      {showVariantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  Variant Inventory Settings
                </h2>
                <p className="text-xs text-gray-500">
                  Update stock, price, and image for each variant. Set stock to
                  0 to hide a variant.
                </p>
              </div>
              <button
                type="button"
                className="text-2xl leading-none text-gray-400 hover:text-black"
                onClick={() => setShowVariantModal(false)}
              >
                ×
              </button>
            </div>

            <div className="max-h-[60vh] overflow-auto px-6 py-4 text-xs">
              <table className="w-full border-separate border-spacing-y-2">
                <thead className="text-[11px] text-gray-500">
                  <tr>
                    <th className="px-2 text-left">SKU</th>
                    <th className="px-2 text-left">Options</th>
                    <th className="px-2 text-left">Price</th>
                    <th className="px-2 text-left">Inventory</th>
                    <th className="px-2 text-left">Image</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, idx) => (
                    <tr key={v.id} className="align-middle">
                      <td className="rounded-l-xl bg-[#F7F7FB] px-3 py-2 font-mono text-[11px]">
                        {v.sku}
                      </td>
                      <td className="bg-[#F7F7FB] px-3 py-2 text-[11px]">
                        {Object.entries(v.options)
                          .map(([k, val]) => `${k}: ${val}`)
                          .join(" · ") || "—"}
                      </td>
                      <td className="bg-[#F7F7FB] px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={v.price}
                          onChange={(e) => {
                            const value = Number(e.target.value) || 0;
                            setVariants((prev) =>
                              prev.map((vv) =>
                                vv.id === v.id ? { ...vv, price: value } : vv
                              )
                            );
                          }}
                          className="h-8 w-24 rounded-lg border border-gray-300 bg-white px-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </td>
                      <td className="bg-[#F7F7FB] px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={v.inventory}
                          onChange={(e) => {
                            const value = Number(e.target.value) || 0;
                            setVariants((prev) =>
                              prev.map((vv) =>
                                vv.id === v.id
                                  ? { ...vv, inventory: value }
                                  : vv
                              )
                            );
                          }}
                          className="h-8 w-20 rounded-lg border border-gray-300 bg-white px-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </td>
                      <td className="rounded-r-xl bg-[#F7F7FB] px-3 py-2">
                        <button className="rounded-full border border-gray-300 px-3 py-1 text-[11px]">
                          Upload
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {variants.length === 0 && (
                <p className="py-10 text-center text-xs text-gray-500">
                  No variants yet. Use “Create variations manually” to add some.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <button
                type="button"
                onClick={() => setShowVariantModal(false)}
                className="h-9 rounded-full border border-gray-300 px-4 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowVariantModal(false)}
                className="h-9 rounded-full bg-black px-5 text-xs font-semibold text-white"
              >
                Save Variants
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
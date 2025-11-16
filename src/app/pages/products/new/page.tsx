// app/pages/products/new/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import Sidebar from "../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";

import { ProductPricingAndStock } from "../../../../components/product/ProductPricingAndStock";
import { ProductGeneralInfo } from "../../../../components/product/ProductGeneralInfo";
import { ProductDescriptionTabs } from "../../../../components/product/ProductDescriptionTabs";
import {
  ProductVariantChooser,
  OptionGroupKind as BaseOptionGroupKind,
} from "../../../../components/product/ProductVariantChooser";
import { ProductVariantSettings } from "../../../../components/product/ProductVariantSettings";
import { ProductImagesGallery, ProductImage } from "../../../../components/product/ProductImagesGallery";


/* ---------- Types ---------- */

type DiscountType = "fixed" | "percent";

// local kind also allows "custom" for our state
export type OptionGroupKind = BaseOptionGroupKind | "custom";

type DescriptionSection = {
  id: string;
  title: string;
  body: string;
};

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
  imageUrl?: string | null;
  options: Record<string, string>;
};

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed: boolean;
};

/* ---------- Helpers ---------- */

function uuid() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
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

function buildVariantSku(
  baseSku: string,
  index: number,
  customSuffix?: string
) {
  const skuNumber = String(index + 1).padStart(3, "0");
  const suffixPart = customSuffix?.trim() ? `-${customSuffix.trim()}` : "";
  return `${baseSku}${suffixPart}-${skuNumber}`.toUpperCase();
}

/**
 * Build all possible variants from the selected option groups.
 */
function generateVariantCombinations(
  optionGroups: OptionGroup[],
  baseSku: string,
  defaultPrice: number,
  customSkuSuffix?: string
): VariantRow[] {
  const activeGroups = optionGroups.filter((g) => g.values.length > 0);
  if (activeGroups.length === 0) return [];

  type Combo = Record<string, OptionValue>;
  let combos: Combo[] = [];

  for (const group of activeGroups) {
    if (combos.length === 0) {
      combos = group.values.map((v) => ({ [group.id]: v }));
    } else {
      const next: Combo[] = [];
      for (const combo of combos) {
        for (const v of group.values) {
          next.push({ ...combo, [group.id]: v });
        }
      }
      combos = next;
    }
  }

  return combos.map((combo, idx) => {
    const options: Record<string, string> = {};
    for (const group of activeGroups) {
      const v = combo[group.id];
      if (v) options[group.name] = v.label;
    }

    return {
      id: uuid(),
      sku: buildVariantSku(baseSku, idx, customSkuSuffix),
      price: defaultPrice,
      inventory: 0,
      imageUrl: null,
      options,
    };
  });
}

/* ---------- Page ---------- */

export default function NewProductPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);

  // core product fields
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

  // taxonomy
  const [wellness, setWellness] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string>("");

  // description accordions
  const [sections, setSections] = useState<DescriptionSection[]>([
    { id: uuid(), title: "Product Details", body: "" },
  ]);

  // main product image
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);

  // variants
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [showVariantModal, setShowVariantModal] = useState(false);

  const [customSkuEnabled, setCustomSkuEnabled] = useState(false);
  const [customSkuSuffix, setCustomSkuSuffix] = useState("");
  const [baseVariantPrice, setBaseVariantPrice] = useState<number | undefined>(
    undefined
  );

  const [variantsCollapsed, setVariantsCollapsed] = useState(false);

  const [images, setImages] = useState<ProductImage[]>([]);


  // sidebar config
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

  // load profile for sidebar
  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("id,email,status,onboarding_completed,full_name")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (isMounted && prof) {
        setProfile(prof as Profile);
      }
    }

    void loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  // base kinds only (no "custom") – matches ProductVariantChooser
  const selectedKinds: BaseOptionGroupKind[] = optionGroups
    .filter(
      (g): g is OptionGroup & { kind: BaseOptionGroupKind } =>
        g.kind !== "custom"
    )
    .map((g) => g.kind);

  // auto-generate base SKU from name when not using custom overrides
  useEffect(() => {
    if (!isCustomSku && !customSkuEnabled) {
      setBaseSku(generateBaseSku(name));
    }
  }, [name, isCustomSku, customSkuEnabled]);

  const canSave =
    name.trim().length > 0 &&
    (!isVariant
      ? price !== undefined && !Number.isNaN(price)
      : variants.length > 0);

  /* ---------- Variant option helpers ---------- */

  function addCustomGroup() {
    setOptionGroups((prev) => [
      ...prev,
      {
        id: uuid(),
        name: "Custom Variant",
        kind: "custom" as OptionGroupKind,
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

  // manual row (still available if you want to use it somewhere)
  function addVariantRow() {
    const sku = `${baseSku || "SKU"}-${String(variants.length + 1).padStart(
      3,
      "0"
    )}`;
    setVariants((prev) => [
      ...prev,
      {
        id: uuid(),
        sku,
        price: baseVariantPrice ?? 0,
        inventory: 0,
        imageUrl: null,
        options: {},
      },
    ]);
  }

  // move variant row up/down
  function moveVariant(fromIndex: number, toIndex: number) {
    setVariants((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const copy = [...prev];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      return copy;
    });
  }

  // per-row image upload
  function handleVariantImageChange(id: string, file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, imageUrl: url } : v))
    );
  }

  // main product image upload
  function handleProductImageChange(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setProductImageUrl(url);
  }

  /* ---------- Save ---------- */

  async function handleSave(status: "draft" | "published") {
    if (!canSave) return;

    const apiVariants = variants.map((v) => ({
      sku: v.sku,
      priceCents: Math.round((v.price ?? 0) * 100),
      inventoryQty: v.inventory ?? 0,
      imageUrl: v.imageUrl ?? null,
      optionsJson: v.options ?? {},
    }));

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
      wellnessIds: wellness,
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
      productImageUrl, // adapt name on API side if needed
      optionGroups,
      variants: apiVariants,
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
      router.push("/pages/products");
    } catch (err) {
      console.error(err);
      alert("Network error");
    }
  }

  /* ---------- UI ---------- */

  return (
    <div className="flex h-screen w-screen bg-[#050509] overflow-hidden">
      {/* Sidebar on the left */}
      <Sidebar config={sidebarConfig} />

      {/* Black bezel + inner tablet */}
      <div className="flex flex-1 items-stretch justify-center px-3 py-3 sm:px-6 sm:py-4">
        {/* Big rounded tablet container */}
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Sticky top bar inside tablet */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-4 py-4 sm:px-8">
            <h1 className="text-lg font-semibold text-[#1B1529] sm:text-2xl">
              Add new product
            </h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => handleSave("draft")}
                className="h-9 rounded-full border border-gray-300 px-3 text-xs font-medium sm:h-10 sm:px-4 sm:text-sm bg-white"
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={() => handleSave("published")}
                className={clsx(
                  "h-9 rounded-full px-4 text-xs font-semibold text-white sm:h-10 sm:px-6 sm:text-sm",
                  canSave
                    ? "bg-black hover:bg-gray-900"
                    : "cursor-not-allowed bg-gray-300"
                )}
              >
                Add Product
              </button>
            </div>
          </div>

          {/* Scrollable body inside tablet */}
          <div className="flex-1 overflow-auto px-3 py-4 sm:px-6 sm:py-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] lg:gap-6">
              {/* LEFT COLUMN – main config */}
              <div className="space-y-4 sm:space-y-6">
                <ProductGeneralInfo
                  name={name}
                  description={description}
                  baseSku={baseSku}
                  isCustomSku={isCustomSku}
                  isVariant={isVariant}
                  onNameChange={setName}
                  onDescriptionChange={setDescription}
                  onBaseSkuChange={setBaseSku}
                  onToggleCustomSku={setIsCustomSku}
                  onToggleVariant={setIsVariant}
                />

                <ProductDescriptionTabs
                  sections={sections}
                  onChange={setSections}
                  maxSections={5}
                />

                <ProductPricingAndStock
                  isVariant={isVariant}
                  baseSku={baseSku}
                  customSkuEnabled={customSkuEnabled}
                  customSkuSuffix={customSkuSuffix}
                  onBaseSkuChange={setBaseSku}
                  onToggleCustomSku={setCustomSkuEnabled}
                  onCustomSkuSuffixChange={setCustomSkuSuffix}
                  inventory={inventory}
                  price={price}
                  discountType={discountType}
                  discountValue={discountValue}
                  discountStart={discountStart}
                  discountEnd={discountEnd}
                  discountAllVariants={discountAllVariants}
                  onInventoryChange={setInventory}
                  onPriceChange={setPrice}
                  onDiscountTypeChange={setDiscountType}
                  onDiscountValueChange={setDiscountValue}
                  onDiscountStartChange={setDiscountStart}
                  onDiscountEndChange={setDiscountEnd}
                  onDiscountAllVariantsChange={setDiscountAllVariants}
                  baseVariantPrice={baseVariantPrice}
                  onBaseVariantPriceChange={setBaseVariantPrice}
                />

                <ProductVariantChooser
                  enabled={isVariant}
                  onToggleEnabled={setIsVariant}
                  selectedKinds={selectedKinds}
                  onToggleKind={(kind) => {
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
                          : "Color";
                      return [
                        ...prev,
                        {
                          id: uuid(),
                          name: defaultName,
                          kind, // BaseOptionGroupKind
                          values: [],
                        },
                      ];
                    });
                  }}
                  onAddCustomGroup={addCustomGroup}
                  collapsed={variantsCollapsed}
                  onToggleCollapsed={() => setVariantsCollapsed((c) => !c)}
                />

                <ProductVariantSettings
                  optionGroups={optionGroups}
                  onGroupNameChange={(groupId, name) =>
                    setOptionGroups((prev) =>
                      prev.map((g) => (g.id === groupId ? { ...g, name } : g))
                    )
                  }
                  onAddOptionValue={addOptionValue}
                  onUpdateOptionValue={updateOptionValue}
                  onRemoveOptionValue={removeOptionValue}
                  onAddCustomGroup={addCustomGroup}
                  onGenerateVariants={() => {
                    const defaultPrice = baseVariantPrice ?? price ?? 0;
                    const generated = generateVariantCombinations(
                      optionGroups,
                      baseSku,
                      defaultPrice,
                      customSkuEnabled ? customSkuSuffix : undefined
                    );
                    setVariants(generated);
                    if (generated.length > 0) {
                      setShowVariantModal(true);
                    }
                  }}
                />

                {/* View / edit all variants pill */}
                {isVariant && (
                  <button
                    type="button"
                    onClick={() =>
                      variants.length > 0 && setShowVariantModal(true)
                    }
                    disabled={variants.length === 0}
                    className={clsx(
                      "mt-2 flex w-full items-center justify-between rounded-full px-4 py-3 text-xs font-semibold sm:mt-3 sm:px-5 sm:text-sm",
                      "transition-colors",
                      variants.length === 0
                        ? "cursor-not-allowed bg-[#F3E8FF] text-gray-400"
                        : "bg-[#E7D6FF] text-gray-900 hover:bg-[#ddc6ff]"
                    )}
                  >
                    <span>View &amp; Edit All Variants</span>
                    <span className="text-base leading-none">›</span>
                  </button>
                )}
              </div>

              {/* RIGHT COLUMN – media + meta */}
              <div className="space-y-4 sm:space-y-6">
                {/* Product images */}
                <section className="rounded-2xl border bg-[#FBFBFE] p-4 sm:p-6">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700 sm:mb-4 sm:text-sm">
                    Product Images
                  </h2>

                  <ProductImagesGallery
                      images={images}
                      onChange={setImages}
                      maxImages={6}        // 1 main + 5 thumbnails
                    />

                  <div className="mt-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-gray-500">
                      Upload a main product image.
                    </p>
                    <label className="cursor-pointer rounded-full bg-black px-4 py-2 text-[11px] font-semibold text-white">
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleProductImageChange(e.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                  </div>
                </section>

                {/* Wellness / category / tags */}
                <section className="rounded-2xl border bg-[#FBFBFE] p-4 sm:p-6">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700 sm:mb-4 sm:text-sm">
                    Wellness Dimension, Category &amp; Tags
                  </h2>

                  <div className="space-y-3 text-xs sm:space-y-4">
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
        </div>
      </div>

      {/* Variant inventory modal */}
      {showVariantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <h2 className="text-sm font-semibold sm:text-lg">
                  Variant Inventory Settings
                </h2>
                <p className="text-[11px] text-gray-500 sm:text-xs">
                  Update stock, price, and images for each variant. Set stock to
                  0 to hide one.
                </p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setShowVariantModal(false)}
                  className="h-8 rounded-full bg-black px-4 text-[11px] font-semibold text-white sm:h-9 sm:px-5 sm:text-xs"
                >
                  Save Variants
                </button>
                <button
                  type="button"
                  className="text-xl leading-none text-gray-400 hover:text-black sm:text-2xl"
                  onClick={() => setShowVariantModal(false)}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal body – table */}
            <div className="max-h-[60vh] overflow-auto px-3 py-3 text-xs sm:px-6 sm:py-4">
              <table className="w-full border-separate border-spacing-y-2">
                <thead className="text-[11px] text-gray-500">
                  <tr>
                    <th className="px-2 text-left">Re order</th>
                    {optionGroups
                      .filter((g) => g.values.length > 0)
                      .map((g) => (
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
                  {variants.map((v, index) => {
                    const inputId = `variant-image-${v.id}`;
                    return (
                      <tr key={v.id} className="align-middle">
                        {/* Reorder controls */}
                        <td className="rounded-l-xl bg-[#F7F7FB] px-2 py-2 text-center align-middle">
                          <div className="flex flex-col items-center gap-1 text-gray-400">
                            <button
                              type="button"
                              onClick={() => moveVariant(index, index - 1)}
                              className={clsx(
                                "h-4 w-4 text-xs leading-none",
                                index === 0 && "opacity-30 cursor-default"
                              )}
                              disabled={index === 0}
                            >
                              ↑
                            </button>
                            <span className="text-lg leading-none">≡</span>
                            <button
                              type="button"
                              onClick={() => moveVariant(index, index + 1)}
                              className={clsx(
                                "h-4 w-4 text-xs leading-none",
                                index === variants.length - 1 &&
                                  "opacity-30 cursor-default"
                              )}
                              disabled={index === variants.length - 1}
                            >
                              ↓
                            </button>
                          </div>
                        </td>

                        {/* Option columns */}
                        {optionGroups
                          .filter((g) => g.values.length > 0)
                          .map((g) => (
                            <td key={g.id} className="bg-[#F7F7FB] px-3 py-2">
                              <div className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[11px] text-gray-800">
                                {v.options[g.name] ?? "—"}
                              </div>
                            </td>
                          ))}

                        {/* Price */}
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
                              onChange={(e) => {
                                const value = Number(e.target.value) || 0;
                                setVariants((prev) =>
                                  prev.map((vv) =>
                                    vv.id === v.id
                                      ? { ...vv, price: value }
                                      : vv
                                  )
                                );
                              }}
                              className="h-8 w-20 rounded-xl border border-gray-300 bg-white px-2 text-xs focus:border-purple-500 focus:outline-none sm:w-24"
                            />
                          </div>
                        </td>

                        {/* Inventory */}
                        <td className="bg-[#F7F7FB] px-3 py-2">
                          <div className="flex items-center gap-1">
                            <span className="rounded-xl border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-500">
                              QTY
                            </span>
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
                              className="h-8 w-16 rounded-xl border border-gray-300 bg-white px-2 text-xs focus:border-purple-500 focus:outline-none sm:w-20"
                            />
                          </div>
                        </td>

                        {/* Upload image (per variant) */}
                        <td className="rounded-r-xl bg-[#F7F7FB] px-3 py-2">
                          <label
                            htmlFor={inputId}
                            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-dashed border-gray-300 bg-white text-lg text-gray-400 cursor-pointer"
                          >
                            {v.imageUrl ? (
                              <img
                                src={v.imageUrl}
                                alt="Variant"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              "+"
                            )}
                            <input
                              id={inputId}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) =>
                                handleVariantImageChange(
                                  v.id,
                                  e.target.files?.[0] ?? null
                                )
                              }
                            />
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {variants.length === 0 && (
                <p className="py-8 text-center text-[11px] text-gray-500 sm:py-10 sm:text-xs">
                  No variants yet. Use “Generate Variations” to create them.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// app/pages/products/[productId]/edit/page.tsx
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import { ProductPricingAndStock } from "../../../../../components/product/ProductPricingAndStock";
import { ProductGeneralInfo } from "../../../../../components/product/ProductGeneralInfo";
import {
  ProductDescriptionTabs,
  validateDescriptionSections,
} from "../../../../../components/product/ProductDescriptionTabs";
import {
  ProductVariantChooser,
  OptionGroupKind as BaseOptionGroupKind,
} from "../../../../../components/product/ProductVariantChooser";
import { ProductVariantSettings } from "../../../../../components/product/ProductVariantSettings";

import Sidebar from "../../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../../lib/supabase/client";

import {
  ProductImagesGallery,
  ProductImage,
} from "../../../../../components/product/ProductImagesGallery";

import WellnessCategoryTagsSection, {
  WellnessOption,
} from "../../../../../components/taxonomy/WellnessCategoryTagsSection";

import AppModal from "../../../../../components/common/AppModal";
import ClipLoader from "react-spinners/ClipLoader";
import { useAuthGuard } from "../../../../../hooks/useAuthGuard";

/* ---------- Types ---------- */

type DiscountType = "fixed" | "percent";
export type OptionGroupKind = BaseOptionGroupKind | "custom";

type DescriptionSection = {
  id: string;
  title: string;
  body: string;
  sortOrder?: number;
};

type OptionValue = {
  id: string;
  label: string;
  colorHex?: string;
};

type WellnessDimension = {
  id: string;
  name: string;
  slug: string;
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
  imageFile?: File | null; // holds file when user updates image
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
function ChipsInput({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");

  function commitValue() {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!items.includes(trimmed)) {
      onChange([...items, trimmed]);
    }
    setValue("");
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white px-2 py-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded-full bg-[#EFEDFF] px-3 py-1 text-xs font-medium text-gray-800"
        >
          {item}
          <button
            type="button"
            className="ml-1 text-[10px] text-gray-500 hover:text-gray-800"
            onClick={() => onChange(items.filter((x) => x !== item))}
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
            commitValue();
          } else if (e.key === "Backspace" && !value && items.length > 0) {
            onChange(items.slice(0, -1));
          }
        }}
        onBlur={commitValue}
      />
    </div>
  );
}

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

function generateBaseSku(input: string) {
  return slugifySkuPart(input || "PRODUCT");
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
      imageFile: null,
      options,
    };
  });
}

/**
 * Upload an image file to Supabase Storage and return the public URL.
 * Bucket: "product-images"
 */
async function uploadImageToSupabase(
  file: File,
  vendorId: string | null
): Promise<string> {
  const bucket = "product-images";

  const ext = file.name.split(".").pop() || "jpg";
  const fileName =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : uuid();
  const path = vendorId ? `${vendorId}/${fileName}.${ext}` : `${fileName}.${ext}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error || !data) {
    console.error("Supabase upload error", error);
    throw error || new Error("Upload failed");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return publicUrl;
}

/* ---------- Page ---------- */

export default function EditProductPage({
  params,
}: {
  params: { productId: string };
}) {
  const router = useRouter();
  const { productId } = params;

  const [loading, setLoading] = useState(true);

  // sidebar profile
  const [profile, setProfile] = useState<Profile | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);

  // main fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseSku, setBaseSku] = useState("");
  const [isCustomSku, setIsCustomSku] = useState(false);

  const [isVariant, setIsVariant] = useState(false);

  // pricing
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [inventory, setInventory] = useState<number | undefined>(undefined);
  const [discountType, setDiscountType] = useState<DiscountType | null>(null);
  const [discountValue, setDiscountValue] = useState<number | undefined>(
    undefined
  );
  const [discountStart, setDiscountStart] = useState<string>("");
  const [discountEnd, setDiscountEnd] = useState<string>("");
  const [discountAllVariants, setDiscountAllVariants] = useState(false);

  // description sections
  const [sections, setSections] = useState<DescriptionSection[]>([
    { id: uuid(), title: "Product Details", body: "" },
  ]);

  // images
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]); // gallery images

  // variants data
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [showVariantModal, setShowVariantModal] = useState(false);

  const [customSkuEnabled, setCustomSkuEnabled] = useState(false);
  const [customSkuSuffix, setCustomSkuSuffix] = useState("");
  const [baseVariantPrice, setBaseVariantPrice] =
    useState<number | undefined>(undefined);

  // ✅ remember original base price for variants from the DB
  const [originalBaseVariantPrice, setOriginalBaseVariantPrice] =
    useState<number | undefined>(undefined);

  // ✅ modal state when baseVariantPrice changed
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [pendingStatus, setPendingStatus] =
    useState<"draft" | "published" | null>(null);

  const [variantsCollapsed, setVariantsCollapsed] = useState(false);

  const [wellnessOptions, setWellnessOptions] = useState<WellnessOption[]>([]);
  const [selectedWellnessIds, setSelectedWellnessIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // validation state
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showDescriptionErrorModal, setShowDescriptionErrorModal] =
    useState(false);
  const descriptionSectionRef = useRef<HTMLDivElement | null>(null);

  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [showCategoryErrorModal, setShowCategoryErrorModal] = useState(false);
  const categorySectionRef = useRef<HTMLDivElement | null>(null);

  /* ---------- Sidebar config ---------- */

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? "",
        role: "Vendor",
        status: profile?.status ?? "active",
      }),
    [profile]
  );

  /* ---------- Load profile + vendor id ---------- */

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      if (isMounted) {
        setVendorId(auth.user.id);
      }

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

  /* ---------- Load existing product ---------- */

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const res = await fetch(`/api/products/${productId}`, {
          headers: {
            Authorization: session?.access_token
              ? `Bearer ${session.access_token}`
              : "",
          },
        });
        if (!res.ok) {
          console.error("Failed to load product");
          setLoading(false);
          return;
        }
        const data = await res.json();

        // main fields
        setName(data.name ?? "");
        setDescription(data.description ?? "");
        setBaseSku(data.baseSku ?? generateBaseSku(data.name ?? ""));
        setIsVariant(!!data.isVariant);

        // discount
        if (data.discount) {
          setDiscountType(data.discount.type as DiscountType);
          setDiscountValue(data.discount.value ?? undefined);
          setDiscountStart(data.discount.start ?? "");
          setDiscountEnd(data.discount.end ?? "");
          setDiscountAllVariants(!!data.discount.applyToVariants);
        } else {
          setDiscountType(null);
          setDiscountValue(undefined);
          setDiscountStart("");
          setDiscountEnd("");
          setDiscountAllVariants(false);
        }

        // pricing / inventory + variants
        if (data.isVariant) {
          setPrice(undefined);
          setInventory(undefined);

          const loadedVariants: VariantRow[] = (data.variants ?? []).map(
            (v: any) => ({
              id: String(v.id),
              sku: v.sku,
              price: (v.priceCents ?? 0) / 100,
              inventory: v.inventoryQty ?? 0,
              imageUrl: v.imageUrl ?? null,
              imageFile: null,
              options: v.options ?? {},
            })
          );
          setVariants(loadedVariants);

          setOptionGroups(
            (data.optionGroups ?? []).map((g: any) => ({
              id: String(g.id),
              name: g.name,
              kind: g.kind,
              values: (g.values ?? []).map((v: any) => ({
                id: String(v.id),
                label: v.label,
                colorHex: v.colorHex,
              })),
            }))
          );

          // ✅ derive base variant price from existing variants
          const variantPrices = loadedVariants
            .map((v) => v.price)
            .filter(
              (p) => typeof p === "number" && !Number.isNaN(p as number)
            ) as number[];

          if (variantPrices.length > 0) {
            const priceFromVariants = variantPrices[0]; // or Math.min(...variantPrices)
            setBaseVariantPrice(priceFromVariants);
            setOriginalBaseVariantPrice(priceFromVariants);
          } else {
            setBaseVariantPrice(undefined);
            setOriginalBaseVariantPrice(undefined);
          }
        } else {
          setPrice(
            typeof data.priceCents === "number"
              ? data.priceCents / 100
              : undefined
          );
          setInventory(data.inventoryQty ?? undefined);
          setVariants([]);
          setOptionGroups([]);
          setBaseVariantPrice(undefined);
          setOriginalBaseVariantPrice(undefined);
        }

        // sections
        const mappedSections: DescriptionSection[] = (data.sections ?? []).map(
          (s: any) => ({
            id: s.id ?? uuid(),
            title: s.title ?? "",
            body: s.body ?? "",
            sortOrder: s.sortOrder ?? s.sort_order ?? 0,
          })
        );
        mappedSections.sort(
          (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        );
        setSections(
          mappedSections.length > 0
            ? mappedSections
            : [{ id: uuid(), title: "Product Details", body: "" }]
        );

        // taxonomy / meta
        setSelectedWellnessIds(data.wellnessIds ?? []);
        setCategories(data.categoryIds ?? []);
        setTags(data.tags ?? []);

        // wellness dimensions (for UI cards)
        const { data: wellnessData } = await supabase
          .from("wellness_dimensions")
          .select("id,name,slug");

        setWellnessOptions((wellnessData ?? []) as WellnessDimension[]);

        // images
        setProductImageUrl(data.productImageUrl ?? null);
        setProductImageFile(null);

        setImages(
          (data.galleryImageUrls ?? []).map((url: string, idx: number) => ({
            id: String(idx),
            url,
            file: null,
          }))
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [productId]);

  /* ---------- Derived ---------- */

  const selectedKinds: BaseOptionGroupKind[] = optionGroups
    .filter(
      (g): g is OptionGroup & { kind: BaseOptionGroupKind } =>
        g.kind !== "custom"
    )
    .map((g) => g.kind);

  useEffect(() => {
    if (!isCustomSku && !customSkuEnabled && !loading) {
      setBaseSku(generateBaseSku(name));
    }
  }, [name, isCustomSku, customSkuEnabled, loading]);

  const canSave =
    name.trim().length > 0 &&
    (!isVariant
      ? price !== undefined && !Number.isNaN(price)
      : variants.length > 0);

  const descriptionHasError =
    submitAttempted && !validateDescriptionSections(sections);

  /* ---------- Variant helpers ---------- */

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
                { id: uuid(), label: `` },
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

  function handleVariantImageChange(id: string, file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVariants((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, imageUrl: url, imageFile: file } : v
      )
    );
  }

  function handleProductImageChange(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setProductImageUrl(url);
    setProductImageFile(file);
  }

  /* ---------- Internal save helper ---------- */

  async function performSave(
    status: "draft" | "published",
    applyBasePriceToVariants: boolean
  ) {
    try {
      // 1) Upload main product image if changed
      let finalProductImageUrl = productImageUrl;
      if (productImageFile && vendorId) {
        finalProductImageUrl = await uploadImageToSupabase(
          productImageFile,
          vendorId
        );
      }

      // 2) Upload / keep gallery images
      const galleryImageUrls: string[] = [];
      for (const img of images) {
        if (img.file && vendorId) {
          const url = await uploadImageToSupabase(img.file, vendorId);
          galleryImageUrls.push(url);
        } else if (img.url) {
          galleryImageUrls.push(img.url);
        }
      }

      // 3) Prepare variants (optionally override prices with baseVariantPrice)
      const variantsToSave = isVariant
        ? variants.map((v) => ({
            ...v,
            price:
              applyBasePriceToVariants && baseVariantPrice != null
                ? baseVariantPrice
                : v.price,
          }))
        : [];

      const variantUploads = await Promise.all(
        variantsToSave.map(async (v) => {
          let imageUrl = v.imageUrl ?? null;
          if (v.imageFile && vendorId) {
            imageUrl = await uploadImageToSupabase(v.imageFile, vendorId);
          }
          return {
            sku: v.sku,
            priceCents: Math.round((v.price ?? 0) * 100),
            inventoryQty: v.inventory ?? 0,
            imageUrl,
            optionsJson: v.options ?? {},
          };
        })
      );

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
        wellnessIds: selectedWellnessIds,
        categoryIds: categories,
        tags,
        sections: sections.map((s, idx) => ({
          id: s.id ?? uuid(),
          title: s.title,
          body: s.body,
          sortOrder: idx,
        })),
        productImageUrl: finalProductImageUrl,
        galleryImageUrls,
        optionGroups,
        variants: variantUploads,
      };

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        body: JSON.stringify(body),
        headers: {
          Authorization: session?.access_token
            ? `Bearer ${session.access_token}`
            : "",
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Error saving product");
        return;
      }

      // after successful save, update "original" baseline to current value
      if (isVariant) {
        setOriginalBaseVariantPrice(baseVariantPrice);
      }

      router.push("/pages/products");
    } catch (err) {
      console.error(err);
      alert("Error uploading image or saving product");
    }
  }

  /* ---------- Save (with modal decision) ---------- */

  async function handleSave(status: "draft" | "published") {
    setSubmitAttempted(true);

    // 1) Validate description sections – no empty titles
    if (!validateDescriptionSections(sections)) {
      setShowDescriptionErrorModal(true);
      return;
    }

    // 2) Validate categories for published products
    if (status === "published" && categories.length === 0) {
      setCategoryError("Please add at least one category.");
      setShowCategoryErrorModal(true);
      return;
    } else {
      setCategoryError(null);
    }

    if (!canSave) return;

    // 3) If product has variants and base price changed, show modal
    const hasVariants = isVariant && variants.length > 0;
    const bothPricesDefined =
      originalBaseVariantPrice != null && baseVariantPrice != null;
    const basePriceChanged =
      bothPricesDefined &&
      Math.round(originalBaseVariantPrice! * 100) !==
        Math.round(baseVariantPrice! * 100);

    if (hasVariants && basePriceChanged) {
      setPendingStatus(status);
      setShowRegenerateModal(true);
      return;
    }

    // 4) Normal save – keep current variant prices
    await performSave(status, false);
  }

  /* ---------- Loading state ---------- */

  if (loading) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
        <Sidebar config={sidebarConfig} />
        <div className="flex flex-1 items-stretch justify-center px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex h-full w-full items-center justify-center rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
            <p className="w-full text-center text-sm text-gray-500">
              <ClipLoader size={55} color="#8884ff" />
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- UI ---------- */

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      {/* Sidebar */}
      <Sidebar config={sidebarConfig} />

      {/* Black bezel + tablet */}
      <div className="flex flex-1 items-stretch justify.center px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Sticky header */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5E0FF] bg-gradient.to-r from-[#F6F0FF] to-[#FDFBFF] px-4 py-4 sm:px-8">
            <h1 className="text-lg font-semibold text-[#1B1529] sm:text-2xl">
              Edit product
            </h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => handleSave("draft")}
                className="h-9 rounded-full border border-gray-300 bg-white px-3 text-xs font-medium sm:h-10 sm:px-4 sm:text-sm"
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
                Update Product
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-auto px-3 py-4 sm:px-6 sm:py-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] lg:gap-6">
              {/* LEFT COLUMN */}
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

                <div ref={descriptionSectionRef}>
                  <ProductDescriptionTabs
                    sections={sections}
                    onChange={setSections}
                    maxSections={5}
                    submitAttempted={submitAttempted}
                  />

                  {descriptionHasError && (
                    <p className="mt-1 text-[11px] text-red-600">
                      Please fill in all section titles before saving the
                      product.
                    </p>
                  )}
                </div>

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
                          kind,
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

                {isVariant && (
                  <button
                    type="button"
                    onClick={() =>
                      variants.length > 0 && setShowVariantModal(true)
                    }
                    disabled={variants.length === 0}
                    className={clsx(
                      "mt-2 flex w-full items-center justify-between rounded-full px-4 py-3 text-xs font-semibold sm:mt-3 sm:px-5 sm:text-sm",
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

              {/* RIGHT COLUMN */}
              <div className="space-y-4 sm:space-y-6">
                {/* Product images */}
                <section className="rounded-2xl border bg-[#FBFBFE] p-4 sm:p-6">
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700 sm:mb-4 sm:text-sm">
                    Product Images
                  </h2>

                  {/* Main image */}
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-200">
                    {productImageUrl ? (
                      <img
                        src={productImageUrl}
                        alt="Product preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                        Main product image
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-gray-500">
                      Upload / replace the main product image.
                    </p>
                    <label className="cursor-pointer rounded-full bg-black px-4 py-2 text-[11px] font-semibold text-white">
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleProductImageChange(
                            e.target.files?.[0] ?? null
                          )
                        }
                      />
                    </label>
                  </div>

                  {/* Gallery images */}
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold text-gray-800">
                      Gallery Images
                    </h3>
                    <p className="mt-1 text-[11px] text-gray-500">
                      Add up to 5 gallery images.
                    </p>
                    <ProductImagesGallery
                      images={images}
                      onChange={setImages}
                      maxImages={5}
                    />
                  </div>
                </section>

                {/* Wellness / category / tags */}
                <div ref={categorySectionRef}>
                  <WellnessCategoryTagsSection
                    title="Wellness Dimension, Category & Tags"
                    wellnessOptions={wellnessOptions}
                    selectedWellnessIds={selectedWellnessIds}
                    onChangeWellness={setSelectedWellnessIds}
                    categories={categories}
                    onChangeCategories={setCategories}
                    tags={tags}
                    onChangeTags={setTags}
                  />

                  {categoryError && (
                    <p className="mt-1 text-[11px] text-red-600">
                      {categoryError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Variant modal */}
      {showVariantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <h2 className="text-sm font-semibold sm:text-lg">
                  Variant Inventory Settings
                </h2>
                <p className="text-[11px] text-gray-500 sm:text-xs">
                  Update stock, price, and images for each variant.
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

                        {optionGroups
                          .filter((g) => g.values.length > 0)
                          .map((g) => (
                            <td key={g.id} className="bg-[#F7F7FB] px-3 py-2">
                              <div className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[11px] text-gray-800">
                                {v.options[g.name] ?? "—"}
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

                        <td className="rounded-r-xl bg-[#F7F7FB] px-3 py-2">
                          <label
                            htmlFor={inputId}
                            className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-gray-300 bg.white text-lg text-gray-400"
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

      {/* Description sections error modal */}
      <AppModal
        open={showDescriptionErrorModal}
        title="Section Title Required"
        message={
          <>
            One or more{" "}
            <span className="font-medium text-[#5B33FF]">description tabs</span>{" "}
            have an empty title. Please fill in all section titles before
            saving the product.
          </>
        }
        primaryLabel="Go to Description"
        onPrimaryClick={() => {
          setShowDescriptionErrorModal(false);
          descriptionSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
        onClose={() => setShowDescriptionErrorModal(false)}
      />

      {/* Category error modal */}
      <AppModal
        open={showCategoryErrorModal}
        title="Category Required"
        message={
          <>
            To publish this product, please add at least one category in the{" "}
            <span className="font-medium text-[#5B33FF]">
              Wellness Dimension, Category &amp; Tags
            </span>{" "}
            section.
          </>
        }
        primaryLabel="Go to Category"
        onPrimaryClick={() => {
          setShowCategoryErrorModal(false);
          categorySectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
        onClose={() => setShowCategoryErrorModal(false)}
      />

      {/* Base variant price changed modal */}
      <AppModal
        open={showRegenerateModal}
        title="Update Variant Prices?"
        // we build our own buttons inside the message
        message={
          <div className="space-y-3 text-xs text-gray-700">
            <p>
              You changed the{" "}
              <span className="font-semibold text-[#5B33FF]">
                base price for variants
              </span>
              .
            </p>
            <p>
              How would you like to apply this change to your existing variants?
            </p>
            <ul className="ml-4 list-disc text-[11px] text-gray-600">
              <li>
                <span className="font-semibold">
                  Apply base price to all variants
                </span>{" "}
                – every variant&apos;s price will be set to the new base price.
              </li>
              <li>
                <span className="font-semibold">
                  Keep existing variant prices
                </span>{" "}
                – no changes will be made to individual variant prices.
              </li>
            </ul>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={async () => {
                  if (!pendingStatus) return;
                  setShowRegenerateModal(false);
                  const statusToUse = pendingStatus;
                  setPendingStatus(null);
                  await performSave(statusToUse, false); // keep current prices
                }}
                className="w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 sm:w-auto"
              >
                Keep current prices &amp; Save
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!pendingStatus) return;
                  setShowRegenerateModal(false);
                  const statusToUse = pendingStatus;
                  setPendingStatus(null);
                  await performSave(statusToUse, true); // apply base price
                }}
                className="w-full rounded-full bg-[#5B33FF] px-4 py-2 text-[11px] font-semibold text-white hover:bg-[#4a2bd6] sm:w-auto"
              >
                Apply base price to all variants
              </button>
            </div>
          </div>
        }
        onClose={() => {
          setShowRegenerateModal(false);
          setPendingStatus(null);
        }}
      />
    </div>
  );
}
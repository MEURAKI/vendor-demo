// app/pages/products/new/page.tsx
"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import Sidebar from "../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";

import { ProductPricingAndStock } from "../../../../components/product/ProductPricingAndStock";
import { ProductGeneralInfo } from "../../../../components/product/ProductGeneralInfo";
import {
  ProductDescriptionTabs,
  validateDescriptionSections,
} from "../../../../components/product/ProductDescriptionTabs";
import {
  ProductVariantChooser,
  OptionGroupKind as BaseOptionGroupKind,
} from "../../../../components/product/ProductVariantChooser";
import { ProductVariantSettings } from "../../../../components/product/ProductVariantSettings";
import {
  ProductImagesGallery,
  ProductImage,
} from "../../../../components/product/ProductImagesGallery";
import AppModal from "../../../../components/common/AppModal";

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
  // If you want to upload variant-level images later:
  imageFile?: File | null;
  options: Record<string, string>;
};

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed: boolean;
};

type WellnessDimension = {
  id: string;
  name: string;
  slug: string;
};

/* ---------- Small helpers ---------- */

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

function buildVariantSku(baseSku: string, index: number, customSuffix?: string) {
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
      imageFile: null,
      options,
    };
  });
}

/* ---------- Reusable chips input (categories / tags) ---------- */

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

/* ---------- Discount Calendar Modal ---------- */

type DiscountCalendarModalProps = {
  open: boolean;
  start: string; // ISO string or ""
  end: string; // ISO string or ""
  onChange: (startISO: string, endISO: string) => void;
  onClose: () => void;
};

function parseMaybeDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildISO(
  date: Date | null,
  hour: number,
  minute: number,
  ampm: "AM" | "PM"
) {
  if (!date) return "";
  const d = new Date(date);
  let h = hour % 12;
  if (ampm === "PM") h += 12;
  d.setHours(h, minute, 0, 0);
  return d.toISOString();
}

function DiscountCalendarModal({
  open,
  start,
  end,
  onChange,
  onClose,
}: DiscountCalendarModalProps) {
  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const d = parseMaybeDate(start) ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [rangeStart, setRangeStart] = useState<Date | null>(
    () => parseMaybeDate(start)
  );
  const [rangeEnd, setRangeEnd] = useState<Date | null>(() =>
    parseMaybeDate(end)
  );

  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(30);
  const [startAmPm, setStartAmPm] = useState<"AM" | "PM">("AM");

  const [endHour, setEndHour] = useState(9);
  const [endMinute, setEndMinute] = useState(30);
  const [endAmPm, setEndAmPm] = useState<"AM" | "PM">("AM");

  useEffect(() => {
    if (!open) return;
    const s = parseMaybeDate(start);
    const e = parseMaybeDate(end);

    setRangeStart(s);
    setRangeEnd(e);

    const base = s ?? new Date();
    setMonthCursor(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [open, start, end]);

  const daysMatrix = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = firstDayOfMonth.getDay(); // 0 = Sun

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];

    for (let i = 0; i < startWeekday; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(new Date(year, month, day));
    }
    return cells;
  }, [monthCursor]);

  function sameDay(a: Date | null, b: Date | null) {
    if (!a || !b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function inRange(d: Date) {
    if (!rangeStart || !rangeEnd) return false;
    const t = d.getTime();
    return (
      t >=
        new Date(
          rangeStart.getFullYear(),
          rangeStart.getMonth(),
          rangeStart.getDate()
        ).getTime() &&
      t <=
        new Date(
          rangeEnd.getFullYear(),
          rangeEnd.getMonth(),
          rangeEnd.getDate()
        ).getTime()
    );
  }

  function handleDayClick(day: Date) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day);
      setRangeEnd(null);
      return;
    }

    if (day < rangeStart) {
      setRangeStart(day);
      setRangeEnd(null);
    } else if (day.getTime() === rangeStart.getTime()) {
      setRangeEnd(day);
    } else {
      setRangeEnd(day);
    }
  }

  function parseIntClamped(value: string, min: number, max: number) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function handleSaveClick() {
    const startISO = buildISO(rangeStart, startHour, startMinute, startAmPm);
    const endISO = buildISO(rangeEnd ?? rangeStart, endHour, endMinute, endAmPm);
    onChange(startISO, endISO);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Discount Validity Period
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Choose a start and end date and the start and end time.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-600 hover:bg-gray-200"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Calendar */}
        <div className="mt-4 rounded-2xl bg-[#F9F8FF] p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-700">
            <button
              type="button"
              onClick={() =>
                setMonthCursor(
                  new Date(
                    monthCursor.getFullYear(),
                    monthCursor.getMonth() - 1,
                    1
                  )
                )
              }
              className="rounded-full px-2 py-1 hover:bg-white"
            >
              ‹
            </button>
            <div>
              {monthCursor.toLocaleString("default", {
                month: "short",
              })}{" "}
              {monthCursor.getFullYear()}
            </div>
            <button
              type="button"
              onClick={() =>
                setMonthCursor(
                  new Date(
                    monthCursor.getFullYear(),
                    monthCursor.getMonth() + 1,
                    1
                  )
                )
              }
              className="rounded-full px-2 py-1 hover:bg-white"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-gray-400">
            {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1 text-center text-xs">
            {daysMatrix.map((d, idx) => {
              if (!d) {
                return <div key={idx} />;
              }
              const isStart = sameDay(d, rangeStart);
              const isEnd = sameDay(d, rangeEnd);
              const selected = isStart || isEnd || inRange(d);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDayClick(d)}
                  className={clsx(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs",
                    selected
                      ? "bg-[#5B33FF] text-white"
                      : "text-gray-800 hover:bg-white"
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Times */}
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Start Time</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={12}
                value={startHour}
                onChange={(e) =>
                  setStartHour(parseIntClamped(e.target.value, 1, 12))
                }
                className="h-8 w-10 rounded-lg border border-gray-200 bg-[#F7F7FF] px-2 text-center text-xs focus:border-purple-500 focus:outline-none"
              />
              :
              <input
                type="number"
                min={0}
                max={59}
                value={startMinute}
                onChange={(e) =>
                  setStartMinute(parseIntClamped(e.target.value, 0, 59))
                }
                className="h-8 w-10 rounded-lg border border-gray-200 bg-[#F7F7FF] px-2 text-center text-xs focus:border-purple-500 focus:outline-none"
              />
              <div className="flex rounded-full bg-[#ECEBFF] p-0.5">
                {(["AM", "PM"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setStartAmPm(v)}
                    className={clsx(
                      "h-7 w-10 rounded-full text-[11px] font-medium",
                      startAmPm === v
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">End Time</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={12}
                value={endHour}
                onChange={(e) =>
                  setEndHour(parseIntClamped(e.target.value, 1, 12))
                }
                className="h-8 w-10 rounded-lg border border-gray-200 bg-[#F7F7FF] px-2 text-center text-xs focus:border-purple-500 focus:outline-none"
              />
              :
              <input
                type="number"
                min={0}
                max={59}
                value={endMinute}
                onChange={(e) =>
                  setEndMinute(parseIntClamped(e.target.value, 0, 59))
                }
                className="h-8 w-10 rounded-lg border border-gray-200 bg-[#F7F7FF] px-2 text-center text-xs focus:border-purple-500 focus:outline-none"
              />
              <div className="flex rounded-full bg-[#ECEBFF] p-0.5">
                {(["AM", "PM"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEndAmPm(v)}
                    className={clsx(
                      "h-7 w-10 rounded-full text-[11px] font-medium",
                      endAmPm === v
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSaveClick}
          className="mt-5 flex w-full items-center justify-center rounded-full bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-gray-900"
        >
          Save Discount Validity
        </button>
      </div>
    </div>
  );
}

/* ---------- Supabase upload helper ---------- */

async function uploadImageToSupabase(
  file: File,
  vendorId: string | null
): Promise<string> {
  const bucket = "product-images"; // make sure this bucket exists

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${uuid()}.${ext}`;
  const path = vendorId ? `${vendorId}/${fileName}` : fileName;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
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

/* ---------- Main Page ---------- */

export default function NewProductPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);

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
  const [discountModalOpen, setDiscountModalOpen] = useState(false);

  // taxonomy
  const [wellnessOptions, setWellnessOptions] = useState<WellnessDimension[]>(
    []
  );
  const [selectedWellnessIds, setSelectedWellnessIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [showCategoryErrorModal, setShowCategoryErrorModal] = useState(false);
  const categorySectionRef = useRef<HTMLDivElement | null>(null);

  // description accordions
  const [sections, setSections] = useState<DescriptionSection[]>([
    { id: uuid(), title: "Product Details", body: "" },
  ]);
  const descriptionSectionRef = useRef<HTMLDivElement | null>(null);

  // main product image
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);

  // gallery images (up to 5)
  const [images, setImages] = useState<ProductImage[]>([]);

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

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showDescriptionErrorModal, setShowDescriptionErrorModal] =
    useState(false);

  // sidebar config
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

  // load profile (vendor-specific) and wellness options
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      setVendorId(user.id);

      const { data: prof } = await supabase
        .from("profiles")
        .select("id,email,status,onboarding_completed,full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (isMounted && prof) {
        setProfile(prof as Profile);
      }

      const { data: wellnessData } = await supabase
        .from("wellness_dimensions")
        .select("id,name,slug");

      if (isMounted && wellnessData) {
        setWellnessOptions(wellnessData as WellnessDimension[]);
      }
    }

    void loadData();
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

  // main product image upload – store preview + file
  function handleProductImageChange(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setProductImageUrl(url);
    setProductImageFile(file);
  }

  async function handleSave(status: "draft" | "published") {
    setSubmitAttempted(true);

    // 1) Validate description sections – no empty titles allowed
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
    if (!vendorId) {
      alert("You must be logged in as a vendor to save a product.");
      return;
    }

    try {
      let imageUrlToSave = productImageUrl;

      if (productImageFile) {
        imageUrlToSave = await uploadImageToSupabase(
          productImageFile,
          vendorId
        );
      }

      // 2) upload gallery images (up to 5)
      const galleryImageUrls: string[] = [];
      for (const img of images) {
        if (img.file) {
          const url = await uploadImageToSupabase(img.file, vendorId);
          galleryImageUrls.push(url);
        } else if (img.url) {
          // e.g., if editing and already has URL
          galleryImageUrls.push(img.url);
        }
      }

      // 3) (optional) upload variant images if imageFile exists
      const apiVariants = [];
      for (const v of variants) {
        let variantImageUrl = v.imageUrl ?? null;
        if (v.imageFile) {
          variantImageUrl = await uploadImageToSupabase(v.imageFile, vendorId);
        }

        apiVariants.push({
          sku: v.sku,
          priceCents: Math.round((v.price ?? 0) * 100),
          inventoryQty: v.inventory ?? 0,
          imageUrl: variantImageUrl,
          optionsJson: v.options ?? {},
        });
      }

      // Build wellness with id + name + slug
      const selectedWellness = wellnessOptions
        .filter((w) => selectedWellnessIds.includes(w.id))
        .map((w) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
        }));

      // Categories and tags currently only have the name
      const categoriesPayload = categories.map((name) => ({ name }));
      const tagsPayload = tags.map((name) => ({ name }));

      const body = {
        status,
        vendorId,
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
        wellnessIds: selectedWellness,
        categoryIds: categoriesPayload,
        tags: tagsPayload,
        sections: sections.map((s, idx) => ({
          title: s.title,
          body: s.body,
          sortOrder: idx,
        })),
        productImageUrl: imageUrlToSave, // main image
        galleryImageUrls, // 1–5 gallery images
        optionGroups,
        variants: apiVariants,
      };

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
      alert("Error uploading image or saving product");
    }
  }

  const descriptionHasError =
  submitAttempted && !validateDescriptionSections(sections);

  /* ---------- UI ---------- */

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
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
                  onToggleVariant={(value) => {
                    setIsVariant(value);
                    if (!value) {
                      setOptionGroups([]);
                      setVariants([]);
                      setCustomSkuEnabled(false);
                      setCustomSkuSuffix("");
                      setBaseVariantPrice(undefined);
                    }
                  }}
                />

                <div ref={descriptionSectionRef}>
                    <ProductDescriptionTabs
                      sections={sections}
                      onChange={setSections}
                      maxSections={5}
                      submitAttempted={submitAttempted}
                    />

                    {/* Inline error under the accordion area */}
                    {descriptionHasError && (
                      <p className="mt-1 text-[11px] text-red-600">
                        Please fill in all section titles before saving the product.
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

                {/* Discount calendar trigger */}
                {discountType && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDiscountModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full bg-[#5B33FF] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#4b2bd6]"
                    >
                      <span>Set Discount Validity Period</span>
                    </button>
                  </div>
                )}

                <ProductVariantChooser
                  enabled={isVariant}
                  onToggleEnabled={(value) => {
                    setIsVariant(value);
                    if (!value) {
                      setOptionGroups([]);
                      setVariants([]);
                      setCustomSkuEnabled(false);
                      setCustomSkuSuffix("");
                      setBaseVariantPrice(undefined);
                    }
                  }}
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

                {isVariant && (
                  <ProductVariantSettings
                    optionGroups={optionGroups}
                    onGroupNameChange={(groupId, name) =>
                      setOptionGroups((prev) =>
                        prev.map((g) =>
                          g.id === groupId ? { ...g, name } : g
                        )
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
                )}

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

                  {/* Main image preview */}
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-200">
                    {productImageUrl ? (
                      <img
                        src={productImageUrl}
                        alt="Main product"
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
                      Upload a main product image.
                    </p>
                    <label className="cursor-pointer rounded-full bg-black px-4 py-2 text-[11px] font-semibold text-white">
                      Upload Main Image
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
                <section
                  ref={categorySectionRef}
                  className="rounded-2xl border bg-[#FBFBFE] p-4 sm:p-6"
                >
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-700 sm:mb-4 sm:text-sm">
                    Wellness Dimension, Category &amp; Tags
                  </h2>

                  <div className="space-y-4 text-xs sm:space-y-5">
                    {/* Wellness dimensions from DB */}
                    <div>
                      <label className="font-semibold text-gray-800">
                        Wellness Dimensions
                      </label>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Choose one or more wellness dimensions for this
                        product.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {wellnessOptions.map((w) => {
                          const active = selectedWellnessIds.includes(w.id);
                          const iconSrc = `/images/wellness/${w.slug}`;
                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => {
                                setSelectedWellnessIds((prev) =>
                                  prev.includes(w.id)
                                    ? prev.filter((id) => id !== w.id)
                                    : [...prev, w.id]
                                );
                              }}
                              className={clsx(
                                "flex items-center gap-2 rounded-2xl border px-2 py-2 text-left text-[11px] transition",
                                active
                                  ? "border-[#5B33FF] bg-[#EFEDFF] text-[#1B1529]"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-[#C4B5FF]"
                              )}
                            >
                              <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#F5F3FF]">
                                <Image
                                  src={iconSrc}
                                  alt={w.name}
                                  width={28}
                                  height={28}
                                  className="h-full w-full object-contain"
                                />
                              </div>
                              <span className="line-clamp-2">{w.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Categories as chips */}
                    <div>
                      <label className="font-semibold text-gray-800">
                        Categories
                      </label>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Type a category and press Enter to add.
                      </p>
                      <ChipsInput
                        items={categories}
                        onChange={setCategories}
                        placeholder="e.g. Apparel, Classes"
                      />
                      {showCategoryErrorModal && (
                        <AppModal
                          open={showCategoryErrorModal}
                          title="Category Required"
                          message={
                            <>
                              To publish this product, please add at least one
                              category in the{" "}
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
                          onClose={() => {
                            setShowCategoryErrorModal(false);
                          }}
                        />
                      )}
                    </div>

                    {/* Tags as chips */}
                    <div>
                      <label className="font-semibold text-gray-800">
                        Tags
                      </label>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Use tags to help customers find this product. Press
                        Enter to add each tag.
                      </p>
                      <ChipsInput
                        items={tags}
                        onChange={setTags}
                        placeholder="e.g. Limited Edition, Bestseller"
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
                                index === 0 && "cursor-default opacity-30"
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
                                  "cursor-default opacity-30"
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
                            className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-gray-300 bg-white text-lg text-gray-400"
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

      {/* Discount calendar modal */}
      <DiscountCalendarModal
        open={discountModalOpen}
        start={discountStart}
        end={discountEnd}
        onClose={() => setDiscountModalOpen(false)}
        onChange={(startISO, endISO) => {
          setDiscountStart(startISO);
          setDiscountEnd(endISO);
        }}
      />

      {/* Description sections error modal */}
      <AppModal
        open={showDescriptionErrorModal}
        title="Section Title Required"
        message={
          <>
            One or more{" "}
            <span className="font-medium text-[#5B33FF]">description tabs</span>{" "}
            have an empty title. Please fill in all section titles before saving
            the product.
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
    </div>
  );
}
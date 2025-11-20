// app/pages/bundles/new/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useRouter } from "next/navigation";

import { BundleProductPickerModal } from "../../../../../components/bundles/BundleProductPickerModal";
import type { BundleCandidateItem } from "../../../../../types/bundles.types";
import Sidebar from "../../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../../lib/supabase/client";
import WellnessCategoryTagsSection, {
  WellnessOption,
} from "../../../../../components/taxonomy/WellnessCategoryTagsSection";

type DiscountType = "fixed" | "percent" | null;

type BundleItem = BundleCandidateItem & {
  quantity: number;
};

type UserStatus = "active" | "inactive" | "pending";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

/* ---------- Helpers ---------- */

function ensureBundlePrefix(raw: string): string {
  const trimmed = (raw || "").trim().toUpperCase() || "BUNDLE";
  if (trimmed.startsWith("BUNDLE")) return trimmed;
  return `BUNDLE-${trimmed}`;
}

/**
 * Upload an image file to Supabase Storage and return the public URL.
 * Reuses the "product-images" bucket like product images.
 */
async function uploadImageToSupabase(
  file: File,
  vendorId: string | null
): Promise<string> {
  const bucket = "product-images"; // or "bundle-images" if you created a separate bucket

  const ext = file.name.split(".").pop() || "jpg";
  const fileName =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const path = vendorId ? `${vendorId}/${fileName}.${ext}` : `${fileName}.${ext}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error || !data) {
    console.error("Supabase upload error (bundle image)", error);
    throw error || new Error("Upload failed");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return publicUrl;
}

/* ---------- Page ---------- */

export default function NewBundlePage() {
  const router = useRouter();

  const [pickerOpen, setPickerOpen] = useState(true);

  // bundle basics
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // bundle settings
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [discountType, setDiscountType] = useState<DiscountType>(null);
  const [discountValue, setDiscountValue] = useState<number | undefined>();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // SKU
  const [skuBase, setSkuBase] = useState("BUNDLE");
  const [customSkuEnabled, setCustomSkuEnabled] = useState(false);
  const [customSkuSuffix, setCustomSkuSuffix] = useState("");

  // right-column meta
  const [bundleImageUrl, setBundleImageUrl] = useState<string | null>(null);
  const [bundleImageFile, setBundleImageFile] = useState<File | null>(null);

  const [wellnessOptions, setWellnessOptions] = useState<WellnessOption[]>([]);
  const [selectedWellnessIds, setSelectedWellnessIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // bundle items (with quantities)
  const [items, setItems] = useState<BundleItem[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);

  // sidebar / profile
  const [profile, setProfile] = useState<Profile | null>(null);

  const [saving, setSaving] = useState(false);

  /* ---------- Load profile + wellness options ---------- */

  useEffect(() => {
    let isMounted = true;

    async function loadProfileAndWellness() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("id,email,status,onboarding_completed,full_name")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (isMounted && prof) {
        setProfile(prof as Profile);
        setVendorId(prof.id);
      }

      const { data: wellnessData, error: wellnessError } = await supabase
        .from("wellness_dimensions")
        .select("id,name,slug");

      if (wellnessError) {
        console.error("Error loading wellness dimensions", wellnessError);
        return;
      }

      if (isMounted && wellnessData) {
        setWellnessOptions(wellnessData as WellnessOption[]);
      }
    }

    void loadProfileAndWellness();

    return () => {
      isMounted = false;
    };
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? "",
        role: "Vendor",
        status: profile?.onboarding_completed
          ? "Active"
          : "Incomplete Registration",
      }),
    [profile]
  );

  /* ---------- Auto-generate SKU from bundle name ---------- */

  useEffect(() => {
    if (!customSkuEnabled) {
      const slug =
        name
          .normalize("NFKD")
          .replace(/[^\w]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .toUpperCase() || "BUNDLE";

      setSkuBase(ensureBundlePrefix(slug));
    }
  }, [name, customSkuEnabled]);

  const displaySku = customSkuEnabled
    ? ensureBundlePrefix(
        skuBase + (customSkuSuffix.trim() ? `-${customSkuSuffix.trim()}` : "")
      )
    : ensureBundlePrefix(skuBase);

  const canSave =
    name.trim().length > 0 &&
    typeof price === "number" &&
    !Number.isNaN(price) &&
    items.length > 0;

  /* ---------- Save handler ---------- */

  async function handleSave(status: "draft" | "active") {
    if (!canSave || saving) return;
    setSaving(true);

    try {
      // 1) Upload image if needed
      let finalBundleImageUrl = bundleImageUrl;
      if (bundleImageFile && vendorId) {
        finalBundleImageUrl = await uploadImageToSupabase(
          bundleImageFile,
          vendorId
        );
      }

      // 2) Prepare items for API
      const itemPayload = items.map((it, idx) => ({
        // if your table expects variant_id only, use id as variantId
        variantId: it.variantId,
        productId: it.productId,
        itemName: it.name,
        itemPriceCents: it.priceCents,
        quantity: it.quantity,
        position: idx,
      }));

      // 3) Build body
      const body = {
        vendorId,
        name,
        sku: displaySku,
        base_sku: skuBase,
        description,
        status,
        priceCents: Math.round((price ?? 0) * 100),
        discount: discountType
          ? {
              type: discountType,
              value: discountValue ?? 0,
              start: startDate || null,
              end: endDate || null,
            }
          : null,
        startAt: startDate || null,
        endAt: endDate || null,
        imageUrl: finalBundleImageUrl,
        // 🔹 wellness / categories / tags same shape as products
        wellnessDimensions: selectedWellnessIds,
        categories,
        tags,
        items: itemPayload,
      };

      const res = await fetch("/api/bundles", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        console.error(json);
        alert(json.error || "Error creating bundle");
        setSaving(false);
        return;
      }

      // Go back to bundles list
      router.push("/pages/products/bundles");
    } catch (err) {
      console.error("Error saving bundle", err);
      alert("Error saving bundle");
      setSaving(false);
    }
  }

  /* ---------- UI ---------- */

  return (
    <div className="flex h-screen w-screen bg-[#050509] overflow-hidden">
      {/* Left sidebar */}
      <Sidebar config={sidebarConfig} />

      {/* Tablet container */}
      <div className="flex flex-1.items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Top bar inside tablet – matches other pages */}
          <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#1B1529]">
                New Bundle
              </h1>
              {items.length > 0 && (
                <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
                  {items.length} Products
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSave("draft")}
                disabled={!items.length || saving}
                className="inline-flex items-center rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={!canSave || saving}
                onClick={() => handleSave("active")}
                className={clsx(
                  "inline-flex items-center rounded-full px-6 py-1.5 text-xs font-semibold text-white",
                  canSave && !saving
                    ? "bg-black hover:bg-gray-900"
                    : "cursor-not-allowed bg-gray-300"
                )}
              >
                Add Bundle
              </button>
            </div>
          </div>

          {/* Scrollable body inside tablet */}
          <div className="flex-1 overflow-auto p-6">
            <div className="mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-sm">
              {/* Inner top bar */}
              <div className="flex items-center justify-between border-b px-8 py-5">
                <h2 className="text-lg font-semibold">Bundle Settings</h2>
              </div>

              <div className="grid gap-6 px-8 py-6 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
                {/* LEFT COLUMN */}
                <div className="space-y-6">
                  {/* General Information */}
                  <section className="rounded-2xl border bg-[#FBFBFE] p-6">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                      General Information
                    </h2>
                    <div className="space-y-4 text-xs">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700">
                          Bundle Name
                        </label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700">
                          Bundle Description
                        </label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={4}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Bundle Settings (price / discount / dates / SKU) */}
                  <section className="rounded-2xl border bg-[#FBFBFE] p-6">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Bundle Settings
                    </h2>
                    <div className="grid gap-4 text-xs md:grid-cols-2">
                      {/* Price */}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700">
                          Price
                        </label>
                        <div className="mt-2 flex items-center gap-1">
                          <span className="inline-flex h-9 items-center rounded-xl border.border-gray-200 bg-white px-3 text-[11px] text-gray-600">
                            SGD
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={price ?? ""}
                            onChange={(e) =>
                              setPrice(
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value)
                              )
                            }
                            className="h-9 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Discount – same pill style as products/services */}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700">
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
                                "px-3 py-1.5 rounded-l-2xl",
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
                                "px-3 py-1.5 rounded-r-2xl",
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
                            value={discountValue ?? ""}
                            onChange={(e) =>
                              setDiscountValue(
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value)
                              )
                            }
                            className="h-9 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {/* Start / End dates */}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700">
                          Bundle Start Date
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="mt-2 h-9 w-full rounded-xl border.border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700">
                          Bundle End Date
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="mt-2 h-9 w-full rounded-xl border.border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>

                      {/* SKU block – full width */}
                      <div className="col-span-2 mt-5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-gray-700">
                            SKU
                          </label>
                          <label className="flex items-center gap-1 text-[11px] text-gray-600">
                            <input
                              type="checkbox"
                              className="h-3 w-3"
                              checked={customSkuEnabled}
                              onChange={(e) =>
                                setCustomSkuEnabled(e.target.checked)
                              }
                            />
                            Add custom SKU
                          </label>
                        </div>

                        <div className="mt-2 flex items-center gap-3">
                          {/* Base SKU input */}
                          <input
                            value={skuBase}
                            onChange={(e) =>
                              setSkuBase(ensureBundlePrefix(e.target.value))
                            }
                            className="h-9 flex-1 rounded-2xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                          />

                          {/* Preview + optional suffix */}
                          <div className="flex flex-col items-end gap-1">
                            {customSkuEnabled && (
                              <input
                                placeholder="Custom suffix"
                                value={customSkuSuffix}
                                onChange={(e) =>
                                  setCustomSkuSuffix(
                                    e.target.value.toUpperCase()
                                  )
                                }
                                className="h-7 w-28 rounded-2xl border border-gray-200 bg-white px-2 text-[11px] focus:border-purple-500 focus:outline-none"
                              />
                            )}
                            <div className="inline-flex items-center rounded-2xl bg-[#F3F3F7] px-4 py-2 text-[11px] text-gray-500">
                              {displaySku}
                            </div>
                          </div>
                        </div>
                        <p className="mt-1 text-[10px] text-gray-400">
                          Bundle SKU always starts with <strong>BUNDLE</strong>.
                          You can tweak the base or add a suffix.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Bundle Items */}
                  <section className="rounded-2xl border bg-[#FBFBFE] p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                        Products in Bundle
                      </h2>
                      <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        className="rounded-full bg-black px-4 py-1.5 text-[11px] font-semibold text-white"
                      >
                        + Add Product
                      </button>
                    </div>

                    {items.length === 0 ? (
                      <p className="text-xs text-gray-500">
                        Use “Add Product” to choose items for this bundle.
                      </p>
                    ) : (
                      <div className="space-y-3 text-xs">
                        {items.map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-full bg-[#E5DEFF] text-[11px] font-semibold text-[#4C1D95]">
                                Product {idx + 1}
                              </span>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {item.name}
                                </p>
                                <p className="text-[11px] text-gray-500">
                                  Current Stock Level: {item.stock} · Item Price:{" "}
                                  {(item.priceCents / 100).toLocaleString(
                                    "en-SG",
                                    {
                                      style: "currency",
                                      currency: "SGD",
                                    }
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-gray-500">
                                QTY
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={item.stock}
                                value={item.quantity}
                                onChange={(e) => {
                                  const qty = Math.max(
                                    1,
                                    Math.min(
                                      item.stock,
                                      Number(e.target.value) || 1
                                    )
                                  );
                                  setItems((prev) =>
                                    prev.map((it) =>
                                      it.id === item.id
                                        ? { ...it, quantity: qty }
                                        : it
                                    )
                                  );
                                }}
                                className="h-8 w-16 rounded-xl border border-gray-300 px-2 text-xs focus:border-purple-500 focus:outline-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                  {/* Bundle Image */}
                  <section className="rounded-2xl border bg-[#FBFBFE] p-6">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Bundle Image
                    </h2>

                    <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-200">
                      {bundleImageUrl ? (
                        <img
                          src={bundleImageUrl}
                          alt="Bundle"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full.items-center justify-center text-xs text-gray-500">
                          Main bundle image
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs">
                      <p className="text-gray-500">
                        Upload a high-resolution bundle cover image.
                      </p>
                      <label className="cursor-pointer.rounded-full bg-black px-4 py-2 text-[11px] font-semibold text-white">
                        Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            if (!file) return;
                            const url = URL.createObjectURL(file);
                            setBundleImageUrl(url);
                            setBundleImageFile(file);
                          }}
                        />
                      </label>
                    </div>
                  </section>

                  {/* Wellness / Categories / Tags – same as product */}
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product picker modal (overlay) */}
      <BundleProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialSelected={items}
        onContinue={(picked) => {
          // merge with existing quantities or default to 1
          setItems(
            picked.map((p) => {
              const existing = items.find((it) => it.id === p.id);
              return {
                ...p,
                quantity: existing?.quantity ?? 1,
              };
            })
          );
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
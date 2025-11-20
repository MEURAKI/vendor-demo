// app/pages/bundles/[bundleId]/edit/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useParams, useRouter } from "next/navigation";

import { BundleProductPickerModal } from "../../../../../../components/bundles/BundleProductPickerModal";
import type { BundleCandidateItem } from "../../../../../../types/bundles.types";
import { supabase } from "../../../../../../lib/supabase/client";
import Sidebar from "../../../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../../../components/sidebar/sidebar.config";
import ClipLoader from "react-spinners/ClipLoader";
import WellnessCategoryTagsSection, {
  WellnessOption,
} from "../../../../../../components/taxonomy/WellnessCategoryTagsSection";
import { uploadProviderImage } from "../../../../../../lib/uploadProviderImage";

type DiscountType = "fixed" | "percent" | null;

type BundleItem = BundleCandidateItem & {
  quantity: number;
};

type LoadedBundle = {
  id: string;
  name: string;
  description: string | null;
  baseSku: string;
  sku?: string;
  status: "draft" | "active";
  priceCents: number;
  discount: {
    type: DiscountType;
    value: number;
    start: string | null;
    end: string | null;
  } | null;
  startAt?: string | null;
  endAt?: string | null;
  imageUrl: string | null;
  wellnessIds: (string | number)[];
  categoryIds: (string | number)[];
  tags: string[];
  items: (BundleCandidateItem & { quantity?: number })[];
};

type UserStatus = "active" | "inactive" | "pending";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

// ---------- SKU helpers ----------
function ensureBundlePrefix(raw: string) {
  const trimmed = (raw || "").trim().toUpperCase() || "BUNDLE";
  if (trimmed.startsWith("BUNDLE")) return trimmed;
  return `BUNDLE-${trimmed}`;
}

export default function EditBundlePage() {
  const params = useParams<{ bundleId: string }>();
  const router = useRouter();
  const bundleId = params.bundleId;

  const [loading, setLoading] = useState(true);

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

  // wellness / categories / tags
  const [wellnessOptions, setWellnessOptions] = useState<WellnessOption[]>([]);
  const [selectedWellnessIds, setSelectedWellnessIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const [status, setStatus] = useState<"draft" | "active">("draft");

  // bundle items (with quantities)
  const [items, setItems] = useState<BundleItem[]>([]);

  const [vendorId, setVendorId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);

  // ---------- Load vendor (from profile) ----------
  useEffect(() => {
    async function loadProfile() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id,email,full_name,status,onboarding_completed")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profileRow) {
        setVendorId(profileRow.id);
        setProfile({
          id: profileRow.id,
          email: profileRow.email,
          full_name: profileRow.full_name,
          status: profileRow.status,
          onboarding_completed: profileRow.onboarding_completed,
        });
      }
    }

    void loadProfile();
  }, []);

  // ---------- Load wellness dimension options ----------
  useEffect(() => {
    let mounted = true;

    async function loadWellness() {
      const { data, error } = await supabase
        .from("wellness_dimensions")
        .select("id,name,slug")
        .order("id", { ascending: true });

      if (!mounted) return;
      if (error) {
        console.error("Error loading wellness dimensions", error);
        return;
      }
      if (data) {
        setWellnessOptions(data as WellnessOption[]);
      }
    }

    void loadWellness();

    return () => {
      mounted = false;
    };
  }, []);

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

  // ---------- Load existing bundle ----------
  useEffect(() => {
    if (!bundleId) return;

    let isMounted = true;

    async function loadBundle() {
      try {
        setLoading(true);

        const res = await fetch(`/api/bundles/${bundleId}`);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("Error loading bundle", text);
          return;
        }

        const data: LoadedBundle = await res.json();
        if (!isMounted) return;

        setName(data.name);
        setDescription(data.description ?? "");
        setPrice((data.priceCents ?? 0) / 100);
        setStatus(data.status);

        if (data.discount) {
          setDiscountType(data.discount.type);
          setDiscountValue(data.discount.value ?? 0);
          setStartDate(
            data.discount.start
              ? data.discount.start.slice(0, 10)
              : data.startAt?.slice(0, 10) ?? ""
          );
          setEndDate(
            data.discount.end
              ? data.discount.end.slice(0, 10)
              : data.endAt?.slice(0, 10) ?? ""
          );
        } else {
          setDiscountType(null);
          setDiscountValue(undefined);
          setStartDate(data.startAt?.slice(0, 10) ?? "");
          setEndDate(data.endAt?.slice(0, 10) ?? "");
        }

        setSkuBase(data.baseSku || "BUNDLE");
        setBundleImageUrl(data.imageUrl ?? null);

        // wellness / categories / tags
        setSelectedWellnessIds((data.wellnessIds ?? []).map(String));
        setCategories((data.categoryIds ?? []).map(String));
        setTags(data.tags ?? []);

        // items
        setItems(
          (data.items ?? []).map((it) => ({
            ...it,
            // use variant id as key if present, otherwise fall back
            id: it.id || it.productId || it.variantId!,
            quantity: it.quantity ?? 1,
          }))
        );
      } catch (err) {
        console.error("Error loading bundle", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadBundle();

    return () => {
      isMounted = false;
    };
  }, [bundleId]);

  // Auto-generate base SKU from bundle name when custom SKU is OFF
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

  // ---------- Save (PUT) ----------
  async function handleSave(nextStatus: "draft" | "active") {
    if (!canSave) return;

    const body = {
      vendorId,
      name,
      sku: displaySku,
      baseSku: skuBase,
      description,
      status: nextStatus,
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
      imageUrl: bundleImageUrl,
      wellnessDimensions: selectedWellnessIds,
      categories,
      tags, // already string[]
      items: items.map((i) => ({
        productId: i.productId,          // ✅ always set
        variantId: i.variantId,          // ✅ variantId or null
        itemName: i.name,
        itemPriceCents: i.priceCents,
        quantity: i.quantity,
        position: 0, // or idx if you want ordering
      })),
    };

    const res = await fetch(`/api/bundles/${bundleId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Error updating bundle");
      console.error(json);
      return;
    }

    // Go back to list or just notify
    router.push("/pages/products/bundles");
  }

  // ---------- UI ----------
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1.items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-5">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#1B1529]">
                Edit Bundle
              </h1>
              <span
                className={clsx(
                  "inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold",
                  status === "active"
                    ? "bg-[#DCFCE7] text-[#166534]"
                    : "bg-gray-200 text-gray-700"
                )}
              >
                {status === "active" ? "Active" : "Draft"}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSave("draft")}
                disabled={!items.length || loading}
                className="h-9 rounded-full border border-gray-300 bg-white px-4 text-xs font-medium text-gray-800 disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                type="button"
                disabled={!canSave || loading}
                onClick={() => handleSave("active")}
                className={clsx(
                  "h-9 rounded-full px-6 text-xs font-semibold text-white",
                  canSave && !loading
                    ? "bg-black hover:bg-gray-900"
                    : "cursor-not-allowed bg-gray-300"
                )}
              >
                Update Bundle
              </button>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-xs text-gray-500">
              <ClipLoader size={55} color="#6B46C1" />
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
                {/* LEFT COLUMN */}
                <div className="space-y-6">
                  {/* General Information */}
                  <section className="rounded-2xl border border-[#ECECFB] bg-white p-6">
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

                  {/* Bundle Settings */}
                  <section className="rounded-2xl border border-[#ECECFB] bg-white p-6">
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
                          <span className="inline-flex h-9 items-center rounded-xl border border-gray-200 bg-white px-3 text-[11px] text-gray-600">
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

                      {/* Discount */}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700">
                          Discount
                        </label>
                        <div className="mt-2 flex gap-1">
                          <select
                            value={discountType ?? ""}
                            onChange={(e) =>
                              setDiscountType(
                                (e.target.value || null) as DiscountType
                              )
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
                          className="mt-2 h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
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
                          className="mt-2 h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>

                      {/* SKU Controls */}
                      <div className="mt-5 md:col-span-2">
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

                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            value={skuBase}
                            onChange={(e) =>
                              setSkuBase(ensureBundlePrefix(e.target.value))
                            }
                            className="h-9 flex-1 rounded-2xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                          />

                          <div className="flex flex-col items-stretch gap-1 sm:items-end">
                            {customSkuEnabled && (
                              <input
                                placeholder="Custom suffix"
                                value={customSkuSuffix}
                                onChange={(e) =>
                                  setCustomSkuSuffix(
                                    e.target.value.toUpperCase()
                                  )
                                }
                                className="h-7 rounded-2xl border border-gray-200 bg-white px-2 text-[11px] focus:border-purple-500 focus:outline-none sm:w-28"
                              />
                            )}
                            <div className="inline-flex items-center justify-center rounded-2xl bg-[#F3F3F7] px-4 py-2 text-[11px] text-gray-500">
                              {displaySku}
                            </div>
                          </div>
                        </div>
                        <p className="mt-1 text-[10px] text-gray-400">
                          Bundle SKU always starts with{" "}
                          <strong>BUNDLE</strong>. You can tweak the base or
                          add a suffix.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Bundle Items */}
                  <section className="rounded-2xl border border-[#ECECFB] bg-white p-6">
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
                            className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center"
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
                                  Current Stock Level: {item.stock} · Item Price: $
                                  {(item.priceCents / 100).toFixed(2)}
                                </p>
                              </div>
                            </div>
                            <div className="flex.items-center gap-2">
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
                                className="h-8 w-20 rounded-xl border border-gray-300 px-2 text-xs focus:border-purple-500 focus:outline-none"
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
                  {/* Product Images */}
                  <section className="rounded-2xl border border-[#ECECFB] bg-white p-6">
                    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Product Images
                    </h2>

                    <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-200">
                      {bundleImageUrl ? (
                        <img
                          src={bundleImageUrl}
                          alt="Bundle"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                          Placeholder image
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-col items-start justify-between gap-2 text-xs sm:flex-row sm:items-center">
                      <p className="text-gray-500">
                        Upload a main bundle image.
                      </p>
                      <label className="cursor-pointer rounded-full bg-black px-4 py-2 text-[11px] font-semibold text-white">
                        Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const url = await uploadProviderImage(file);
                            if (url) setBundleImageUrl(url);
                          }}
                        />
                      </label>
                    </div>
                  </section>

                  {/* Wellness / Categories / Tags */}
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
          )}
        </div>
      </div>

      {/* Product picker modal */}
      <BundleProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialSelected={items}
        onContinue={(picked) => {
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
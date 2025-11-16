"use client";

import React from "react";

export type DiscountType = "fixed" | "percent" | null;

interface ProductPricingProps {
  isVariant: boolean;

  baseSku: string;
  customSkuEnabled: boolean;
  customSkuSuffix: string;
  onBaseSkuChange: (v: string) => void;
  onToggleCustomSku: (v: boolean) => void;
  onCustomSkuSuffixChange: (v: string) => void;

  inventory: number | undefined;
  price: number | undefined;
  discountType: DiscountType;
  discountValue: number | undefined;
  discountStart: string;
  discountEnd: string;
  discountAllVariants: boolean;

  onInventoryChange: (v: number | undefined) => void;
  onPriceChange: (v: number | undefined) => void;
  onDiscountTypeChange: (v: DiscountType) => void;
  onDiscountValueChange: (v: number | undefined) => void;
  onDiscountStartChange: (v: string) => void;
  onDiscountEndChange: (v: string) => void;
  onDiscountAllVariantsChange: (v: boolean) => void;

  baseVariantPrice: number | undefined;
  onBaseVariantPriceChange: (v: number | undefined) => void;
}

export function ProductPricingAndStock(props: ProductPricingProps) {
  const {
    isVariant,

    baseSku,
    customSkuEnabled,
    customSkuSuffix,
    onBaseSkuChange,
    onToggleCustomSku,
    onCustomSkuSuffixChange,

    inventory,
    price,
    discountType,
    discountValue,
    discountStart,
    discountEnd,
    discountAllVariants,

    onInventoryChange,
    onPriceChange,
    onDiscountTypeChange,
    onDiscountValueChange,
    onDiscountStartChange,
    onDiscountEndChange,
    onDiscountAllVariantsChange,

    baseVariantPrice,
    onBaseVariantPriceChange,
  } = props;

  const toNumber = (raw: string) =>
    raw === "" ? undefined : Number(raw.replace(/,/g, ""));

  const showPrice = isVariant ? baseVariantPrice : price;
  const setPrice = isVariant ? onBaseVariantPriceChange : onPriceChange;

  const toggleDiscountType = (t: Exclude<DiscountType, null>) => {
    if (discountType === t) {
      onDiscountTypeChange(null);
      onDiscountValueChange(undefined);
    } else {
      onDiscountTypeChange(t);
    }
  };

  const discountDisabled = isVariant || !discountType;

  return (
    <section className="rounded-2xl border border-[#ECECFB] bg-[#FBFBFE] p-6 md:p-7">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-800">
        Product Pricing &amp; Stock
      </h2>

      {isVariant && (
        <p className="mb-4 rounded-xl bg-purple-50 px-3 py-2 text-xs text-purple-700">
          Pricing and inventory are managed per variant. Set a base price here
          and fine-tune them in “Variant Inventory Settings”.
        </p>
      )}

      {/* SKU row */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-800">SKU</span>
          <label className="flex items-center gap-2 text-[11px] text-gray-600">
            <span>Add custom SKU</span>
            <input
              type="checkbox"
              checked={customSkuEnabled}
              onChange={(e) => onToggleCustomSku(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
          </label>
        </div>

        <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          <input
            type="text"
            value={baseSku}
            onChange={(e) => onBaseSkuChange(e.target.value.toUpperCase())}
            placeholder="INNERDRIVETM–GRUNGE-TEE"
            className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm uppercase tracking-wide text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none"
          />
          <input
            type="text"
            disabled={!customSkuEnabled}
            value={customSkuSuffix}
            onChange={(e) =>
              onCustomSkuSuffixChange(e.target.value.toUpperCase())
            }
            placeholder="SV-0021-SS"
            className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm uppercase tracking-wide text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none disabled:bg-gray-100"
          />
        </div>
      </div>

      {/* Inventory / Price / Discount */}
      <div className="grid gap-4 md:grid-cols-3 md:items-start">
        {/* Inventory */}
        <div>
          <label className="text-xs font-semibold text-gray-800">
            Inventory Stock
          </label>
          <div className="mt-2 flex rounded-2xl border border-gray-200 bg-white text-sm">
            <span className="flex items-center border-r border-gray-200 px-3 text-[11px] text-gray-500">
              QTY
            </span>
            <input
              type="number"
              min={0}
              disabled={isVariant}
              value={inventory ?? ""}
              onChange={(e) => onInventoryChange(toNumber(e.target.value))}
              className="flex-1 rounded-r-2xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none disabled:bg-gray-100"
            />
          </div>
        </div>

        {/* Price */}
        <div>
          <label className="text-xs font-semibold text-gray-800">
            {isVariant ? "Base Variant Price" : "Price"}
          </label>
          <div className="mt-2 flex rounded-2xl border border-gray-200 bg-white text-sm">
            <span className="flex items-center border-r border-gray-200 px-3 text-[11px] text-gray-500">
              SGD
            </span>
            <input
              type="number"
              step="0.01"
              min={0}
              value={showPrice ?? ""}
              onChange={(e) => setPrice(toNumber(e.target.value))}
              className="flex-1 rounded-r-2xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none disabled:bg-gray-100"
            />
          </div>
        </div>

        {/* Discount */}
        <div>
          <label className="text-xs font-semibold text-gray-800">
            Discount
          </label>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* pill toggle */}
            <div className="inline-flex rounded-2xl bg-white p-1 shadow-sm">
              <button
                type="button"
                disabled={isVariant}
                onClick={() => toggleDiscountType("fixed")}
                className={
                  "h-7 w-16 rounded-xl text-xs font-semibold transition " +
                  (discountType === "fixed"
                    ? "bg-purple-600 text-white shadow"
                    : "text-gray-500 hover:text-gray-800 disabled:text-gray-300")
                }
              >
                SGD
              </button>
              <button
                type="button"
                disabled={isVariant}
                onClick={() => toggleDiscountType("percent")}
                className={
                  "h-7 w-10 rounded-xl text-xs font-semibold transition " +
                  (discountType === "percent"
                    ? "bg-purple-600 text-white shadow"
                    : "text-gray-500 hover:text-gray-800 disabled:text-gray-300")
                }
              >
                %
              </button>
            </div>

            <input
              type="number"
              step="0.01"
              min={0}
              disabled={discountDisabled}
              value={discountValue ?? ""}
              onChange={(e) => onDiscountValueChange(toNumber(e.target.value))}
              className="h-10 w-full rounded-2xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-purple-500 focus:outline-none disabled:bg-gray-100 sm:w-24"
            />
          </div>
        </div>
      </div>

      {/* Dates + apply to all */}
      <div className="mt-5 grid gap-4 md:grid-cols-3 md:items-start">
        <div>
          <label className="text-xs font-semibold text-gray-800">
            Discount Start Date
          </label>
          <div className="mt-2 flex items-center rounded-2xl border border-gray-200 bg-white px-3">
            <input
              type="date"
              disabled={discountDisabled}
              value={discountStart}
              onChange={(e) => onDiscountStartChange(e.target.value)}
              className="h-10 flex-1 border-none bg-transparent text-xs text-gray-700 focus:outline-none disabled:bg-gray-100"
            />
            <span className="ml-2 text-gray-400 text-base">📅</span>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-800">
            Discount End Date
          </label>
          <div className="mt-2 flex items-center rounded-2xl border border-gray-200 bg-white px-3">
            <input
              type="date"
              disabled={discountDisabled}
              value={discountEnd}
              onChange={(e) => onDiscountEndChange(e.target.value)}
              className="h-10 flex-1 border-none bg-transparent text-xs text-gray-700 focus:outline-none disabled:bg-gray-100"
            />
            <span className="ml-2 text-gray-400 text-base">📅</span>
          </div>
        </div>

        <div className="text-[11px] text-gray-700">
          <div className="font-semibold">Apply to all variants?</div>
          <label className="mt-3 inline-flex items-center gap-2">
            <input
              type="checkbox"
              disabled={!isVariant || !discountType}
              checked={discountAllVariants}
              onChange={(e) =>
                onDiscountAllVariantsChange(e.target.checked)
              }
              className="h-3.5 w-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:bg-gray-100"
            />
            <span className="text-[11px] text-gray-600">
              Yes, include discounted variants
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}
// src/components/product/ProductVariantChooser.tsx
"use client";

import React from "react";
import clsx from "clsx";
import Image from "next/image";

/** The 4 built-in variant types */
export type OptionGroupKind = "size" | "volume" | "weight" | "color";

interface ProductVariantChooserProps {
  /** Master on/off switch (top-right purple toggle) */
  enabled: boolean;
  onToggleEnabled: (value: boolean) => void;

  /** Which default kinds are currently selected */
  selectedKinds: OptionGroupKind[];
  onToggleKind: (kind: OptionGroupKind) => void;

  /** When user clicks “Add Your Own Variants” row */
  onAddCustomGroup: () => void;

  /** Whether the inner card is collapsed (triangle icon) */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export const ProductVariantChooser: React.FC<ProductVariantChooserProps> = ({
  enabled,
  onToggleEnabled,
  selectedKinds,
  onToggleKind,
  onAddCustomGroup,
  collapsed = false,
  onToggleCollapsed,
}) => {
  const defaults: { kind: OptionGroupKind; label: string }[] = [
    {
      kind: "size",
      label: "Size Variant (e.g S, M, L, XL, XXL)",
    },
    {
      kind: "volume",
      label: "Volume Variant (e.g 30ml, 70ml, 100ml)",
    },
    {
      kind: "weight",
      label: "Weight Variant (100g, 200g, 500g, 1kg)",
    },
    {
      kind: "color",
      label: "Color Variant ( e.g Black, purple, pink, yellow)",
    },
  ];

  const isSelected = (k: OptionGroupKind) => selectedKinds.includes(k);

  return (
    <section className="rounded-2xl border border-[#ECECFB] bg-[#F6F6FA] p-5 md:p-6">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Product Variants
        </h2>

        {/* Purple toggle */}
        <button
          type="button"
          onClick={() => onToggleEnabled(!enabled)}
          className={clsx(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            enabled ? "bg-[#A855F7]" : "bg-gray-300"
          )}
        >
          <span
            className={clsx(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-[22px]" : "translate-x-[2px]"
            )}
          />
        </button>
      </div>

      {/* Subtitle */}
      <p className="mb-2 text-xs font-semibold text-gray-700">
        Default Variants
      </p>

      {/* Inner white card */}
      <div className="rounded-2xl bg-white p-3 shadow-sm">
        {/* Choose Variant row */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-50"
        >
          <span>Choose Variant</span>
          <span
            className={clsx(
              "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] text-white transition-transform",
              collapsed ? "" : "rotate-180"
            )}
          >
            <Image
              src="/images/common/down-arrow.svg"
              alt="Toggle"
              width={16}
              height={16}
            />
          </span>
        </button>

        {/* List of rows */}
        {!collapsed && (
          <div className="mt-2 space-y-2">
            {defaults.map((item) => {
              const checked = isSelected(item.kind);
              return (
                <label
                  key={item.kind}
                  className="flex cursor-pointer items-center justify-between rounded-xl bg-white px-4 py-3 text-xs shadow-sm"
                >
                  <span className="text-gray-800">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!enabled}
                    onChange={() => onToggleKind(item.kind)}
                    className={clsx(
                      "h-4 w-4 rounded border-gray-300 text-[#A855F7] focus:ring-[#A855F7]",
                      !enabled && "bg-gray-100 cursor-not-allowed opacity-60"
                    )}
                  />
                </label>
              );
            })}

            {/* Add Your Own Variants */}
            <button
              type="button"
              disabled={!enabled}
              onClick={onAddCustomGroup}
              className={clsx(
                "flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-xs shadow-sm",
                !enabled && "cursor-not-allowed opacity-60"
              )}
            >
              <span className="text-gray-800">Add Your Own Variants</span>
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-[6px] bg-[#A855F7] text-[10px] font-semibold text-white">
                +
              </span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
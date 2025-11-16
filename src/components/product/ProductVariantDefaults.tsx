// src/components/product/ProductVariantDefaults.tsx
"use client";

import React from "react";
import clsx from "clsx";
import type {
  OptionGroupKind,
  OptionGroup,
  OptionValue,
  VariantRow,
} from "./variantTypes";

interface ProductVariantDefaultsProps {
  enabled: boolean;
  onToggleEnabled: (v: boolean) => void;

  selectedKinds: OptionGroupKind[];
  onToggleKind: (kind: OptionGroupKind) => void;

  onAddCustomGroup: () => void;

  collapsed?: boolean;
  onToggleCollapsed?: () => void;

  optionGroups: OptionGroup[];
  onAddOptionValue: (groupId: string) => void;
  onUpdateOptionValue: (
    groupId: string,
    valueId: string,
    patch: Partial<OptionValue>
  ) => void;
  onRemoveOptionValue: (groupId: string, valueId: string) => void;

  variants: VariantRow[];
  onAddVariantRow: () => void;
  onOpenInventoryModal: () => void;
}

export const ProductVariantDefaults: React.FC<
  ProductVariantDefaultsProps
> = ({
  enabled,
  onToggleEnabled,
  selectedKinds,
  onToggleKind,
  onAddCustomGroup,
  collapsed = false,
  onToggleCollapsed,
  optionGroups,
  onAddOptionValue,
  onUpdateOptionValue,
  onRemoveOptionValue,
  variants,
  onAddVariantRow,
  onOpenInventoryModal,
}) => {
  const defaults: { kind: OptionGroupKind; label: string }[] = [
    {
      kind: "size",
      label: "Size Variant (e.g S, M, L, XXL)",
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

  const isKindSelected = (k: OptionGroupKind) =>
    selectedKinds.includes(k);

  return (
    <section className="rounded-2xl border border-[#ECECFB] bg-[#F6F5FF] p-6">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Product Variants
        </h2>
        <button
          type="button"
          onClick={() => onToggleEnabled(!enabled)}
          className={clsx(
            "relative h-6 w-11 rounded-full transition-colors",
            enabled ? "bg-[#8B5CF6]" : "bg-gray-300"
          )}
        >
          <span
            className={clsx(
              "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-[22px]" : "translate-x-[2px]"
            )}
          />
        </button>
      </div>

      {/* Default variants */}
      <div className="text-xs">
        <p className="mb-2 text-[11px] font-semibold text-gray-700">
          Default Variants
        </p>

        <div className="rounded-2xl bg-white p-3 shadow-sm">
          {/* “Choose Variant” row */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
          >
            <span>Choose Variant</span>
            <span
              className={clsx(
                "inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-[11px] text-white transition-transform",
                collapsed ? "" : "rotate-180"
              )}
            >
              ▾
            </span>
          </button>

          {!collapsed && (
            <div className="mt-2 space-y-2">
              {defaults.map((item) => {
                const checked = isKindSelected(item.kind);
                return (
                  <label
                    key={item.kind}
                    className={clsx(
                      "flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-[11px]",
                      checked
                        ? "border-[#8B5CF6]/70 bg-[#F5F3FF]"
                        : "border-gray-200 bg-white"
                    )}
                  >
                    <span className="text-gray-700">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!enabled}
                      onChange={() => onToggleKind(item.kind)}
                      className={clsx(
                        "h-4 w-4 rounded border-gray-300 text-[#8B5CF6] focus:ring-[#8B5CF6]",
                        !enabled && "bg-gray-100"
                      )}
                    />
                  </label>
                );
              })}

              <button
                type="button"
                disabled={!enabled}
                onClick={onAddCustomGroup}
                className="mt-1 flex w-full items-center justify-center rounded-xl border border-dashed border-[#C4B5FD] px-3 py-2 text-[11px] font-medium text-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                + Add your own variants
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Variant settings + compact list */}
      {enabled && (
        <div className="mt-6 rounded-2xl bg-[#F6F5FF] p-0 text-xs">
          {/* Settings header */}
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              Variant Settings
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onOpenInventoryModal}
                disabled={variants.length === 0}
                className={clsx(
                  "rounded-full border border-gray-300 px-3 py-1 text-[11px]",
                  variants.length === 0 && "cursor-not-allowed opacity-60"
                )}
              >
                Edit inventory
              </button>
              <button
                type="button"
                onClick={onAddVariantRow}
                className="rounded-full bg-[#8B5CF6] px-3 py-1 text-[11px] font-medium text-white"
              >
                Create variations manually
              </button>
            </div>
          </div>

          {/* Group chips */}
          <div className="space-y-4">
            {optionGroups.map((g, idx) => (
              <div
                key={g.id}
                className="rounded-2xl border border-gray-200 bg-white p-4"
              >
                <label className="text-[11px] font-semibold text-gray-800">
                  {g.kind === "custom"
                    ? `Custom Variant ${idx + 1} (Displayed on store)`
                    : `${g.name} Variant Name (Displayed on store)`}
                </label>
                <input
                  value={g.name}
                  readOnly
                  className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-[#8B5CF6] focus:outline-none"
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
                  {g.values.map((v: any) => (
                    <div
                      key={v.id}
                      className={clsx(
                        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] border",
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
                          onUpdateOptionValue(g.id, v.id, {
                            label: e.target.value,
                          })
                        }
                        className="w-20 bg-transparent text-[11px] focus:outline-none"
                      />
                      {g.kind === "color" && (
                        <input
                          type="color"
                          value={v.colorHex || "#000000"}
                          onChange={(e) =>
                            onUpdateOptionValue(g.id, v.id, {
                              colorHex: e.target.value,
                            })
                          }
                          className="h-4 w-4 cursor-pointer border-none bg-transparent p-0"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveOptionValue(g.id, v.id)}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => onAddOptionValue(g.id)}
                    className="inline-flex h-8 items-center justify-center rounded-full border border-dashed border-gray-300 px-3 text-[11px] text-gray-600"
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* compact list */}
          {variants.length > 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-4 text-[11px]">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-gray-800">
                  {variants.length} variants
                </span>
                <button
                  type="button"
                  onClick={onOpenInventoryModal}
                  className="rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white"
                >
                  Variant Inventory Settings
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto text-gray-600">
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
      )}
    </section>
  );
};
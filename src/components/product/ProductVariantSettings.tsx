"use client";

import React from "react";
import clsx from "clsx";
import type { OptionGroupKind } from "./ProductVariantChooser"; // adjust path if needed

type OptionValue = {
  id: string;
  label: string;
  colorHex?: string;
};

export type OptionGroup = {
  id: string;
  name: string;
  kind: OptionGroupKind | "custom";
  values: OptionValue[];
};

interface ProductVariantSettingsProps {
  optionGroups: OptionGroup[];
  onGroupNameChange: (groupId: string, name: string) => void;

  onAddOptionValue: (groupId: string) => void;
  onUpdateOptionValue: (
    groupId: string,
    valueId: string,
    patch: Partial<OptionValue>
  ) => void;
  onRemoveOptionValue: (groupId: string, valueId: string) => void;

  /** add another “Custom Variant N” group */
  onAddCustomGroup: () => void;

  /** called when “Generate Variations” is clicked.
   *  Receives ONLY groups that actually have at least one non-empty option value.
   */
  onGenerateVariants: (usableGroups: OptionGroup[]) => void;
}

export const ProductVariantSettings: React.FC<ProductVariantSettingsProps> = ({
  optionGroups,
  onGroupNameChange,
  onAddOptionValue,
  onUpdateOptionValue,
  onRemoveOptionValue,
  onAddCustomGroup,
  onGenerateVariants,
}) => {
  // Just for nicer labels
  const getTitleLabel = (
    kind: OptionGroupKind | "custom",
    customIndex: number
  ) => {
    if (kind === "size") return "Size Variant Name (Displayed on store)";
    if (kind === "color") return "Color Variant Name (Displayed on store)";
    if (kind === "volume") return "Volume Variant Name (Displayed on store)";
    if (kind === "weight") return "Weight Variant Name (Displayed on store)";
    return `Custom Variant ${customIndex + 1} (Displayed on store)`;
  };

  const getPlaceholder = (kind: OptionGroupKind | "custom") => {
    if (kind === "size") return "Choose Tee Size";
    if (kind === "color") return "Choose Tee Color";
    if (kind === "volume") return "Choose Volume";
    if (kind === "weight") return "Choose Weight";
    return "Choose Variant Name";
  };

  // Separate custom groups so we can number them nicely
  const baseGroups = optionGroups.filter((g) => g.kind !== "custom");
  const customGroups = optionGroups.filter((g) => g.kind === "custom");

  // Helper to clean groups before generating variants:
  // - remove values with empty labels
  // - remove groups that have no remaining values
  const buildUsableGroups = (): OptionGroup[] => {
    return optionGroups
      .map((g) => ({
        ...g,
        values: g.values.filter(
          (v) => v.label && v.label.trim().length > 0
        ),
      }))
      .filter((g) => g.values.length > 0);
  };

  return (
    <section className="rounded-2xl border border-[#ECECFB] bg-[#F7F7FB] p-6 md:p-7">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Variant Settings
        </h2>
        {/* caret just for visual parity – hook up collapse if you like */}
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs text-gray-500 shadow">
          ˅
        </span>
      </div>

      <div className="space-y-6 text-xs">
        {/* Size / volume / weight / color groups in whatever order you created them */}
        {baseGroups.map((g) => (
          <div
            key={g.id}
            className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5"
          >
            <label className="text-xs font-semibold text-gray-800">
              {getTitleLabel(g.kind as OptionGroupKind, 0)}
            </label>
            <input
              value={g.name}
              onChange={(e) => onGroupNameChange(g.id, e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none"
              placeholder={getPlaceholder(g.kind)}
            />

            <p className="mt-3 text-[11px] font-semibold text-gray-700">
              No of Variants
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.values.map((v) => (
                <div
                  key={v.id}
                  className={clsx(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] border",
                    g.kind === "color"
                      ? "border-gray-200 bg-white"
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

        {/* Custom groups */}
        {customGroups.map((g, index) => (
          <div
            key={g.id}
            className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5"
          >
            <label className="text-xs font-semibold text-gray-800">
              {getTitleLabel("custom", index)}
            </label>
            <input
              value={g.name}
              onChange={(e) => onGroupNameChange(g.id, e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none"
              placeholder="Choose Variant Name"
            />

            <p className="mt-3 text-[11px] font-semibold text-gray-700">
              Variants
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.values.map((v) => (
                <div
                  key={v.id}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-[#F5F3FF] px-3 py-1 text-[11px]"
                >
                  <input
                    value={v.label}
                    onChange={(e) =>
                      onUpdateOptionValue(g.id, v.id, {
                        label: e.target.value,
                      })
                    }
                    className="w-24 bg-transparent text-[11px] focus:outline-none"
                  />
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

        {/* Footer buttons */}
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            onClick={onAddCustomGroup}
            className="h-10 flex-1 rounded-full bg-[#E9D5FF] px-4 text-xs font-semibold text-[#6D28D9]"
          >
            Add Another Custom Variant
          </button>
          <button
            type="button"
            onClick={() => {
              const usable = buildUsableGroups();
              onGenerateVariants(usable);
            }}
            className="h-10 flex-1 rounded-full bg-black px-4 text-xs font-semibold text-white"
          >
            Generate Variations
          </button>
        </div>
      </div>
    </section>
  );
};

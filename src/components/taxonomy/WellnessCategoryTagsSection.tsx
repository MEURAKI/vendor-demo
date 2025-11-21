"use client";

import Image from "next/image";
import clsx from "clsx";
import ChipsInput from "./../common/chips-input";

export type WellnessOption = {
  id: string;
  name: string;
  slug: string; // used for icon path
};

type Props = {
  title?: string;
  description?: string;

  /** Wellness options loaded from DB */
  wellnessOptions: WellnessOption[];

  /** Selected wellness IDs */
  selectedWellnessIds: string[];
  onChangeWellness: (ids: string[]) => void;

  /** Categories as an array of strings */
  categories: string[];
  onChangeCategories: (cats: string[]) => void;

  /** Tags as an array of strings */
  tags: string[];
  onChangeTags: (tags: string[]) => void;

  /** Optional: customise placeholder text */
  categoryPlaceholder?: string;
  tagPlaceholder?: string;
};

export default function WellnessCategoryTagsSection({
  title = "Wellness Dimension, Category & Tags",
  description,
  wellnessOptions,
  selectedWellnessIds,
  onChangeWellness,
  categories,
  onChangeCategories,
  tags,
  onChangeTags,
  categoryPlaceholder = "e.g. Apparel, Classes",
  tagPlaceholder = "e.g. Limited Edition, Bestseller",
}: Props) {
      const cleanWellnessDimensions = Array.from(
      new Set(
        (selectedWellnessIds ?? [])
          .map((v) => Number(String(v).trim()))
          .filter((n) => Number.isFinite(n))
      )
    );

  return (
    <section className="rounded-2xl border border-[#ECECFB] bg-[#FBFBFE] p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700 sm:text-sm">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[11px] text-gray-500">{description}</p>
        )}
      </div>

      <div className="space-y-5 text-xs">
        {/* Wellness dimensions from DB */}
        <div>
          <label className="font-semibold text-gray-800">
            Wellness Dimensions
          </label>
          <p className="mt-1 text-[11px] text-gray-500">
            Choose one or more wellness dimensions.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {wellnessOptions.map((w) => {
              const active = cleanWellnessDimensions.includes(Number(w.id));
              const iconSrc = `/images/wellness/${w.slug}`;

              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    onChangeWellness(
                      active
                        ? selectedWellnessIds.filter((id) => id !== w.id)
                        : [...selectedWellnessIds, w.id]
                    );
                  }}
                  className={clsx(
                    "flex items-center gap-2 rounded-2xl border px-2 py-2 text-left text-[11px] transition focus:outline-none focus:ring-2 focus:ring-[#5B33FF]/40",
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
          <label className="font-semibold text-gray-800">Categories</label>
          <p className="mt-1 text-[11px] text-gray-500">
            Type a category and press <strong>Enter</strong> to add.
          </p>
          {/* clean, pill-style input – no big ugly rectangle */}
          <ChipsInput
            items={categories}
            onChange={onChangeCategories}
            placeholder={categoryPlaceholder}
          />

        </div>

        {/* Tags as chips */}
        <div>
          <label className="font-semibold text-gray-800">Tags</label>
          <p className="mt-1 text-[11px] text-gray-500">
            Use tags to help customers find this. Press{" "}
            <strong>Enter</strong> to add each tag.
          </p>
          <ChipsInput
            items={tags}
            onChange={onChangeTags}
            placeholder={tagPlaceholder}
          />
        </div>
      </div>
    </section>
  );
}
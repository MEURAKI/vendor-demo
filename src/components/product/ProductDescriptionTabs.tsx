"use client";

import React, { useState } from "react";
import clsx from "clsx";
import Image from "next/image";

export type DescriptionSection = {
  id: string;
  title: string;
  body: string;
};

interface ProductDescriptionTabsProps {
  sections: DescriptionSection[];
  onChange: (sections: DescriptionSection[]) => void;
  maxSections?: number;
  /** Set to true when the user clicks "Save product" to show errors */
  submitAttempted?: boolean;
}

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

/**
 * Optional helper you can use in the parent before submit.
 */
export function validateDescriptionSections(sections: DescriptionSection[]) {
  return sections.every((s) => s.title.trim().length > 0);
}

export function ProductDescriptionTabs({
  sections,
  onChange,
  maxSections = 5,
  submitAttempted = false,
}: ProductDescriptionTabsProps) {
  const [open, setOpen] = useState(true);

  const canAdd = sections.length < maxSections;

  const handleAdd = () => {
    if (!canAdd) return;
    onChange([...sections, { id: newId(), title: "", body: "" }]);
  };

  const handleRemove = (id: string) => {
    onChange(sections.filter((s) => s.id !== id));
  };

  const updateSection = (
    id: string,
    patch: Partial<Pick<DescriptionSection, "title" | "body">>
  ) => {
    onChange(
      sections.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  return (
    <section className="rounded-3xl border border-[#ECECFB] bg-white p-6 shadow-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <h2 className="text-sm font-semibold text-gray-900">
          Description Tabs
        </h2>

        <span
          className={clsx(
            "inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F3FF] text-xs shadow-sm transition-transform",
            open ? "rotate-0" : "rotate-180"
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

      {/* Body */}
      {open && (
        <>
          {/* Add Section */}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Image
                src="/images/common/plus-button.svg"
                alt="Add"
                width={14}
                height={14}
              />
              Add Section
            </button>
          </div>

          {/* Sections */}
          <div className="mt-4 space-y-5">
            {sections.map((s, idx) => {
              const titleIsInvalid =
                submitAttempted && s.title.trim().length === 0;

              return (
                <div
                  key={s.id}
                  className="rounded-2xl border border-gray-200 bg-[#FBFBFE] p-5"
                >
                  {/* Header row */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-700">
                      Section {idx + 1}
                    </span>

                    {sections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemove(s.id)}
                        className="p-1 transition hover:opacity-70"
                      >
                        <Image
                          src="/images/common/close-button.svg"
                          alt="Remove"
                          width={18}
                          height={18}
                        />
                      </button>
                    )}
                  </div>

                  {/* Fields */}
                  <div className="space-y-4">
                    {/* Section Title */}
                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Section Title (Displayed on app)
                      </label>
                      <input
                        value={s.title}
                        onChange={(e) =>
                          updateSection(s.id, {
                            title: e.target.value,
                          })
                        }
                        className={clsx(
                          "mt-1 w-full rounded-2xl border bg-white px-4 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none",
                          titleIsInvalid
                            ? "border-red-500 focus:border-red-500"
                            : "border-gray-200 focus:border-purple-500"
                        )}
                        placeholder="Product Details"
                      />
                      {titleIsInvalid && (
                        <p className="mt-1 text-[11px] text-red-600">
                          Section title is required.
                        </p>
                      )}
                    </div>

                    {/* Section Description */}
                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Section Description
                      </label>
                      <textarea
                        value={s.body}
                        rows={4}
                        onChange={(e) =>
                          updateSection(s.id, {
                            body: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-2 text-xs text-gray-700 placeholder:text-gray-400 focus:border-purple-500 focus:outline-none"
                        placeholder="• Bullet points, fit guide, care instructions, etc."
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
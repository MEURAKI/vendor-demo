"use client";

import React, { useState } from "react";
import clsx from "clsx";

export type DescriptionSection = {
  id: string;
  title: string;
  body: string;
};

interface ProductDescriptionTabsProps {
  sections: DescriptionSection[];
  onChange: (sections: DescriptionSection[]) => void;
  maxSections?: number;
}



function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function ProductDescriptionTabs({
  sections,
  onChange,
  maxSections = 5,
}: ProductDescriptionTabsProps) {
  const [open, setOpen] = useState(true);

  const canAdd = sections.length < maxSections;

  const handleAdd = () => {
    if (!canAdd) return;
    onChange([
      ...sections,
      { id: newId(), title: "", body: "" },
    ]);
  };

  const handleRemove = (id: string) => {
    onChange(sections.filter((s) => s.id !== id));
  };

  const updateSection = (
    id: string,
    patch: Partial<Pick<DescriptionSection, "title" | "body">>
  ) => {
    onChange(
      sections.map((s) =>
        s.id === id ? { ...s, ...patch } : s
      )
    );
  };

  

  return (
    <section className="rounded-2xl border border-[#ECECFB] bg-[#FBFBFE] p-6 md:p-7">
      {/* Header / collapse toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
          Description Tabs
        </h2>
        <span
          className={clsx(
            "inline-flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm text-xs text-gray-500 transition-transform",
            open ? "rotate-0" : "rotate-180"
          )}
        >
          ˄
        </span>
      </button>

      {open && (
        <>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add section
            </button>
          </div>

          <div className="mt-4 space-y-5">
            {sections.map((s, idx) => (
              <div
                key={s.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-800">
                    Section {idx + 1}
                  </div>
                  {sections.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemove(s.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#F5F5FB] text-xs text-gray-400 hover:text-red-500"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-800">
                      Section Title (Displayed on app)
                    </label>
                    <input
                      value={s.title}
                      onChange={(e) =>
                        updateSection(s.id, { title: e.target.value })
                      }
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                      placeholder="Product Details"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-800">
                      Section Description
                    </label>
                    <textarea
                      value={s.body}
                      rows={4}
                      onChange={(e) =>
                        updateSection(s.id, { body: e.target.value })
                      }
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                      placeholder="• Bullet points, fit guide, care instructions, etc."
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
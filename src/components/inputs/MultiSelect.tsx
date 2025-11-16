"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

type Option = { id: string; name: string };

export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  const selectedItems = options.filter((o) => selected.includes(o.id));

  return (
    <div className="text-xs" ref={ref}>
      <label className="text-[11px] font-semibold text-gray-800">
        {label}
      </label>

      {/* Display box */}
      <div
        onClick={() => setOpen(!open)}
        className="mt-2 flex min-h-[42px] cursor-pointer flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-[#F6F6FC] px-3 py-2"
      >
        {selectedItems.length === 0 ? (
          <span className="text-gray-400">Select…</span>
        ) : (
          selectedItems.map((s) => (
            <span
              key={s.id}
              className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-medium shadow"
            >
              {s.name}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(s.id);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </span>
          ))
        )}

        <ChevronDown className="ml-auto h-4 w-4 text-gray-500" />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="mt-1 max-h-48 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {options.map((o) => {
            const active = selected.includes(o.id);
            return (
              <div
                key={o.id}
                onClick={() => toggle(o.id)}
                className={`cursor-pointer px-3 py-2 text-[11px] hover:bg-gray-100 ${
                  active ? "bg-purple-50 text-purple-700 font-semibold" : ""
                }`}
              >
                {o.name}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
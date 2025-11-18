"use client";

import { useState, KeyboardEvent, ChangeEvent } from "react";
import clsx from "clsx";

type ChipsInputProps = {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
};

export default function ChipsInput({
  items,
  onChange,
  placeholder,
}: ChipsInputProps) {
  const [value, setValue] = useState("");

  function addChip() {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!items.includes(trimmed)) {
      onChange([...items, trimmed]);
    }
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addChip();
    }
    if (e.key === "Backspace" && !value && items.length) {
      // remove last chip
      onChange(items.slice(0, -1));
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
  }

  function removeChip(chip: string) {
    onChange(items.filter((i) => i !== chip));
  }

  return (
    <div
      className={clsx(
        "mt-2 flex min-h-[40px] flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2",
        "focus-within:border-[#5B33FF] focus-within:ring-2 focus-within:ring-[#C4B5FF]"
      )}
    >
      {items.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => removeChip(chip)}
          className="group inline-flex items-center gap-1 rounded-full bg-[#F3E8FF] px-2.5 py-0.5 text-[11px] font-medium text-[#4C1D95]"
        >
          <span>{chip}</span>
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#E9D5FF] text-[10px] text-[#4C1D95] group-hover:bg-[#4C1D95] group-hover:text-white">
            ✕
          </span>
        </button>
      ))}

      <input
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={items.length === 0 ? placeholder : ""}
        className="flex-1 border-none bg-transparent text-xs text-gray-700 outline-none placeholder:text-[11px] placeholder:text-gray-400"
      />
    </div>
  );
}
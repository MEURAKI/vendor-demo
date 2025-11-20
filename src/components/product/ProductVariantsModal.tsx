"use client";

import clsx from "clsx";
import Image from "next/image";
import ClipLoader from "react-spinners/ClipLoader";

type VariantOptionGroup = {
  id: string;
  name: string;
  kind: "size" | "color" | "volume" | "weight" | "custom";
  values: VariantOptionValue[];
};

type VariantOptionValue = {
  id: string;
  label: string;
  colorHex?: string;
};

interface ProductVariantsModalProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  optionGroups: VariantOptionGroup[];
  variants: ListVariantRow[];
  loading?: boolean;
}

type ListVariantRow = {
  id: string;
  sku: string;
  price: number;
  inventory: number;
  imageUrl?: string | null;
  options_json: Record<string, string>;
};

export function ProductVariantsModal({
  open,
  onClose,
  productName,
  optionGroups,
  variants,
  loading = false,
}: ProductVariantsModalProps) {
  if (!open) return null;

  const activeGroups = optionGroups.filter((g) => g.values.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="max-h-[80vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Variant Inventory Settings</h2>
            <p className="text-xs text-gray-500">
              {productName} · Update stock, price and images for each variant.
            </p>
          </div>
          <button
            type="button"
            className="text-2xl leading-none text-gray-400 hover:text-black"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-auto px-6 py-4 text-xs">
          {loading ? (
            <p className="py-10 text-center text-xs text-gray-500">
                      <ClipLoader size={40} color="#6B46C1" cssOverride={{ animationDuration: "3s" }}/>


            </p>
          ) : variants.length === 0 ? (
            <p className="py-10 text-center text-xs text-gray-500">
              No variants found for this product.
            </p>
          ) : (
            <table className="w-full border-separate border-spacing-y-2">
              <thead className="text-[11px] text-gray-500">
                <tr>
                  <th className="px-2 text-left">Re order</th>
                  {activeGroups.map((g) => (
                    <th key={g.id} className="px-2 text-left">
                      {g.kind === "size"
                        ? "Choose Tee Size"
                        : g.kind === "color"
                        ? "Choose Tee Color"
                        : g.name}
                    </th>
                  ))}
                  <th className="px-2 text-left">Price</th>
                  <th className="px-2 text-left">Inventory Stock</th>
                  <th className="px-2 text-left">Upload Image</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, idx) => (
                  <tr key={v.id} className="align-middle">
                    {/* Reorder handle – drag logic can be the same as you added earlier */}
                    <td className="rounded-l-xl bg-[#F7F7FB] px-3 py-2 text-lg text-gray-400 cursor-move">
                      ≡
                    </td>

                    {activeGroups.map((g) => (
                      <td key={g.id} className="bg-[#F7F7FB] px-3 py-2">
                        <div className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[11px] text-gray-800">
                          {v.options_json[g.name] ?? "—"}
                        </div>
                      </td>
                    ))}

                    {/* Price */}
                    <td className="bg-[#F7F7FB] px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="rounded-xl border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-500">
                          SGD
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={v.price}
                          onChange={() => {}}
                          className="h-8 w-24 rounded-xl border border-gray-300 bg-white px-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </td>

                    {/* Inventory */}
                    <td className="bg-[#F7F7FB] px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="rounded-xl border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-500">
                          QTY
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={v.inventory}
                          onChange={() => {}}
                          className="h-8 w-20 rounded-xl border border-gray-300 bg-white px-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </td>

                    {/* Image */}
                    <td className="rounded-r-xl bg-[#F7F7FB] px-3 py-2">
                      {v.imageUrl ? (
                        <div className="relative h-10 w-10 overflow-hidden rounded-full border border-gray-200 bg-white">
                          <Image
                            src={v.imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-gray-300 bg-white text-lg text-gray-400">
                          +
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
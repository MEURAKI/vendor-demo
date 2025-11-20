"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import clsx from "clsx";
import type { BundleCandidateItem } from "../../types/bundles.types";
import ClipLoader from "react-spinners/ClipLoader";

const MAX_BUNDLE_ITEMS = 5;

interface BundleProductPickerModalProps {
  open: boolean;
  onClose: () => void;
  initialSelected?: BundleCandidateItem[];
  onContinue: (items: BundleCandidateItem[]) => void;
}

export function BundleProductPickerModal({
  open,
  onClose,
  initialSelected = [],
  onContinue,
}: BundleProductPickerModalProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BundleCandidateItem[]>([]);
  const [selected, setSelected] = useState<Record<string, BundleCandidateItem>>(
    () =>
      initialSelected.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, BundleCandidateItem>)
  );

  // sync when initialSelected changes
  useEffect(() => {
    setSelected(
      initialSelected.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<string, BundleCandidateItem>)
    );
  }, [initialSelected]);

  const selectedList = Object.values(selected);
  const selectedCount = selectedList.length;

  // Fetch products whenever query / open changes
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const url = `/api/bundles/search-products?q=${encodeURIComponent(
          query
        )}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!cancelled) {
          setResults(data.items ?? []);
        }
      } catch (e) {
        console.error("Error loading bundle candidates", e);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // tiny debounce feel
    const id = setTimeout(run, 200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, open]);

  if (!open) return null;

  function toggleItem(item: BundleCandidateItem) {
    // safety: do not allow zero stock (should already be filtered)
    if (!item.stock || item.stock <= 0) return;

    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        if (Object.keys(next).length >= MAX_BUNDLE_ITEMS) {
          // optionally show toast instead of alert
          alert(`You can only add up to ${MAX_BUNDLE_ITEMS} products.`);
          return prev;
        }
        next[item.id] = item;
      }
      return next;
    });
  }

  function removeChip(id: string) {
    setSelected((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleContinue() {
    if (!selectedCount) return;
    onContinue(selectedList);
  }

  const showEmptyState = !query && !results.length && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-8 py-6">
          <div>
            <h2 className="text-2xl font-semibold text-[#6A1BFF]">
              Create a new bundle
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Make sure all items are in stock — if any product runs out, the
              bundle will automatically be marked out of stock.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500 hover:bg-gray-200 hover:text-black"
          >
            ×
          </button>
        </div>

        {/* Search bar */}
        <div className="px-8 pt-4">
          <div className="flex items-center rounded-full bg-[#F7F7FB] px-4 py-2">
            <span className="mr-2 text-sm text-gray-400">🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for product names"
              className="flex-1 bg-transparent text-sm text-gray-800 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                className="text-lg text-gray-400 hover:text-black"
                onClick={() => setQuery("")}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-8 py-4 text-xs">
          {showEmptyState ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-10 text-center">
              {/* Placeholder illustration – swap with actual SVG */}
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-[#F7F7FB] text-5xl">
                🔎
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  Search for the items you want to bundle
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Make sure your items are in stock to create an active bundle.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-[#ECECFB] bg-white shadow-sm">
              <table className="w-full text-xs">
                <thead className="border-b bg-[#F7F7FB] text-[11px] font-semibold text-gray-500">
                  <tr>
                    <th className="w-10 px-4 py-3 text-left">
                      <input type="checkbox" disabled className="h-3 w-3" />
                    </th>
                    <th className="px-4 py-3 text-left">Product Name</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-gray-500"
                      >
                                <ClipLoader size={55} color="#6B46C1" />

                      </td>
                    </tr>
                  )}

                  {!loading && results.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-gray-500"
                      >
                        No products found with stock &gt; 0.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    results.map((item) => {
                      const isSelected = !!selected[item.id];
                      const outOfStock = !item.stock || item.stock <= 0;

                      return (
                        <tr
                          key={item.id}
                          className="border-b last:border-b-0 hover:bg-[#FBFBFF]"
                        >
                          <td className="px-4 py-3 align-middle">
                            <button
                              type="button"
                              onClick={() => toggleItem(item)}
                              disabled={outOfStock}
                              className={clsx(
                                "flex h-4 w-4 items-center justify-center rounded-sm border",
                                outOfStock
                                  ? "cursor-not-allowed border-gray-300 bg-gray-100"
                                  : isSelected
                                  ? "border-transparent bg-[#7C3AED]"
                                  : "border-gray-300 bg-white"
                              )}
                            >
                              {isSelected && (
                                <span className="text-[10px] text-white">
                                  ✓
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-gray-200">
                                {item.imageUrl && (
                                  <Image
                                    src={item.imageUrl}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                  />
                                )}
                              </div>
                              <div className="text-xs font-semibold text-gray-900">
                                {item.name}
                                {outOfStock && (
                                  <span className="ml-2 rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-semibold text-[#B91C1C]">
                                    Out of stock
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-[11px] text-gray-800">
                            ${(item.priceCents / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-[11px] text-gray-800">
                            {item.stock}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* Selected chips */}
          <div className="mt-6">
            <p className="text-sm font-semibold text-gray-900">
              You are adding {selectedCount}/{MAX_BUNDLE_ITEMS} products to your
              bundle
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedList.map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-2 rounded-full bg-[#F7F7FB] px-3 py-1 text-[11px] text-gray-800"
                >
                  {item.name}
                  <button
                    type="button"
                    onClick={() => removeChip(item.id)}
                    className="text-xs text-gray-500 hover:text-black"
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedCount === 0 && (
                <span className="text-[11px] text-gray-400">
                  No products selected yet.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t px-8 py-4">
          <button
            type="button"
            onClick={onClose}
            className="mr-3 rounded-full border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedCount}
            onClick={handleContinue}
            className={clsx(
              "rounded-full px-6 py-2 text-xs font-semibold text-white",
              selectedCount
                ? "bg-black hover:bg-gray-900"
                : "cursor-not-allowed bg-gray-300"
            )}
          >
            Continue to Bundle Settings →
          </button>
        </div>
      </div>
    </div>
  );
}
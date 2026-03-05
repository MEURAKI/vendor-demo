"use client";

import { TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import clsx from "clsx";
import type { DemandDimension } from "./types";

type DemandInsightsProps = {
  dimensions: DemandDimension[];
  popularCategories: { name: string; searches: number }[];
};

export default function DemandInsights({
  dimensions,
  popularCategories,
}: DemandInsightsProps) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm border border-gray-100 p-6">
      <h2 className="mb-1 text-sm font-semibold text-gray-900 uppercase tracking-wider">
        What Customers Are Seeking
      </h2>
      <p className="mb-5 text-xs text-gray-400">
        Trending wellness dimensions this month
      </p>

      {/* Dimension bars */}
      <div className="space-y-3 mb-6">
        {dimensions.map((dim) => (
          <div key={dim.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">
                {dim.label}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-900">
                  {dim.percentage}%
                </span>
                {dim.trendDirection === "up" ? (
                  <span className="flex items-center gap-0.5 text-xs text-green-600">
                    <TrendingUp className="h-3 w-3" />
                    {dim.trend}
                  </span>
                ) : dim.trendDirection === "down" ? (
                  <span className="flex items-center gap-0.5 text-xs text-red-600">
                    <TrendingDown className="h-3 w-3" />
                    {dim.trend}
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-xs text-gray-400">
                    <Minus className="h-3 w-3" />
                    {dim.trend}
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={clsx("h-full rounded-full bg-gradient-to-r", dim.color)}
                style={{ width: `${dim.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Popular categories */}
      <div className="border-t border-gray-100 pt-4">
        <p className="mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Popular Categories in Your Area
        </p>
        <div className="space-y-2">
          {popularCategories.map((cat, i) => (
            <div
              key={cat.name}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold text-gray-400 bg-gray-100">
                  {i + 1}
                </span>
                <span className="text-gray-700">{cat.name}</span>
              </div>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Search className="h-3 w-3" />
                {cat.searches.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

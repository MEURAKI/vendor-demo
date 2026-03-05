"use client";

import clsx from "clsx";
import type { FunnelStep } from "./types";

type ConversionFunnelProps = {
  steps: FunnelStep[];
};

export default function ConversionFunnel({ steps }: ConversionFunnelProps) {
  const maxValue = steps[0]?.value ?? 1;

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      <h2 className="mb-1 text-sm font-semibold text-gray-900 uppercase tracking-wider">
        Conversion Funnel
      </h2>
      <p className="mb-5 text-xs text-gray-400">
        From profile views to repeat customers
      </p>

      <div className="space-y-4">
        {steps.map((step, i) => {
          const widthPct = Math.max((step.value / maxValue) * 100, 8);
          const dropOff =
            i > 0
              ? Math.round(
                  ((steps[i - 1].value - step.value) / steps[i - 1].value) *
                    100
                )
              : 0;

          return (
            <div key={step.label}>
              {/* Label row */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {step.label}
                  </span>
                  {i > 0 && (
                    <span className="text-[10px] text-gray-400">
                      -{dropOff}% drop-off
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-900">
                    {step.value.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    mkt avg: {step.marketAvg.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="relative h-8 w-full rounded-lg bg-gray-50 overflow-hidden">
                <div
                  className={clsx(
                    "absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r",
                    step.color
                  )}
                  style={{ width: `${widthPct}%` }}
                />
                {/* Market avg marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gray-300"
                  style={{
                    left: `${Math.max(
                      (step.marketAvg / maxValue) * 100,
                      2
                    )}%`,
                  }}
                />
              </div>

              {/* Percentage of total */}
              <p className="mt-1 text-[10px] text-gray-400">
                {step.percentage}% of total views
              </p>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 flex items-center gap-4 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded bg-purple-500" />
          <span className="text-[10px] text-gray-400">Your performance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-0.5 bg-gray-300" />
          <span className="text-[10px] text-gray-400">Market average</span>
        </div>
      </div>
    </div>
  );
}

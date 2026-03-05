"use client";

import {
  RefreshCw,
  DollarSign,
  Clock,
  Users,
} from "lucide-react";
import clsx from "clsx";
import type { AudienceMetric } from "./types";

type AudienceInsightsProps = {
  metrics: AudienceMetric[];
};

const ICON_MAP: Record<string, React.ElementType> = {
  RefreshCw,
  DollarSign,
  Clock,
  Users,
};

export default function AudienceInsights({ metrics }: AudienceInsightsProps) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      <h2 className="mb-1 text-sm font-semibold text-gray-900 uppercase tracking-wider">
        Audience Insights
      </h2>
      <p className="mb-5 text-xs text-gray-400">
        Customer behavior and demographics
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {metrics.map((m) => {
          const Icon = ICON_MAP[m.icon] ?? Users;

          return (
            <div
              key={m.label}
              className="rounded-xl bg-gray-50 p-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-purple-50">
                  <Icon className="h-4 w-4 text-purple-500" />
                </div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {m.label}
                </p>
              </div>

              <p className="text-xl font-extrabold text-gray-900">{m.value}</p>
              <p className="mt-0.5 text-xs text-gray-500">{m.description}</p>

              {m.vsMarket && (
                <span
                  className={clsx(
                    "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    m.vsMarketPositive
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-600"
                  )}
                >
                  {m.vsMarket}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

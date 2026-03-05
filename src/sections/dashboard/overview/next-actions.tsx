"use client";

import Link from "next/link";
import {
  Camera,
  Tag,
  Layers,
  Building2,
  ArrowRight,
} from "lucide-react";
import clsx from "clsx";
import type { NextAction } from "./types";

const ICON_MAP: Record<string, React.ElementType> = {
  Camera,
  Tag,
  Layers,
  Building2,
};

type NextActionsPanelProps = {
  actions: NextAction[];
};

export default function NextActionsPanel({ actions }: NextActionsPanelProps) {
  return (
    <div className="mb-8 rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      <h2 className="mb-1 text-sm font-semibold text-gray-900 uppercase tracking-wider">
        Recommended Next Steps
      </h2>
      <p className="mb-5 text-xs text-gray-400">
        Based on your performance and market trends
      </p>

      <div className="space-y-3">
        {actions.map((action, i) => {
          const Icon = ICON_MAP[action.icon] ?? Tag;

          return (
            <div
              key={action.id}
              className={clsx(
                "flex items-start gap-4 rounded-xl px-4 py-4",
                action.comingSoon ? "bg-gray-50/60 opacity-60" : "bg-gray-50"
              )}
            >
              {/* Number */}
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                {i + 1}
              </div>

              {/* Icon */}
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-purple-50">
                <Icon className="h-4 w-4 text-purple-500" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {action.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {action.description}
                </p>
              </div>

              {/* CTA */}
              {action.comingSoon ? (
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-medium text-amber-800">
                  Coming Soon
                </span>
              ) : (
                <Link
                  href={action.actionHref}
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
                >
                  {action.actionLabel}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

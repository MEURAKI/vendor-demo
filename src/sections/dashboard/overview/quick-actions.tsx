"use client";

import Link from "next/link";
import {
  Package,
  ShoppingBasket,
  CalendarDays,
  Tag,
  Building2,
  MessageSquare,
  Lock,
} from "lucide-react";
import clsx from "clsx";
import type { QuickAction } from "./types";

const ICON_MAP: Record<string, React.ElementType> = {
  Package,
  ShoppingBasket,
  CalendarDays,
  Tag,
  Building2,
  MessageSquare,
};

type QuickActionsPanelProps = {
  actions: QuickAction[];
};

export default function QuickActionsPanel({ actions }: QuickActionsPanelProps) {
  return (
    <div className="mb-8">
      <h2 className="mb-4 text-sm font-semibold text-gray-900 uppercase tracking-wider">
        Quick Actions
      </h2>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {actions.map((action) => {
          const Icon = ICON_MAP[action.icon] ?? Package;

          if (action.comingSoon) {
            return (
              <div
                key={action.label}
                className="relative flex min-w-[130px] flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5 opacity-60"
              >
                <div className="absolute right-2 top-2">
                  <Lock className="h-3 w-3 text-amber-500" />
                </div>
                <div
                  className={clsx(
                    "grid h-11 w-11 place-items-center rounded-xl bg-gray-100 text-gray-400"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-gray-400 text-center">
                  {action.label}
                </span>
              </div>
            );
          }

          return (
            <Link
              key={action.label}
              href={action.href}
              className="group flex min-w-[130px] flex-col items-center gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-gray-200"
            >
              <div
                className={clsx(
                  "grid h-11 w-11 place-items-center rounded-xl",
                  action.color
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 text-center">
                {action.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

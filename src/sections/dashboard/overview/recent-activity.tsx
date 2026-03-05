"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import type { ActivityItem } from "./types";

type RecentActivityProps = {
  orders: ActivityItem[];
  bookings: ActivityItem[];
};

export default function RecentActivity({
  orders,
  bookings,
}: RecentActivityProps) {
  const [tab, setTab] = useState<"orders" | "bookings">("orders");
  const items = tab === "orders" ? orders : bookings;

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
          Recent Activity
        </h2>
        <Link
          href={tab === "orders" ? "/pages/vendor/orders" : "/pages/vendor/bookings"}
          className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(["orders", "bookings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize",
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Feed */}
      {items.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-gray-400">
          No recent activity
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={clsx(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    item.statusColor
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {item.subtitle}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                {item.amount && (
                  <p className="text-sm font-semibold text-gray-900">
                    {item.amount}
                  </p>
                )}
                <p className="text-[11px] text-gray-400">{item.timeAgo}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

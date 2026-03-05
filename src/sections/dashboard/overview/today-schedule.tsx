"use client";

import Link from "next/link";
import { ArrowRight, Clock, MapPin } from "lucide-react";
import clsx from "clsx";
import { format } from "date-fns";
import type { ScheduleItem } from "./types";

type TodayScheduleProps = {
  items: ScheduleItem[];
};

export default function TodaySchedule({ items }: TodayScheduleProps) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Today&apos;s Schedule
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
        </div>
        <Link
          href="/pages/vendor/bookings"
          className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700"
        >
          Full calendar <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Schedule */}
      {items.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-center">
          <p className="text-sm text-gray-400">
            No sessions scheduled for today.
            <br />
            <span className="text-xs">Enjoy your day!</span>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={item.id}
              className={clsx(
                "flex items-center gap-4 rounded-xl px-4 py-3",
                i === 0 ? "bg-purple-50/60 border border-purple-100" : "bg-gray-50"
              )}
            >
              {/* Time */}
              <div className="shrink-0 w-20">
                <div className="flex items-center gap-1 text-xs font-semibold text-gray-900">
                  <Clock className="h-3 w-3 text-gray-400" />
                  {item.time}
                </div>
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.customerName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {item.serviceName}
                </p>
              </div>

              {/* Location */}
              <div className="flex items-center gap-1 shrink-0">
                <MapPin className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-500">{item.location}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

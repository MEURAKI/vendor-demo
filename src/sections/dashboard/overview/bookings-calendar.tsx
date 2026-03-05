"use client";

import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday, isSameDay } from "date-fns";
import clsx from "clsx";
import type { CalendarBooking } from "./types";

type BookingsCalendarProps = {
  bookings: CalendarBooking[];
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function BookingsCalendar({ bookings }: BookingsCalendarProps) {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    let current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, []);

  const bookingMap = useMemo(() => {
    const map = new Map<string, number>();
    bookings.forEach((b) => map.set(b.date, b.count));
    return map;
  }, [bookings]);

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-purple-50">
          <CalendarDays className="h-5 w-5 text-purple-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Bookings Calendar
          </h2>
          <p className="text-xs text-gray-400">
            {format(today, "MMMM yyyy")}
          </p>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div
            key={i}
            className="text-center text-[10px] font-semibold text-gray-400 uppercase py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const count = bookingMap.get(dateStr) ?? 0;
          const inMonth = isSameMonth(day, today);
          const todayFlag = isToday(day);

          return (
            <div
              key={i}
              className={clsx(
                "relative flex flex-col items-center justify-center rounded-lg py-1.5 text-sm",
                !inMonth && "opacity-30",
                todayFlag && "bg-purple-50 font-bold text-purple-700",
                !todayFlag && inMonth && "text-gray-700"
              )}
            >
              {day.getDate()}
              {/* Booking dot */}
              {count > 0 && (
                <span
                  className={clsx(
                    "absolute -bottom-0.5 h-1.5 w-1.5 rounded-full",
                    count >= 3
                      ? "bg-purple-600"
                      : count >= 2
                      ? "bg-purple-400"
                      : "bg-purple-300"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-300" />
          <span className="text-[10px] text-gray-400">1 booking</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
          <span className="text-[10px] text-gray-400">2 bookings</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
          <span className="text-[10px] text-gray-400">3+ bookings</span>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-3 flex gap-4">
        <div className="flex-1 rounded-lg bg-purple-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-purple-700">
            {bookings.reduce((s, b) => s + b.count, 0)}
          </p>
          <p className="text-[10px] text-gray-500">Total this month</p>
        </div>
        <div className="flex-1 rounded-lg bg-gray-50 px-3 py-2 text-center">
          <p className="text-lg font-bold text-gray-900">
            {bookings.filter((b) => {
              const d = new Date(b.date);
              return d >= today;
            }).reduce((s, b) => s + b.count, 0)}
          </p>
          <p className="text-[10px] text-gray-500">Upcoming</p>
        </div>
      </div>
    </div>
  );
}

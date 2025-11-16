// components/discount/DiscountValidityModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

type DiscountValidityModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (value: { start: Date; end: Date }) => void;
  initialStart?: Date | null;
  initialEnd?: Date | null;
};

type AmPm = "AM" | "PM";

function startOfDay(d: Date) {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd;
}

function isSameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBeforeOrEqual(a: Date, b: Date) {
  return startOfDay(a).getTime() <= startOfDay(b).getTime();
}

function daysInMonth(year: number, monthIndex: number) {
  // monthIndex 0-11
  return new Date(year, monthIndex + 1, 0).getDate();
}

function formatMonthYear(d: Date) {
  return d.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function parseTimeString(time: string): { hour: number; minute: number } {
  const [hStr, mStr] = time.split(":");
  const hour = Math.max(0, Math.min(23, Number(hStr) || 0));
  const minute = Math.max(0, Math.min(59, Number(mStr) || 0));
  return { hour, minute };
}

function mergeDateTime(day: Date, time: string, ampm: AmPm) {
  const { hour, minute } = parseTimeString(time);
  let h24 = hour;
  if (ampm === "AM") {
    if (h24 === 12) h24 = 0;
  } else {
    if (h24 < 12) h24 += 12;
  }
  const d = new Date(day);
  d.setHours(h24, minute, 0, 0);
  return d;
}

export function DiscountValidityModal({
  open,
  onClose,
  onSave,
  initialStart = null,
  initialEnd = null,
}: DiscountValidityModalProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(
    startOfDay(initialStart ?? new Date())
  );
  const [rangeStart, setRangeStart] = useState<Date | null>(initialStart ?? null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(initialEnd ?? null);

  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [startAmPm, setStartAmPm] = useState<AmPm>("AM");
  const [endAmPm, setEndAmPm] = useState<AmPm>("PM");

  useEffect(() => {
    if (initialStart) {
      setRangeStart(initialStart);
      setCurrentMonth(startOfDay(initialStart));
    }
    if (initialEnd) {
      setRangeEnd(initialEnd);
    }
  }, [initialStart, initialEnd]);

  const weeks = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const leadingEmpty = firstOfMonth.getDay(); // 0-6, Sun first

    const days = daysInMonth(year, month);
    const cells: (Date | null)[] = [];

    for (let i = 0; i < leadingEmpty; i++) cells.push(null);
    for (let d = 1; d <= days; d++) {
      cells.push(new Date(year, month, d));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const result: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [currentMonth]);

  function handleDayClick(day: Date | null) {
    if (!day) return;

    if (!rangeStart || (rangeStart && rangeEnd)) {
      // start new range
      setRangeStart(day);
      setRangeEnd(null);
    } else {
      // set end; swap if earlier than start
      if (isBeforeOrEqual(day, rangeStart)) {
        setRangeEnd(rangeStart);
        setRangeStart(day);
      } else {
        setRangeEnd(day);
      }
    }
  }

  function isInRange(day: Date) {
    if (!rangeStart || !rangeEnd) return false;
    const t = startOfDay(day).getTime();
    const a = startOfDay(rangeStart).getTime();
    const b = startOfDay(rangeEnd).getTime();
    return t > a && t < b;
  }

  function handleSaveClick() {
    if (!rangeStart || !rangeEnd) return;

    const start = mergeDateTime(rangeStart, startTime, startAmPm);
    const end = mergeDateTime(rangeEnd, endTime, endAmPm);
    onSave({ start, end });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-2">
      <div className="w-full max-w-xs rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Discount Validity Period
            </h2>
            <p className="mt-1 text-[11px] text-gray-500">
              Choose a start and end date and the Start and End Time.
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500 hover:bg-gray-200"
          >
            ×
          </button>
        </div>

        {/* Calendar */}
        <div className="px-4 pt-2 pb-4">
          <div className="rounded-2xl bg-[#F7F7FB] p-3">
            {/* Month header */}
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-700">
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() - 1,
                      1
                    )
                  )
                }
                className="rounded-full px-2 py-1 text-gray-500 hover:bg-gray-200"
              >
                ‹
              </button>
              <span>{formatMonthYear(currentMonth)}</span>
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() + 1,
                      1
                    )
                  )
                }
                className="rounded-full px-2 py-1 text-gray-500 hover:bg-gray-200"
              >
                ›
              </button>
            </div>

            {/* Weekday labels */}
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-gray-400">
              {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1 text-xs">
              {weeks.map((week, wi) =>
                week.map((day, di) => {
                  if (!day) {
                    return (
                      <div
                        key={`${wi}-${di}`}
                        className="h-7 rounded-full"
                      />
                    );
                  }

                  const isStart = isSameDay(day, rangeStart);
                  const isEnd = isSameDay(day, rangeEnd);
                  const inRange = isInRange(day);

                  const isToday = isSameDay(day, new Date());

                  return (
                    <button
                      key={`${wi}-${di}`}
                      type="button"
                      onClick={() => handleDayClick(day)}
                      className={clsx(
                        "relative h-7 w-full rounded-full text-center",
                        "transition-colors",
                        (isStart || isEnd) &&
                          "bg-black text-white font-semibold",
                        inRange && !isStart && !isEnd && "bg-gray-900/10",
                        !isStart && !isEnd && !inRange && "text-gray-700",
                        !isStart &&
                          !isEnd &&
                          !inRange &&
                          "hover:bg-gray-200/80"
                      )}
                    >
                      {isToday && !isStart && !isEnd && (
                        <span className="absolute inset-x-1 -top-1 block rounded-full bg-purple-100 text-[8px] font-semibold text-purple-600">
                          ●
                        </span>
                      )}
                      <span className="relative z-10">
                        {day.getDate()}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Time pickers */}
          <div className="mt-4 space-y-3 text-xs">
            {/* Start Time */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-gray-700">
                Start Time
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-9 flex-1 rounded-2xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                  placeholder="09:30"
                />
                <div className="flex rounded-2xl border border-gray-200 bg-white p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setStartAmPm("AM")}
                    className={clsx(
                      "h-8 w-9 rounded-2xl text-center",
                      startAmPm === "AM"
                        ? "bg-black text-white"
                        : "text-gray-500"
                    )}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartAmPm("PM")}
                    className={clsx(
                      "h-8 w-9 rounded-2xl text-center",
                      startAmPm === "PM"
                        ? "bg-black text-white"
                        : "text-gray-500"
                    )}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            {/* End Time */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-gray-700">
                End Time
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-9 flex-1 rounded-2xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                  placeholder="18:00"
                />
                <div className="flex rounded-2xl border border-gray-200 bg-white p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setEndAmPm("AM")}
                    className={clsx(
                      "h-8 w-9 rounded-2xl text-center",
                      endAmPm === "AM"
                        ? "bg-black text-white"
                        : "text-gray-500"
                    )}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setEndAmPm("PM")}
                    className={clsx(
                      "h-8 w-9 rounded-2xl text-center",
                      endAmPm === "PM"
                        ? "bg-black text-white"
                        : "text-gray-500"
                    )}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Save button */}
          <button
            type="button"
            disabled={!rangeStart || !rangeEnd}
            onClick={handleSaveClick}
            className={clsx(
              "mt-4 mb-3 flex h-10 w-full items-center justify-center rounded-full text-sm font-semibold text-white",
              rangeStart && rangeEnd
                ? "bg-black hover:bg-gray-900"
                : "cursor-not-allowed bg-gray-300"
            )}
          >
            Save Discount Validity
          </button>
        </div>
      </div>
    </div>
  );
}
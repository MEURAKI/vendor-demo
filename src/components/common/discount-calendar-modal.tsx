"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

type DiscountCalendarModalProps = {
  open: boolean;
  start: string; // ISO string or ""
  end: string;   // ISO string or ""
  onChange: (startISO: string, endISO: string) => void;
  onClose: () => void;
};

function parseMaybeDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildISO(
  date: Date | null,
  hour: number,
  minute: number,
  ampm: "AM" | "PM"
): string {
  if (!date) return "";
  const d = new Date(date);
  let h = hour % 12;
  if (ampm === "PM") h += 12;
  d.setHours(h, minute, 0, 0);
  return d.toISOString();
}

export function DiscountCalendarModal({
  open,
  start,
  end,
  onChange,
  onClose,
}: DiscountCalendarModalProps) {
  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const d = parseMaybeDate(start) ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [rangeStart, setRangeStart] = useState<Date | null>(
    () => parseMaybeDate(start)
  );
  const [rangeEnd, setRangeEnd] = useState<Date | null>(
    () => parseMaybeDate(end)
  );

  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(30);
  const [startAmPm, setStartAmPm] = useState<"AM" | "PM">("AM");

  const [endHour, setEndHour] = useState(9);
  const [endMinute, setEndMinute] = useState(30);
  const [endAmPm, setEndAmPm] = useState<"AM" | "PM">("AM");

  // Sync when opening
  useEffect(() => {
    if (!open) return;
    const s = parseMaybeDate(start);
    const e = parseMaybeDate(end);

    setRangeStart(s);
    setRangeEnd(e);

    const base = s ?? new Date();
    setMonthCursor(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [open, start, end]);

  const daysMatrix = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = firstDayOfMonth.getDay(); // 0 = Sun

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];

    // leading blanks
    for (let i = 0; i < startWeekday; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(new Date(year, month, day));
    }
    return cells;
  }, [monthCursor]);

  function sameDay(a: Date | null, b: Date | null) {
    if (!a || !b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function inRange(d: Date) {
    if (!rangeStart || !rangeEnd) return false;
    const t = d.getTime();
    const startDay = new Date(
      rangeStart.getFullYear(),
      rangeStart.getMonth(),
      rangeStart.getDate()
    ).getTime();
    const endDay = new Date(
      rangeEnd.getFullYear(),
      rangeEnd.getMonth(),
      rangeEnd.getDate()
    ).getTime();
    return t >= startDay && t <= endDay;
  }

  function handleDayClick(day: Date) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day);
      setRangeEnd(null);
      return;
    }
    // we have start but no end yet
    if (day < rangeStart) {
      setRangeStart(day);
      setRangeEnd(null);
    } else if (day.getTime() === rangeStart.getTime()) {
      // single day selection
      setRangeEnd(day);
    } else {
      setRangeEnd(day);
    }
  }

  function parseIntClamped(value: string, min: number, max: number) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function handleSaveClick() {
    const startISO = buildISO(rangeStart, startHour, startMinute, startAmPm);
    const endISO = buildISO(rangeEnd ?? rangeStart, endHour, endMinute, endAmPm);
    onChange(startISO, endISO);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Discount Validity Period
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Choose a start and end date and the start and end time.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-600 hover:bg-gray-200"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Calendar */}
        <div className="mt-4 rounded-2xl bg-[#F9F8FF] p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-700">
            <button
              type="button"
              onClick={() =>
                setMonthCursor(
                  new Date(
                    monthCursor.getFullYear(),
                    monthCursor.getMonth() - 1,
                    1
                  )
                )
              }
              className="rounded-full px-2 py-1 hover:bg-white"
            >
              ‹
            </button>
            <div>
              {monthCursor.toLocaleString("default", {
                month: "short",
              })}{" "}
              {monthCursor.getFullYear()}
            </div>
            <button
              type="button"
              onClick={() =>
                setMonthCursor(
                  new Date(
                    monthCursor.getFullYear(),
                    monthCursor.getMonth() + 1,
                    1
                  )
                )
              }
              className="rounded-full px-2 py-1 hover:bg-white"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-gray-400">
            {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1 text-center text-xs">
            {daysMatrix.map((d, idx) => {
              if (!d) {
                return <div key={idx} />;
              }
              const isStart = sameDay(d, rangeStart);
              const isEnd = sameDay(d, rangeEnd);
              const selected = isStart || isEnd || inRange(d);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDayClick(d)}
                  className={clsx(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs",
                    selected
                      ? "bg-[#5B33FF] text-white"
                      : "text-gray-800 hover:bg-white"
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Times */}
        <div className="mt-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Start Time</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={12}
                value={startHour}
                onChange={(e) =>
                  setStartHour(parseIntClamped(e.target.value, 1, 12))
                }
                className="h-8 w-14 rounded-lg border border-gray-200 bg-[#F7F7FF] px-2 text-center text-xs focus:border-purple-500 focus:outline-none"
              />
              :
              <input
                type="number"
                min={0}
                max={59}
                value={startMinute}
                onChange={(e) =>
                  setStartMinute(parseIntClamped(e.target.value, 0, 59))
                }
                className="h-8 w-14 rounded-lg border border-gray-200 bg-[#F7F7FF] px-2 text-center text-xs focus:border-purple-500 focus:outline-none"
              />
              <div className="flex rounded-full bg-[#ECEBFF] p-0.5">
                {(["AM", "PM"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setStartAmPm(v)}
                    className={clsx(
                      "h-7 w-14 rounded-full text-[11px] font-medium",
                      startAmPm === v
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-600">End Time</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={12}
                value={endHour}
                onChange={(e) =>
                  setEndHour(parseIntClamped(e.target.value, 1, 12))
                }
                className="h-8 w-14 rounded-lg border border-gray-200 bg-[#F7F7FF] px-2 text-center text-xs focus:border-purple-500 focus:outline-none"
              />
              :
              <input
                type="number"
                min={0}
                max={59}
                value={endMinute}
                onChange={(e) =>
                  setEndMinute(parseIntClamped(e.target.value, 0, 59))
                }
                className="h-8 w-14 rounded-lg border border-gray-200 bg-[#F7F7FF] px-2 text-center text-xs focus:border-purple-500 focus:outline-none"
              />
              <div className="flex rounded-full bg-[#ECEBFF] p-0.5">
                {(["AM", "PM"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setEndAmPm(v)}
                    className={clsx(
                      "h-7 w-14 rounded-full text-[11px] font-medium",
                      endAmPm === v
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSaveClick}
          className="mt-5 flex w-full items-center justify-center rounded-full bg-black px-4 py-2.5 text-xs font-semibold text-white hover:bg-gray-900"
        >
          Save Discount Validity
        </button>
      </div>
    </div>
  );
}
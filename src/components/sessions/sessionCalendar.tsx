import { useMemo, useState } from "react";
import clsx from "clsx";

/* ==================== TYPES ==================== */

type DayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

type SessionTimeRange = {
  id: string;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
};

type SessionOperatingHour = {
  day: DayName;
  enabled: boolean;
  ranges: SessionTimeRange[];
};

type RecurringRule = {
  id: string;
  daysOfWeek: number[]; // 0=Sun, 1=Mon, etc.
  startTime: string;
  endTime: string;
  startDate: string;
  endDate?: string;
  providerId?: string;
};

type CalendarProps = {
  sessionOperatingHours: SessionOperatingHour[];
  selectedDate: string | null; // ISO date string "YYYY-MM-DD"
    onSelectDate: (date: string) => void;
  recurringRules?: RecurringRule[];
  minDate?: Date; // Don't allow dates before this
  maxDate?: Date; // Don't allow dates after this
};

/* ==================== HELPERS ==================== */

const DAY_MAP: Record<number, DayName> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

function getDayName(date: Date): DayName {
  return DAY_MAP[date.getDay()];
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return formatDateISO(d1) === formatDateISO(d2);
}

function isDateEnabled(
  date: Date,
  operatingHours: SessionOperatingHour[],
  minDate?: Date,
  maxDate?: Date
): boolean {
  // Check min/max bounds
  if (minDate && date < minDate) return false;
  if (maxDate && date > maxDate) return false;

  const dayName = getDayName(date);
  const dayConfig = operatingHours.find((h) => h.day === dayName);

  if (!dayConfig) return false;
  if (!dayConfig.enabled) return false;
  if (!dayConfig.ranges || dayConfig.ranges.length === 0) return false;

  return true;
}

function isDateBlockedByRecurringRule(
  date: Date,
  recurringRules: RecurringRule[]
): boolean {
  const dateStr = formatDateISO(date);
  const dayOfWeek = date.getDay();

  for (const rule of recurringRules) {
    // Check if this day of week is in the rule
    if (!rule.daysOfWeek.includes(dayOfWeek)) continue;

    // Check date range
    if (dateStr < rule.startDate) continue;
    if (rule.endDate && dateStr > rule.endDate) continue;

    // This rule blocks this date
    return true;
  }

  return false;
}

/* ==================== COMPONENT ==================== */

export default function SessionCalendar({
  sessionOperatingHours,
  selectedDate,
  onSelectDate,
  recurringRules = [],
  minDate,
  maxDate,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  // Get available time ranges for selected date
  const availableTimeRanges = useMemo(() => {
    if (!selectedDate) return [];

    const date = new Date(selectedDate + "T00:00:00");
    const dayName = getDayName(date);
    const dayConfig = sessionOperatingHours.find((h) => h.day === dayName);

    if (!dayConfig || !dayConfig.enabled) return [];

    return dayConfig.ranges || [];
  }, [selectedDate, sessionOperatingHours]);

  // Calendar grid data
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startPadding = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isEnabled: boolean;
      isBlocked: boolean;
      isSelected: boolean;
      isToday: boolean;
    }> = [];

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({
        date,
        isCurrentMonth: false,
        isEnabled: false,
        isBlocked: false,
        isSelected: false,
        isToday: false,
      });
    }

    // Current month days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const enabled = isDateEnabled(date, sessionOperatingHours, minDate, maxDate);
      const blocked = isDateBlockedByRecurringRule(date, recurringRules);
      const selected = selectedDate === formatDateISO(date);
      const isToday = isSameDay(date, today);

      days.push({
        date,
        isCurrentMonth: true,
        isEnabled: enabled && !blocked,
        isBlocked: blocked,
        isSelected: selected,
        isToday,
      });
    }

    // Next month padding to fill grid
    const totalCells = Math.ceil(days.length / 7) * 7;
    const endPadding = totalCells - days.length;
    for (let i = 1; i <= endPadding; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        isEnabled: false,
        isBlocked: false,
        isSelected: false,
        isToday: false,
      });
    }

    return days;
  }, [currentMonth, sessionOperatingHours, selectedDate, recurringRules, minDate, maxDate]);

  function handlePrevMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1));
  }

  function handleNextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1));
  }

  function handleDateClick(date: Date, enabled: boolean) {
    if (!enabled) return;
    onSelectDate(formatDateISO(date));
  }

  const monthYearLabel = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{monthYearLabel}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
            aria-label="Previous month"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
            aria-label="Next month"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-semibold text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const dayNum = day.date.getDate();

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleDateClick(day.date, day.isEnabled)}
              disabled={!day.isEnabled}
              className={clsx(
                "relative flex h-10 w-full items-center justify-center rounded-lg text-xs font-medium transition-all",
                // Current month styling
                day.isCurrentMonth
                  ? "text-gray-900"
                  : "text-gray-300 pointer-events-none",
                // Enabled/disabled
                day.isEnabled
                  ? "cursor-pointer hover:bg-purple-50"
                  : "cursor-not-allowed opacity-40",
                // Selected state
                day.isSelected && day.isEnabled
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "",
                // Today indicator
                day.isToday && !day.isSelected
                  ? "ring-2 ring-purple-400 ring-inset"
                  : "",
                // Blocked by recurring rule
                day.isBlocked && day.isCurrentMonth
                  ? "bg-gray-100 line-through"
                  : ""
              )}
            >
              {dayNum}

              {/* Small dot for enabled days that aren't selected */}
              {day.isEnabled && !day.isSelected && day.isCurrentMonth && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-purple-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-3 text-[10px] text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-purple-600" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full border-2 border-purple-400" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-purple-50 border border-purple-200" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-gray-100" />
          <span>Unavailable</span>
        </div>
      </div>

      {/* Show available time ranges for selected date */}
      {selectedDate && availableTimeRanges.length > 0 && (
        <div className="mt-4 rounded-xl bg-purple-50 p-3">
          <div className="mb-2 text-[11px] font-semibold text-purple-900">
            Available time ranges for {selectedDate}:
          </div>
          <div className="flex flex-wrap gap-2">
            {availableTimeRanges.map((range) => (
              <div
                key={range.id}
                className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-medium text-purple-700 border border-purple-200"
              >
                {range.start} – {range.end}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
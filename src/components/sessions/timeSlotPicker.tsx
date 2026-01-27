import { useMemo } from "react";
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

type TimeSlot = {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  available: boolean;
};

type TimeSlotPickerProps = {
  selectedDate: string; // "YYYY-MM-DD"
  sessionOperatingHours: SessionOperatingHour[];
  selectedStartTime: string; // "HH:mm"
  selectedEndTime: string; // "HH:mm"
  onTimeChange: (start: string, end: string) => void;
  slotDuration?: number; // minutes, default 30
  minDuration?: number; // minimum session duration in minutes
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

function getDayName(dateStr: string): DayName {
  const date = new Date(dateStr + "T00:00:00");
  return DAY_MAP[date.getDay()];
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isTimeInRange(
  time: string,
  rangeStart: string,
  rangeEnd: string
): boolean {
  const t = timeToMinutes(time);
  const start = timeToMinutes(rangeStart);
  const end = timeToMinutes(rangeEnd);
  return t >= start && t < end;
}

function generateTimeSlots(
  ranges: SessionTimeRange[],
  slotDuration: number
): string[] {
  const slots: string[] = [];

  for (const range of ranges) {
    const startMin = timeToMinutes(range.start);
    const endMin = timeToMinutes(range.end);

    for (let min = startMin; min < endMin; min += slotDuration) {
      slots.push(minutesToTime(min));
    }
  }

  return slots.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

/* ==================== COMPONENT ==================== */

export default function TimeSlotPicker({
  selectedDate,
  sessionOperatingHours,
  selectedStartTime,
  selectedEndTime,
  onTimeChange,
  slotDuration = 30,
  minDuration = 30,
}: TimeSlotPickerProps) {
  const dayName = getDayName(selectedDate);

  const operatingRanges = useMemo(() => {
    const dayConfig = sessionOperatingHours.find((h) => h.day === dayName);
    if (!dayConfig || !dayConfig.enabled) return [];
    return dayConfig.ranges || [];
  }, [sessionOperatingHours, dayName]);

  const timeSlots = useMemo(() => {
    return generateTimeSlots(operatingRanges, slotDuration);
  }, [operatingRanges, slotDuration]);

  const availableEndTimes = useMemo(() => {
    if (!selectedStartTime) return [];

    const startMin = timeToMinutes(selectedStartTime);
    const minEndMin = startMin + minDuration;

    const endTimes: string[] = [];

    for (const range of operatingRanges) {
      const rangeStart = timeToMinutes(range.start);
      const rangeEnd = timeToMinutes(range.end);

      // Find which range contains our start time
      if (startMin >= rangeStart && startMin < rangeEnd) {
        // Generate end times from min duration to range end
        for (
          let min = Math.max(minEndMin, startMin + slotDuration);
          min <= rangeEnd;
          min += slotDuration
        ) {
          endTimes.push(minutesToTime(min));
        }
        break;
      }
    }

    return endTimes;
  }, [selectedStartTime, operatingRanges, minDuration, slotDuration]);

  function handleStartTimeClick(time: string) {
    // Find suitable end time (start + minDuration)
    const startMin = timeToMinutes(time);
    const minEndMin = startMin + minDuration;

    // Find the operating range that contains this start time
    const containingRange = operatingRanges.find((range) => {
      const rangeStart = timeToMinutes(range.start);
      const rangeEnd = timeToMinutes(range.end);
      return startMin >= rangeStart && startMin < rangeEnd;
    });

    if (!containingRange) {
      onTimeChange(time, time);
      return;
    }

    const rangeEnd = timeToMinutes(containingRange.end);
    const defaultEndMin = Math.min(minEndMin, rangeEnd);
    const defaultEnd = minutesToTime(defaultEndMin);

    onTimeChange(time, defaultEnd);
  }

  function handleEndTimeClick(time: string) {
    onTimeChange(selectedStartTime, time);
  }

  if (operatingRanges.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">
          No operating hours set for {dayName}s
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Please configure session operating hours in Shop Settings first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Operating hours info */}
      <div className="rounded-xl bg-purple-50 p-3">
        <div className="text-[11px] font-semibold text-purple-900 mb-2">
          Operating hours for {dayName}:
        </div>
        <div className="flex flex-wrap gap-2">
          {operatingRanges.map((range) => (
            <div
              key={range.id}
              className="rounded-lg bg-white px-2.5 py-1 text-[10px] font-medium text-purple-700 border border-purple-200"
            >
              {range.start} – {range.end}
            </div>
          ))}
        </div>
      </div>

      {/* Start time picker */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-900">
          Select Start Time
        </label>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {timeSlots.map((time) => {
            const isSelected = time === selectedStartTime;
            const isInRange = operatingRanges.some((range) =>
              isTimeInRange(time, range.start, range.end)
            );

            return (
              <button
                key={time}
                type="button"
                onClick={() => handleStartTimeClick(time)}
                disabled={!isInRange}
                className={clsx(
                  "rounded-xl px-3 py-2 text-xs font-medium transition-all text-center",
                  isSelected
                    ? "bg-purple-600 text-white shadow-sm"
                    : isInRange
                    ? "bg-white border border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                {time}
              </button>
            );
          })}
        </div>
      </div>

      {/* End time picker */}
      {selectedStartTime && availableEndTimes.length > 0 && (
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            Select End Time
          </label>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {availableEndTimes.map((time) => {
              const isSelected = time === selectedEndTime;

              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => handleEndTimeClick(time)}
                  className={clsx(
                    "rounded-full px-3 py-2 text-xs font-medium transition-all whitespace-nowrap",
                    isSelected
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white border border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50"
                  )}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Duration info */}
      {selectedStartTime && selectedEndTime && (
        <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-200">
          <div className="text-xs text-emerald-900">
            <span className="font-semibold">Session duration:</span>{" "}
            {Math.abs(
              timeToMinutes(selectedEndTime) - timeToMinutes(selectedStartTime)
            )}{" "}
            minutes
          </div>
        </div>
      )}
    </div>
  );
}
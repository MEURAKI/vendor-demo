/* ==================== SESSION SCHEDULING TYPES ==================== */

export type DayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type SessionTimeRange = {
  id: string;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
};

export type SessionOperatingHour = {
  day: DayName;
  enabled: boolean;
  ranges: SessionTimeRange[];
};

export type RecurringRule = {
  id: string;
  daysOfWeek: number[]; // 0=Sun, 1=Mon, etc.
  startTime: string;
  endTime: string;
  startDate: string;
  endDate?: string;
  providerId?: string;
};

export type TimeSlot = {
  id: string;
  start: string; // ISO datetime string
  end: string; // ISO datetime string
  price?: number;
  discountType: "fixed" | "percent" | null;
  discountValue?: number;
  discountCap?: number;
};

/* ==================== HELPER FUNCTIONS ==================== */

export const DAYS: DayName[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function uuid() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export const DEFAULT_SESSION_HOURS: SessionOperatingHour[] = DAYS.map((d) => ({
  day: d,
  enabled: false,
  ranges: [{ id: uuid(), start: "08:00", end: "22:00" }],
}));

/**
 * Normalizes session hours from database format to the expected format.
 * Handles both old format (start/end at top level) and new format (ranges array).
 */
export function normalizeSessionHours(input: any): SessionOperatingHour[] {
  // if null/undefined/not array -> fallback
  if (!Array.isArray(input) || input.length === 0) return DEFAULT_SESSION_HOURS;

  return DAYS.map((day) => {
    const found = input.find((x: any) => x?.day === day) ?? {};

    // NEW format already (ranges array)
    if (Array.isArray(found.ranges)) {
      return {
        day,
        enabled: !!found.enabled,
        ranges:
          found.ranges.length > 0
            ? found.ranges.map((r: any) => ({
                id: r?.id ?? uuid(),
                start: r?.start ?? "08:00",
                end: r?.end ?? "22:00",
              }))
            : [{ id: uuid(), start: "08:00", end: "22:00" }],
      };
    }

    // OLD format (start/end at top-level)
    if (typeof found.start === "string" && typeof found.end === "string") {
      return {
        day,
        enabled: !!found.enabled,
        ranges: [{ id: uuid(), start: found.start, end: found.end }],
      };
    }

    // default for missing day
    return {
      day,
      enabled: false,
      ranges: [{ id: uuid(), start: "08:00", end: "22:00" }],
    };
  });
}

/**
 * Converts time string "HH:mm" to minutes since midnight
 */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Converts minutes since midnight to "HH:mm" format
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Validates time ranges for overlaps and invalid time spans
 */
export function validateRanges(
  ranges: { start: string; end: string }[]
): string[] {
  const errs: string[] = [];

  const normalized = (ranges ?? [])
    .filter((r) => !!r.start && !!r.end)
    .map((r) => ({
      start: r.start,
      end: r.end,
      s: toMinutes(r.start),
      e: toMinutes(r.end),
    }))
    .sort((a, b) => a.s - b.s);

  for (const r of normalized) {
    if (r.e <= r.s) errs.push("End time must be after start time.");
  }

  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i].s < normalized[i - 1].e) {
      errs.push("Time ranges cannot overlap.");
      break;
    }
  }

  return errs;
}

/**
 * Formats ISO date string to "YYYY-MM-DD"
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats datetime for datetime-local input
 */
export function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Combines date string and time string into ISO datetime
 */
export function combineDateTime(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00`;
}
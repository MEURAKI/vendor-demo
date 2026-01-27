import { useState, useEffect } from "react";
import SessionCalendar from "./sessionCalendar";
import TimeSlotPicker from "./timeSlotPicker";
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
  start: string;
  end: string;
};

type SessionOperatingHour = {
  day: DayName;
  enabled: boolean;
  ranges: SessionTimeRange[];
};

type RecurringRule = {
  id: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate?: string;
  providerId?: string;
};

type TimeSlot = {
  id: string;
  start: string; // ISO datetime string
  end: string; // ISO datetime string
  price?: number;
  discountType: "fixed" | "percent" | null;
  discountValue?: number;
  discountCap?: number;
};

type SessionSchedulerProps = {
  sessionOperatingHours: SessionOperatingHour[];
  recurringRules: RecurringRule[];
  timeSlots: TimeSlot[];
  onAddTimeSlot: (slot: TimeSlot) => void;
  onUpdateTimeSlot: (id: string, slot: Partial<TimeSlot>) => void;
  onRemoveTimeSlot: (id: string) => void;
};

/* ==================== HELPERS ==================== */

function uuid() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function combineDateTime(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr}:00`;
}

/* ==================== COMPONENT ==================== */

export default function SessionScheduler({
  sessionOperatingHours,
  recurringRules,
  timeSlots,
  onAddTimeSlot,
  onUpdateTimeSlot,
  onRemoveTimeSlot,
}: SessionSchedulerProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [sessionPrice, setSessionPrice] = useState<string>("");
  const [discountType, setDiscountType] = useState<"fixed" | "percent" | null>(
    null
  );
  const [discountValue, setDiscountValue] = useState<string>("");

  // Reset time selection when date changes
  useEffect(() => {
    setStartTime("");
    setEndTime("");
  }, [selectedDate]);

  function handleAddSession() {
    if (!selectedDate || !startTime || !endTime) {
      alert("Please select a date and time range");
      return;
    }

    const newSlot: TimeSlot = {
      id: uuid(),
      start: combineDateTime(selectedDate, startTime),
      end: combineDateTime(selectedDate, endTime),
      price: sessionPrice ? Number(sessionPrice) : undefined,
      discountType,
      discountValue: discountValue ? Number(discountValue) : undefined,
    };

    onAddTimeSlot(newSlot);

    // Reset form
    setSessionPrice("");
    setDiscountType(null);
    setDiscountValue("");
    // Keep date and time for adding multiple sessions
  }

  function formatDateTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  const canAddSession = selectedDate && startTime && endTime;

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="rounded-2xl bg-purple-50 p-4 border border-purple-200">
        <h4 className="text-sm font-semibold text-purple-900 mb-2">
          📅 How to Schedule Sessions
        </h4>
        <ol className="space-y-1 text-xs text-purple-800">
          <li>1. Select a date from the calendar (only days with operating hours are available)</li>
          <li>2. Choose start and end times from available slots</li>
          <li>3. Set pricing and discounts (optional)</li>
          <li>4. Click "Add Session" to save</li>
        </ol>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Calendar */}
        <div>
          <SessionCalendar
            sessionOperatingHours={sessionOperatingHours}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            recurringRules={recurringRules}
            minDate={new Date()} // Can't schedule sessions in the past
          />
        </div>

        {/* Right: Time picker and form */}
        <div className="space-y-4">
          {selectedDate ? (
            <>
              <TimeSlotPicker
                selectedDate={selectedDate}
                sessionOperatingHours={sessionOperatingHours}
                selectedStartTime={startTime}
                selectedEndTime={endTime}
                onTimeChange={(start, end) => {
                  setStartTime(start);
                  setEndTime(end);
                }}
                slotDuration={30}
                minDuration={30}
              />

              {/* Pricing section */}
              {canAddSession && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <h4 className="mb-3 text-sm font-semibold text-gray-900">
                    Session Pricing (Optional)
                  </h4>

                  <div className="space-y-3">
                    {/* Price */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700">
                        Session Price
                      </label>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="inline-flex h-9 items-center rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-500 shrink-0">
                          SGD
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={sessionPrice}
                          onChange={(e) => setSessionPrice(e.target.value)}
                          placeholder="0.00"
                          className="h-9 flex-1 rounded-xl border border-gray-200 bg-[#FBFBFE] px-3 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Discount */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700">
                        Session Discount
                      </label>
                      <div className="mt-1 flex items-center gap-1">
                        <div className="flex rounded-xl border border-gray-200 bg-white text-xs shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setDiscountType(
                                discountType === "fixed" ? null : "fixed"
                              )
                            }
                            className={clsx(
                              "px-3 py-1.5 rounded-l-xl transition-colors",
                              discountType === "fixed"
                                ? "bg-purple-600 text-white"
                                : "text-gray-600 hover:bg-gray-50"
                            )}
                          >
                            SGD
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDiscountType(
                                discountType === "percent" ? null : "percent"
                              )
                            }
                            className={clsx(
                              "px-3 py-1.5 rounded-r-xl transition-colors",
                              discountType === "percent"
                                ? "bg-purple-600 text-white"
                                : "text-gray-600 hover:bg-gray-50"
                            )}
                          >
                            %
                          </button>
                        </div>

                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          disabled={!discountType}
                          placeholder="0.00"
                          className="h-9 flex-1 rounded-xl border border-gray-200 bg-[#FBFBFE] px-3 text-xs focus:border-purple-500 focus:outline-none disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Add button */}
                  <button
                    type="button"
                    onClick={handleAddSession}
                    className="mt-4 w-full rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 transition-colors"
                  >
                    + Add Session
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="mt-3 text-sm font-medium text-gray-700">
                Select a date to continue
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Choose a date from the calendar to schedule sessions
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Scheduled sessions list */}
      {timeSlots.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">
              Scheduled Sessions ({timeSlots.length})
            </h4>
          </div>

          <div className="space-y-2">
            {timeSlots.map((slot) => {
              const price = slot.price ?? 0;
              const hasDiscount =
                slot.discountType && slot.discountValue && slot.discountValue > 0;
              const finalPrice = hasDiscount
                ? slot.discountType === "percent"
                  ? price * (1 - slot.discountValue! / 100)
                  : price - slot.discountValue!
                : price;

              return (
                <div
                  key={slot.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3 hover:border-purple-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 text-purple-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-xs font-medium text-gray-900">
                        {formatDateTime(slot.start)}
                      </span>
                      <span className="text-xs text-gray-400">→</span>
                      <span className="text-xs text-gray-600">
                        {new Date(slot.end).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </div>

                    {slot.price && (
                      <div className="mt-1 flex items-center gap-2">
                        {hasDiscount ? (
                          <>
                            <span className="text-xs text-gray-400 line-through">
                              SGD {price.toFixed(2)}
                            </span>
                            <span className="text-xs font-semibold text-emerald-600">
                              SGD {finalPrice.toFixed(2)}
                            </span>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                              {slot.discountType === "percent"
                                ? `${slot.discountValue}% off`
                                : `SGD ${slot.discountValue} off`}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-gray-700">
                            SGD {price.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveTimeSlot(slot.id)}
                    className="ml-3 flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
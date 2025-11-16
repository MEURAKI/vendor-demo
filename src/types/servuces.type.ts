export type DiscountType = "fixed" | "percent" | null;
export type LocationType = "online" | "in_person";

export type DescriptionTab = {
  id: string;
  title: string;
  body: string;
};

export type TimeSlot = {
  id: string;
  start: string; // ISO string
  end: string;   // ISO string
};

export type SessionOption = {
  id: string;
  label: string;
  sessionsCount: number;
  price: number;
};

export type LocationSettingsState = {
  id: string;
  locationType: LocationType;
  sku: string;
  maxParticipants?: number;
  price?: number;
  discountType: DiscountType;
  discountValue?: number;
  discountCap?: number;
  hasFixedSchedule: boolean;
  expiryType: "anytime" | "duration";
  expiryDurationUnit?: "days" | "weeks" | "months";
  expiryDurationValue?: number;
  timeSlots: TimeSlot[];
  sessionOptions: SessionOption[];
};

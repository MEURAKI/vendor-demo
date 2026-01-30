
export type ExperienceStatus =
  | "draft"
  | "published"
  | "cancelled";

export type ExperienceDateStatus =
  | "draft"
  | "published"
  | "sold_out"
  | "cancelled";

export type ExperienceDate = {
  id: string;
  date: string;            // YYYY-MM-DD
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
  timezone: string;
  doorsOpenTime?: string;
  capacity: number;
  cutoffHours: number;
  status: ExperienceDateStatus;
};

export type ExperienceTicket = {
  id: string;
  name: string;            // General / VIP
  price: number;
  maxPerUser: number;
  minPerOrder?: number;
  salesStart?: string;
  salesEnd?: string;

  allowXp: boolean;
  allowCorporate: boolean;
  allowPromocodes: boolean;

  experienceDateId?: string; // optional
};
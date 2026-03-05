/* ------------------------------------------------------------------ */
/* Nova Dashboard – Shared Types                                      */
/* ------------------------------------------------------------------ */

/* Hero Stat Cards (HR dashboard style) */
export type SparklinePoint = {
  current: number;
  previous: number;
};

export type WeeklyBar = {
  label: string;
  value: number;
};

export type HeroMetric = {
  label: string;
  subtitle: string;
  value: string;
  trend: string;
  trendDirection: "up" | "down" | "flat";
  trendLabel: string;
  chartType: "line" | "bar";
  href?: string;
  sparkline?: SparklinePoint[];
  weeklyBars?: WeeklyBar[];
};

/* Notification badges */
export type NotificationBadge = {
  icon: string;
  label: string;
  count: number;
};

/* Revenue Trend */
export type RevenueTrendPoint = {
  date: string;
  revenue: number;
  orders: number;
};

export type DateRangeKey = "7d" | "30d" | "90d";

/* Quick Actions */
export type QuickAction = {
  label: string;
  href: string;
  icon: string;
  color: string;
  comingSoon?: boolean;
};

/* Alerts */
export type AlertSeverity = "warning" | "info" | "error";

export type AlertItem = {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  comingSoon?: boolean;
};

/* Performance Table */
export type PerformanceRow = {
  id: string;
  name: string;
  type: "product" | "service";
  count: number;
  revenue: number;
  imageUrl?: string;
};

/* Activity Feed */
export type ActivityItem = {
  id: string;
  type: "order" | "booking";
  title: string;
  subtitle: string;
  amount?: string;
  timeAgo: string;
  status: string;
  statusColor: string;
};

/* Schedule */
export type ScheduleItem = {
  id: string;
  time: string;
  serviceName: string;
  customerName: string;
  location: string;
  status: string;
};

/* Next Actions */
export type NextAction = {
  id: string;
  priority: number;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  icon: string;
  comingSoon?: boolean;
};

/* Corporate */
export type CorporatePartner = {
  name: string;
  bookings: number;
  revenue: string;
};

/* Demand Dimensions */
export type DemandDimension = {
  label: string;
  percentage: number;
  trend: string;
  trendDirection: "up" | "down" | "flat";
  color: string;
};

/* Wellness Dimensions (radar/bar chart data) */
export type WellnessDimension = {
  dimension: string;
  current: number;
  previous: number;
};

/* Vendor Comparison */
export type VendorComparisonItem = {
  category: string;
  you: number;
  marketAvg: number;
  rank: number;
  totalVendors: number;
  trend: string;
  trendDirection: "up" | "down" | "flat";
};

/* Calendar booking dot */
export type CalendarBooking = {
  date: string;
  count: number;
};

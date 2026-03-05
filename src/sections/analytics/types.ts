/* ------------------------------------------------------------------ */
/* Analytics Page – Shared Types                                      */
/* ------------------------------------------------------------------ */

/* KPI cards at the top */
export type AnalyticsKPI = {
  label: string;
  value: string;
  trend: string;
  trendDirection: "up" | "down" | "flat";
  vsMarket: string; // e.g. "+18% vs market"
  vsMarketPositive: boolean;
  sparkline: { current: number; previous: number }[];
};

/* Traffic / engagement time-series */
export type TrafficPoint = {
  date: string; // yyyy-MM-dd
  yourViews: number;
  marketAvgViews: number;
};

/* Conversion funnel steps */
export type FunnelStep = {
  label: string;
  value: number;
  percentage: number; // % of first step
  marketAvg: number;
  color: string; // tailwind gradient classes
};

/* Category breakdown (Products / Sessions / Experiences) */
export type CategoryMetric = {
  category: string;
  you: number;
  marketAvg: number;
  trend: string;
  trendDirection: "up" | "down" | "flat";
};

/* Market comparison table rows */
export type MarketCompRow = {
  metric: string;
  you: string;
  marketAvg: string;
  top10: string;
  /** Numeric values for rendering the position bar (0-100 scale) */
  youPct: number;
  marketAvgPct: number;
  top10Pct: number;
  rank: number;
  totalVendors: number;
  trendDirection: "up" | "down" | "flat";
  /** Whether lower is better (e.g. response time) */
  lowerIsBetter?: boolean;
  /** 12-point monthly history for the trend chart (you vs market) */
  history?: { month: string; you: number; market: number }[];
};

/* Corporate KPI summary */
export type CorporateKPI = {
  label: string;
  value: string;
  subtitle: string;
  icon: string;
};

/* Corporate partner performance */
export type PartnerPerformance = {
  name: string;
  program: string;
  bookings: number;
  revenue: string;
  trend: string;
  trendDirection: "up" | "down" | "flat";
  satisfaction: number;
};

/* Corporate revenue trends */
export type CorporateTrendPoint = {
  date: string;
  [partnerName: string]: string | number;
};

/* Audience insight cards */
export type AudienceMetric = {
  label: string;
  value: string;
  description: string;
  icon: string;
  vsMarket?: string;
  vsMarketPositive?: boolean;
};

/* Customer heat map data */
export type HeatmapCell = {
  day: number; // 0 = Mon … 6 = Sun
  hour: number; // 0-23
  value: number; // booking count
};

export type GeoRegion = {
  region: string;
  bookings: number;
  revenue: string;
  pctOfTotal: number;
  trend: string;
  trendDirection: "up" | "down" | "flat";
  lat: number;
  lng: number;
  customers: number;
  avgSpend: string;
};

/* Date range for the analytics page */
export type AnalyticsDateRange = "7d" | "30d" | "90d" | "12m";

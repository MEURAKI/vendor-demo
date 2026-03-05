"use client";

import { useVendorProfile } from "../../../../context/VendorShellContext";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";
import { format } from "date-fns";
import clsx from "clsx";
import { ClipLoader } from "react-spinners";

/* Analytics section components */
import OverviewKPIs from "../../../../sections/analytics/overview-kpis";
import TrafficChart from "../../../../sections/analytics/traffic-chart";
import ConversionFunnel from "../../../../sections/analytics/conversion-funnel";
import CategoryBreakdown from "../../../../sections/analytics/category-breakdown";
import MarketComparison from "../../../../sections/analytics/market-comparison";
import CorporateAnalytics from "../../../../sections/analytics/corporate-analytics";
import AudienceInsights from "../../../../sections/analytics/audience-insights";
import CustomerHeatmap from "../../../../sections/analytics/customer-heatmap";

import type {
  AnalyticsKPI,
  TrafficPoint,
  FunnelStep,
  CategoryMetric,
  MarketCompRow,
  CorporateKPI,
  PartnerPerformance,
  CorporateTrendPoint,
  AudienceMetric,
  HeatmapCell,
  GeoRegion,
} from "../../../../sections/analytics/types";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: string;
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function AnalyticsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---- Auth + profile ---- */
  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/pages/auth/login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, email, full_name, status")
        .eq("id", session.user.id)
        .single();

      if (prof) setProfile(prof);
      setLoading(false);
    })();
  }, [router]);

  if (loading || !profile) {
    return (
      <div className="flex h-full w-full items-center justify-center">
            <ClipLoader size={48} color="#7B61FF" />
          </div>
    );
  }
  /* ---------------------------------------------------------------- */
  /* Mock Data                                                        */
  /* ---------------------------------------------------------------- */

  const mkSparkline = (base: number, variance: number, len = 20) =>
    Array.from({ length: len }, (_, i) => ({
      current: Math.round(
        base + Math.sin(i * 0.5) * variance + i * (variance * 0.04)
      ),
      previous: Math.round(
        base * 0.85 + Math.sin(i * 0.5 + 1) * variance * 0.7
      ),
    }));

  const mockKPIs: AnalyticsKPI[] = [
    {
      label: "Profile Views",
      value: "2,847",
      trend: "+18.2%",
      trendDirection: "up",
      vsMarket: "+32% vs market",
      vsMarketPositive: true,
      sparkline: mkSparkline(120, 40),
    },
    {
      label: "Total Bookings",
      value: "189",
      trend: "+34.1%",
      trendDirection: "up",
      vsMarket: "+97% vs market",
      vsMarketPositive: true,
      sparkline: mkSparkline(30, 12),
    },
    {
      label: "Revenue",
      value: "$12,450",
      trend: "+12.4%",
      trendDirection: "up",
      vsMarket: "+23% vs market",
      vsMarketPositive: true,
      sparkline: mkSparkline(400, 120),
    },
    {
      label: "Conversion Rate",
      value: "4.2%",
      trend: "+0.8pp",
      trendDirection: "up",
      vsMarket: "+1.1pp vs market",
      vsMarketPositive: true,
      sparkline: mkSparkline(3, 1.5),
    },
    {
      label: "Avg Rating",
      value: "4.8",
      trend: "+0.3",
      trendDirection: "up",
      vsMarket: "+0.6 vs market",
      vsMarketPositive: true,
      sparkline: mkSparkline(4.2, 0.3),
    },
  ];

  /* Traffic data: 90 days */
  const mockTraffic: TrafficPoint[] = (() => {
    const points: TrafficPoint[] = [];
    const now = new Date();
    for (let i = 90; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const yourBase = 80 + Math.sin(i * 0.12) * 30 + Math.random() * 25;
      const marketBase = 55 + Math.sin(i * 0.1) * 15 + Math.random() * 15;
      points.push({
        date: format(d, "yyyy-MM-dd"),
        yourViews: Math.round(yourBase),
        marketAvgViews: Math.round(marketBase),
      });
    }
    return points;
  })();

  /* Conversion funnel */
  const mockFunnel: FunnelStep[] = [
    {
      label: "Profile Views",
      value: 2847,
      percentage: 100,
      marketAvg: 1890,
      color: "from-purple-600 to-purple-400",
    },
    {
      label: "Product Clicks",
      value: 1234,
      percentage: 43.3,
      marketAvg: 756,
      color: "from-purple-500 to-purple-300",
    },
    {
      label: "Bookings Made",
      value: 189,
      percentage: 6.6,
      marketAvg: 96,
      color: "from-purple-400 to-purple-200",
    },
    {
      label: "Repeat Customers",
      value: 67,
      percentage: 2.4,
      marketAvg: 28,
      color: "from-purple-300 to-purple-100",
    },
  ];

  /* Category breakdown */
  const mockCategories: CategoryMetric[] = [
    {
      category: "Products",
      you: 45,
      marketAvg: 32,
      trend: "+12%",
      trendDirection: "up",
    },
    {
      category: "Sessions",
      you: 89,
      marketAvg: 45,
      trend: "+97%",
      trendDirection: "up",
    },
    {
      category: "Experiences",
      you: 12,
      marketAvg: 15,
      trend: "-20%",
      trendDirection: "down",
    },
  ];

  /* Market comparison */
  const MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const mkHistory = (youBase: number, mktBase: number, growth: number) =>
    MONTHS.map((m, i) => ({
      month: m,
      you: Math.round(youBase + i * growth + Math.sin(i * 0.8) * youBase * 0.08),
      market: Math.round(mktBase + i * (growth * 0.3) + Math.sin(i * 0.6) * mktBase * 0.05),
    }));

  const mockMarketComp: MarketCompRow[] = [
    {
      metric: "Monthly Revenue",
      you: "$12,450",
      marketAvg: "$8,200",
      top10: "$28,500",
      youPct: 44, marketAvgPct: 29, top10Pct: 100,
      rank: 5,
      totalVendors: 42,
      trendDirection: "up",
      history: mkHistory(8200, 7000, 400),
    },
    {
      metric: "Bookings / Month",
      you: "189",
      marketAvg: "96",
      top10: "340",
      youPct: 56, marketAvgPct: 28, top10Pct: 100,
      rank: 3,
      totalVendors: 42,
      trendDirection: "up",
      history: mkHistory(120, 85, 6),
    },
    {
      metric: "Average Rating",
      you: "4.8",
      marketAvg: "4.2",
      top10: "4.9",
      youPct: 98, marketAvgPct: 86, top10Pct: 100,
      rank: 4,
      totalVendors: 42,
      trendDirection: "up",
      history: MONTHS.map((m, i) => ({
        month: m,
        you: +(4.3 + i * 0.04 + Math.sin(i) * 0.05).toFixed(1),
        market: +(4.0 + i * 0.015 + Math.sin(i) * 0.03).toFixed(1),
      })),
    },
    {
      metric: "Response Time",
      you: "2.1 hrs",
      marketAvg: "4.8 hrs",
      top10: "0.5 hrs",
      youPct: 76, marketAvgPct: 40, top10Pct: 100,
      rank: 8,
      totalVendors: 42,
      trendDirection: "up",
      lowerIsBetter: true,
      history: MONTHS.map((m, i) => ({
        month: m,
        you: +(4.5 - i * 0.2 + Math.sin(i) * 0.3).toFixed(1),
        market: +(5.2 - i * 0.03 + Math.sin(i) * 0.2).toFixed(1),
      })),
    },
    {
      metric: "Listing Quality",
      you: "87/100",
      marketAvg: "72/100",
      top10: "95/100",
      youPct: 92, marketAvgPct: 76, top10Pct: 100,
      rank: 6,
      totalVendors: 42,
      trendDirection: "up",
      history: mkHistory(72, 68, 1.3),
    },
    {
      metric: "Return Customer Rate",
      you: "35%",
      marketAvg: "22%",
      top10: "48%",
      youPct: 73, marketAvgPct: 46, top10Pct: 100,
      rank: 5,
      totalVendors: 42,
      trendDirection: "up",
      history: mkHistory(22, 18, 1.1),
    },
    {
      metric: "Avg Order Value",
      you: "$78",
      marketAvg: "$65",
      top10: "$120",
      youPct: 65, marketAvgPct: 54, top10Pct: 100,
      rank: 9,
      totalVendors: 42,
      trendDirection: "flat",
      history: mkHistory(62, 58, 1.4),
    },
  ];

  /* Corporate KPIs */
  const mockCorpKPIs: CorporateKPI[] = [
    {
      label: "Active Programs",
      value: "12",
      subtitle: "+3 this quarter",
      icon: "Briefcase",
    },
    {
      label: "Corporate Revenue",
      value: "$10,150",
      subtitle: "38% of total revenue",
      icon: "DollarSign",
    },
    {
      label: "Avg Satisfaction",
      value: "4.7/5",
      subtitle: "Based on 156 reviews",
      icon: "Star",
    },
  ];

  /* Corporate partners */
  const mockPartners: PartnerPerformance[] = [
    {
      name: "TechCorp",
      program: "Onsite Wellness",
      bookings: 89,
      revenue: "$4,560",
      trend: "+15%",
      trendDirection: "up",
      satisfaction: 4.8,
    },
    {
      name: "Finance Inc",
      program: "Virtual Sessions",
      bookings: 67,
      revenue: "$3,340",
      trend: "+8%",
      trendDirection: "up",
      satisfaction: 4.7,
    },
    {
      name: "Startup Labs",
      program: "Product Orders",
      bookings: 45,
      revenue: "$2,250",
      trend: "+22%",
      trendDirection: "up",
      satisfaction: 4.9,
    },
    {
      name: "WellnessHub",
      program: "Onsite Wellness",
      bookings: 34,
      revenue: "$1,700",
      trend: "-5%",
      trendDirection: "down",
      satisfaction: 4.3,
    },
    {
      name: "CreativeAgency",
      program: "Virtual Sessions",
      bookings: 28,
      revenue: "$1,400",
      trend: "+12%",
      trendDirection: "up",
      satisfaction: 4.6,
    },
  ];

  /* Corporate trends: 30 days */
  const mockCorpTrends: CorporateTrendPoint[] = (() => {
    const points: CorporateTrendPoint[] = [];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      points.push({
        date: format(d, "yyyy-MM-dd"),
        TechCorp: Math.round(120 + Math.sin(i * 0.3) * 40 + Math.random() * 20),
        FinanceInc: Math.round(90 + Math.sin(i * 0.25) * 25 + Math.random() * 15),
        StartupLabs: Math.round(60 + Math.sin(i * 0.2) * 20 + Math.random() * 10),
      });
    }
    return points;
  })();

  /* Program breakdown */
  const mockProgramBreakdown = [
    { label: "Onsite Wellness", percentage: 45, color: "bg-purple-500" },
    { label: "Virtual Sessions", percentage: 30, color: "bg-cyan-500" },
    { label: "Product Orders", percentage: 25, color: "bg-amber-500" },
  ];

  /* Audience insights */
  const mockAudience: AudienceMetric[] = [
    {
      label: "Repeat Rate",
      value: "35%",
      description: "Customers who book again within 30 days",
      icon: "RefreshCw",
      vsMarket: "+13pp vs market",
      vsMarketPositive: true,
    },
    {
      label: "Avg Booking Value",
      value: "$78",
      description: "Average spend per booking",
      icon: "DollarSign",
      vsMarket: "+$12 vs market",
      vsMarketPositive: true,
    },
    {
      label: "Peak Hours",
      value: "9-11am",
      description: "Most bookings happen in the morning and 2-4pm",
      icon: "Clock",
    },
    {
      label: "Top Segment",
      value: "Corporate",
      description: "Employees aged 28-45, health-conscious professionals",
      icon: "Users",
    },
  ];

  /* Customer heat map data */
  const mockHeatmapCells: HeatmapCell[] = (() => {
    const cells: HeatmapCell[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        /* Realistic booking patterns:
           - Peak: weekdays 9-11am and 2-4pm
           - Moderate: weekday lunch, Saturday morning
           - Low: early morning, late evening, Sunday
        */
        let base = 0;
        const isWeekday = day < 5;
        const isSaturday = day === 5;

        if (hour < 6 || hour > 22) {
          base = Math.round(Math.random() * 2);
        } else if (isWeekday && hour >= 9 && hour <= 11) {
          base = 12 + Math.round(Math.random() * 8); // peak morning
        } else if (isWeekday && hour >= 14 && hour <= 16) {
          base = 10 + Math.round(Math.random() * 7); // peak afternoon
        } else if (isWeekday && hour >= 12 && hour <= 13) {
          base = 6 + Math.round(Math.random() * 4); // lunch
        } else if (isWeekday) {
          base = 3 + Math.round(Math.random() * 4); // other weekday hours
        } else if (isSaturday && hour >= 9 && hour <= 14) {
          base = 7 + Math.round(Math.random() * 5); // Sat morning
        } else if (isSaturday) {
          base = 2 + Math.round(Math.random() * 3);
        } else {
          base = 1 + Math.round(Math.random() * 2); // Sunday
        }

        cells.push({ day, hour, value: base });
      }
    }
    return cells;
  })();

  const mockGeoRegions: GeoRegion[] = [
    {
      region: "Marina Bay",
      bookings: 67,
      revenue: "$5,226",
      pctOfTotal: 28,
      trend: "+22%",
      trendDirection: "up",
      lat: 1.2838,
      lng: 103.8591,
      customers: 48,
      avgSpend: "$109",
    },
    {
      region: "Orchard Road",
      bookings: 52,
      revenue: "$4,056",
      pctOfTotal: 22,
      trend: "+15%",
      trendDirection: "up",
      lat: 1.3048,
      lng: 103.8318,
      customers: 39,
      avgSpend: "$104",
    },
    {
      region: "Raffles Place / CBD",
      bookings: 41,
      revenue: "$3,198",
      pctOfTotal: 17,
      trend: "+31%",
      trendDirection: "up",
      lat: 1.2847,
      lng: 103.8515,
      customers: 33,
      avgSpend: "$97",
    },
    {
      region: "Sentosa",
      bookings: 28,
      revenue: "$2,940",
      pctOfTotal: 12,
      trend: "+8%",
      trendDirection: "up",
      lat: 1.2494,
      lng: 103.8303,
      customers: 21,
      avgSpend: "$140",
    },
    {
      region: "Clarke Quay",
      bookings: 22,
      revenue: "$1,716",
      pctOfTotal: 9,
      trend: "+18%",
      trendDirection: "up",
      lat: 1.2884,
      lng: 103.8465,
      customers: 18,
      avgSpend: "$95",
    },
    {
      region: "Bugis / Arab St",
      bookings: 15,
      revenue: "$1,050",
      pctOfTotal: 6,
      trend: "-3%",
      trendDirection: "down",
      lat: 1.3006,
      lng: 103.8592,
      customers: 12,
      avgSpend: "$88",
    },
    {
      region: "Holland Village",
      bookings: 12,
      revenue: "$936",
      pctOfTotal: 5,
      trend: "+5%",
      trendDirection: "up",
      lat: 1.3112,
      lng: 103.7958,
      customers: 10,
      avgSpend: "$94",
    },
  ];

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <>
          {/* ============ HEADER ============ */}
          <div className="relative z-30 overflow-hidden bg-gradient-to-br from-[#7B61FF]/20 via-[#C084FC]/15 to-[#F6F6FC] px-8 pt-7 pb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-extrabold text-[#1B1529] tracking-tight">
                  Analytics
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {format(new Date(), "EEEE, MMMM d, yyyy")} &middot; Your
                  performance vs the market
                </p>
              </div>
            </div>
          </div>

          {/* ============ CONTENT ============ */}
          <div className="flex-1 overflow-auto px-8 pb-8 pt-6">
            {/* KPI Overview */}
            <OverviewKPIs kpis={mockKPIs} />

            {/* Traffic chart */}
            <TrafficChart data={mockTraffic} />

            {/* Two-column: Funnel + Category */}
            <div className="mb-8 grid gap-6 lg:grid-cols-2">
              <ConversionFunnel steps={mockFunnel} />
              <CategoryBreakdown
                data={mockCategories}
                insights={[
                  "Your Sessions outperform the market average by 97%. Consider expanding your session offerings.",
                  "Experiences are 20% below market — adding 2-3 new experiences could close this gap.",
                ]}
              />
            </div>

            {/* Market comparison table */}
            <MarketComparison rows={mockMarketComp} />

            {/* Corporate Analytics */}
            <CorporateAnalytics
              kpis={mockCorpKPIs}
              partners={mockPartners}
              trends={mockCorpTrends}
              programBreakdown={mockProgramBreakdown}
            />

            {/* Customer heat maps */}
            <CustomerHeatmap
              cells={mockHeatmapCells}
              regions={mockGeoRegions}
            />

            {/* Audience insights */}
            <div className="mb-8">
              <AudienceInsights metrics={mockAudience} />
            </div>
          </div>
        </>
  );
}

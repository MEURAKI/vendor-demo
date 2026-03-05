"use client";

import { useVendorProfile } from "../../../context/VendorShellContext";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";
import ClipLoader from "react-spinners/ClipLoader";
import clsx from "clsx";
import { format } from "date-fns";

/* Nova Dashboard Sections */
import StatsOverview from "../../../sections/dashboard/overview/stats-overview";
import SalesChart from "../../../sections/dashboard/overview/sales-chart";
import QuickActionsPanel from "../../../sections/dashboard/overview/quick-actions";
import AlertsPanel from "../../../sections/dashboard/overview/alerts-panel";
import VendorInsights from "../../../sections/dashboard/overview/vendor-insights";
import BookingsCalendar from "../../../sections/dashboard/overview/bookings-calendar";
import PerformanceTable from "../../../sections/dashboard/overview/performance-table";
import RecentActivity from "../../../sections/dashboard/overview/recent-activity";
import TodaySchedule from "../../../sections/dashboard/overview/today-schedule";
import NextActionsPanel from "../../../sections/dashboard/overview/next-actions";
import CorporateSummary from "../../../sections/dashboard/overview/corporate-summary";
import ComingSoonCard from "../../../sections/dashboard/overview/coming-soon-card";

import { Lightbulb, Bell, Users } from "lucide-react";

import type {
  HeroMetric,
  RevenueTrendPoint,
  QuickAction,
  AlertItem,
  PerformanceRow,
  ActivityItem,
  ScheduleItem,
  NextAction,
  CorporatePartner,
  WellnessDimension,
  VendorComparisonItem,
  CalendarBooking,
} from "../../../sections/dashboard/overview/types";


/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type UserStatus =
  | "pending_admin_approval"
  | "approved"
  | "active"
  | "rejected"
  | "suspended"
  | "incomplete_registration";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
  email_verified: boolean;
};

type Stats = {
  products: number;
  services: number;
  listings: number;
};

function getInitials(nameOrEmail?: string | null) {
  if (!nameOrEmail) return "U";
  const name = nameOrEmail.includes("@")
    ? nameOrEmail.split("@")[0]
    : nameOrEmail;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const redirectPath = useMemo(() => {
    if (!profile) return null;

    // 1) Email not verified → pending screen
    if (!profile.email_verified) {
      return "/pages/auth/pending";
    }

    // 2) Verified but onboarding not completed → onboarding flow
    if (
      profile.status === "incomplete_registration" &&
      !profile.onboarding_completed
    ) {
      return "/pages/onboarding/start";
    }

    // 3) Otherwise, they can stay on dashboard
    return null;
  }, [profile]);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      if (!user) {
        router.replace("/pages/auth/login");
        return;
      }

      // Load profile
      const { data: prof, error } = await supabase
        .from("profiles")
        .select(
          "id, email, status, onboarding_completed, full_name, email_verified"
        )
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error loading profile:", error);
      } else {
        setProfile(prof as Profile);
      }

      // Subscribe to profile changes
      const channel = supabase
        .channel(`profiles:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => setProfile(payload.new as Profile)
        )
        .subscribe();

      unsub = () => supabase.removeChannel(channel);

      // Load simple stats (adjust table/filters to your schema)
      try {
        const [{ count: productsCount }, { count: servicesCount }] =
          await Promise.all([
            supabase
              .from("products")
              .select("*", { count: "exact", head: true })
              .eq("vendor_id", user.id),
            supabase
              .from("services")
              .select("*", { count: "exact", head: true })
              .eq("vendor_id", user.id),
          ]);

        setStats({
          products: productsCount ?? 0,
          services: servicesCount ?? 0,
          listings: (productsCount ?? 0) + (servicesCount ?? 0),
        });
      } catch (e) {
        console.error("Error loading stats:", e);
        setStats({ products: 0, services: 0, listings: 0 });
      }

      setLoading(false);
    })();

    return () => unsub?.();
  }, [router]);

  useEffect(() => {
    if (!loading && redirectPath) {
      router.replace(redirectPath);
    }
  }, [loading, redirectPath, router]);
  // Loader — show layout shell with spinner inside content area
  if (loading || !profile) {
    return (
      <div className="flex h-full w-full items-center justify-center">
            <ClipLoader size={55} color="#6B46C1" cssOverride={{ animationDuration: "3s" }}/>
          </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Mock Data for Nova Dashboard                                     */
  /* (Replace with real Supabase queries when backend tables exist)   */
  /* ---------------------------------------------------------------- */

  /* -------------------------------------------------------------- */
  /* Mock Data (replace with real Supabase queries later)           */
  /* -------------------------------------------------------------- */

  /* Sparkline helpers – deterministic mock curves */
  const mkSparkline = (base: number, variance: number, len = 20) =>
    Array.from({ length: len }, (_, i) => ({
      current: Math.round(base + Math.sin(i * 0.5) * variance + i * (variance * 0.04)),
      previous: Math.round(base * 0.85 + Math.sin(i * 0.5 + 1) * variance * 0.7),
    }));

  const heroMetrics: HeroMetric[] = [
    {
      label: "Total Revenue",
      subtitle: "This month",
      value: "$12,450",
      trend: "3.2%",
      trendDirection: "up",
      trendLabel: "compared to last month",
      chartType: "line",
      href: "/pages/vendor/finance",
      sparkline: mkSparkline(400, 120),
    },
    {
      label: "Active Bookings",
      subtitle: "This month",
      value: "189",
      trend: "8.1%",
      trendDirection: "up",
      trendLabel: "compared to last month",
      chartType: "line",
      href: "/pages/vendor/bookings",
      sparkline: mkSparkline(30, 15),
    },
    {
      label: "Sessions Completed",
      subtitle: "This month",
      value: "1,847",
      trend: "12.4%",
      trendDirection: "up",
      trendLabel: "compared to last month",
      chartType: "bar",
      href: "/pages/vendor/bookings",
      weeklyBars: [
        { label: "Wk 1", value: 380 },
        { label: "Wk 2", value: 450 },
        { label: "Wk 3", value: 520 },
        { label: "Wk 4", value: 497 },
      ],
    },
    {
      label: "Total Orders",
      subtitle: "This month",
      value: "234",
      trend: "5.7%",
      trendDirection: "up",
      trendLabel: "compared to last month",
      chartType: "line",
      href: "/pages/vendor/orders",
      sparkline: mkSparkline(200, 40),
    },
  ];

  const mockRevenueTrend: RevenueTrendPoint[] = (() => {
    const points: RevenueTrendPoint[] = [];
    const now = new Date();
    for (let i = 90; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const base = 200 + Math.sin(i * 0.15) * 120 + Math.random() * 100;
      points.push({
        date: format(d, "yyyy-MM-dd"),
        revenue: Math.round(base),
        orders: Math.round(2 + Math.random() * 5),
      });
    }
    return points;
  })();

  const mockQuickActions: QuickAction[] = [
    { label: "Add Product", href: "/pages/products/new", icon: "Package", color: "bg-purple-100 text-purple-600" },
    { label: "Add Service", href: "/pages/services/new", icon: "ShoppingBasket", color: "bg-blue-100 text-blue-600" },
    { label: "View Calendar", href: "/pages/vendor/bookings", icon: "CalendarDays", color: "bg-orange-100 text-orange-600" },
    { label: "Create Promotion", href: "/pages/setting/shop", icon: "Tag", color: "bg-emerald-100 text-emerald-600" },
    { label: "Corporate Program", href: "#", icon: "Building2", color: "bg-slate-100 text-slate-500", comingSoon: true },
    { label: "Messages", href: "#", icon: "MessageSquare", color: "bg-pink-100 text-pink-600", comingSoon: true },
  ];

  const mockAlerts: AlertItem[] = [
    { id: "products-no-images", severity: "warning", title: "3 listings missing photos", description: "Products with photos get 3x more views.", actionLabel: "Fix now", actionHref: "/pages/products" },
    { id: "promos-expiring", severity: "warning", title: "2 promotions expiring this week", description: "Review or extend your active promotions.", actionLabel: "Extend", actionHref: "/pages/setting/shop" },
    { id: "services-no-slots", severity: "error", title: "1 service has no availability", description: "Customers can't book without time slots.", actionLabel: "Update", actionHref: "/pages/services" },
    { id: "demand-pilates", severity: "info", title: "High demand for Pilates classes", description: "Searches up 45% this month.", actionLabel: "Learn More", actionHref: "#", comingSoon: true },
    { id: "ranking-yoga", severity: "info", title: "Yoga class ranks #3 of 12 providers", description: "See how you compare.", actionLabel: "View", actionHref: "#", comingSoon: true },
  ];

  /* Wellness Dimensions (radar chart) */
  const mockWellnessDimensions: WellnessDimension[] = [
    { dimension: "Physical", current: 142, previous: 110 },
    { dimension: "Mental", current: 89, previous: 75 },
    { dimension: "Emotional", current: 67, previous: 60 },
    { dimension: "Social", current: 45, previous: 48 },
    { dimension: "Spiritual", current: 23, previous: 15 },
    { dimension: "Environmental", current: 34, previous: 30 },
    { dimension: "Financial", current: 56, previous: 52 },
    { dimension: "Intellectual", current: 78, previous: 70 },
  ];

  /* Vendor comparison data */
  const mockVendorComparison: VendorComparisonItem[] = [
    { category: "Products", you: 45, marketAvg: 32, rank: 3, totalVendors: 25, trend: "+12%", trendDirection: "up" },
    { category: "Sessions", you: 89, marketAvg: 45, rank: 2, totalVendors: 18, trend: "+23%", trendDirection: "up" },
    { category: "Experiences", you: 12, marketAvg: 8, rank: 5, totalVendors: 20, trend: "+8%", trendDirection: "up" },
  ];

  /* Calendar bookings */
  const mockCalendarBookings: CalendarBooking[] = (() => {
    const bookings: CalendarBooking[] = [];
    const now = new Date();
    for (let i = 1; i <= 28; i++) {
      if (Math.random() > 0.4) {
        const d = new Date(now.getFullYear(), now.getMonth(), i);
        bookings.push({ date: format(d, "yyyy-MM-dd"), count: Math.ceil(Math.random() * 4) });
      }
    }
    return bookings;
  })();

  const mockTopProducts: PerformanceRow[] = [
    { id: "1", name: "Organic Wellness Tea Set", type: "product", count: 156, revenue: 780000 },
    { id: "2", name: "Aromatherapy Diffuser Kit", type: "product", count: 98, revenue: 490000 },
    { id: "3", name: "Meditation Cushion Premium", type: "product", count: 74, revenue: 370000 },
    { id: "4", name: "Essential Oil Bundle", type: "product", count: 67, revenue: 268000 },
    { id: "5", name: "Yoga Mat Eco-Friendly", type: "product", count: 45, revenue: 225000 },
  ];

  const mockTopServices: PerformanceRow[] = [
    { id: "1", name: "Vinyasa Flow Yoga", type: "service", count: 89, revenue: 445000 },
    { id: "2", name: "Sound Healing Session", type: "service", count: 67, revenue: 469000 },
    { id: "3", name: "Nutrition Consultation", type: "service", count: 23, revenue: 230000 },
    { id: "4", name: "Reiki Energy Healing", type: "service", count: 18, revenue: 180000 },
    { id: "5", name: "Corporate Wellness Workshop", type: "service", count: 12, revenue: 360000 },
  ];

  const mockRecentOrders: ActivityItem[] = [
    { id: "1", type: "order", title: "Order #A8F3D2", subtitle: "Jane Smith - Organic Wellness Tea Set, Yoga Mat", amount: "$145.00", timeAgo: "2 hours ago", status: "placed", statusColor: "bg-amber-400" },
    { id: "2", type: "order", title: "Order #B7E4C1", subtitle: "Mike Johnson - Aromatherapy Diffuser Kit", amount: "$89.00", timeAgo: "5 hours ago", status: "shipped", statusColor: "bg-blue-400" },
    { id: "3", type: "order", title: "Order #C6D5B0", subtitle: "Sarah Lee - Essential Oil Bundle, Meditation Cushion, Tea Set", amount: "$267.00", timeAgo: "1 day ago", status: "delivered", statusColor: "bg-green-400" },
    { id: "4", type: "order", title: "Order #D5C6A9", subtitle: "Alex Chen - Yoga Mat Eco-Friendly", amount: "$45.00", timeAgo: "2 days ago", status: "delivered", statusColor: "bg-green-400" },
    { id: "5", type: "order", title: "Order #E4B798", subtitle: "Emma Wilson - Diffuser Kit, Essential Oil Bundle", amount: "$178.00", timeAgo: "3 days ago", status: "cancelled", statusColor: "bg-red-400" },
  ];

  const mockRecentBookings: ActivityItem[] = [
    { id: "1", type: "booking", title: "Vinyasa Flow Yoga", subtitle: "Jane Smith - Tomorrow 9am", amount: "$65.00", timeAgo: "1 hour ago", status: "confirmed", statusColor: "bg-green-400" },
    { id: "2", type: "booking", title: "Sound Healing Session", subtitle: "John Doe - Wed 2pm", amount: "$85.00", timeAgo: "3 hours ago", status: "confirmed", statusColor: "bg-green-400" },
    { id: "3", type: "booking", title: "Nutrition Consultation", subtitle: "Sarah Lee - Thu 10am", amount: "$120.00", timeAgo: "6 hours ago", status: "confirmed", statusColor: "bg-green-400" },
    { id: "4", type: "booking", title: "Corporate Wellness", subtitle: "TechCorp - Fri 2pm", amount: "$450.00", timeAgo: "1 day ago", status: "confirmed", statusColor: "bg-green-400" },
    { id: "5", type: "booking", title: "Reiki Energy Healing", subtitle: "Alex Chen - Sat 11am", amount: "$95.00", timeAgo: "2 days ago", status: "awaiting_payment", statusColor: "bg-amber-400" },
  ];

  const mockTodaySchedule: ScheduleItem[] = [
    { id: "1", time: "9:00 AM", serviceName: "Vinyasa Flow Yoga", customerName: "Jane Smith", location: "Studio A", status: "confirmed" },
    { id: "2", time: "11:00 AM", serviceName: "Nutrition Consultation", customerName: "Mike Johnson", location: "Online", status: "confirmed" },
    { id: "3", time: "2:00 PM", serviceName: "Sound Healing Session", customerName: "Sarah Lee", location: "Studio B", status: "confirmed" },
    { id: "4", time: "4:00 PM", serviceName: "TechCorp Wellness Day", customerName: "Corporate Event", location: "Main Hall", status: "confirmed" },
  ];

  const mockNextActions: NextAction[] = [
    { id: "fix-photos", priority: 1, title: "Add photos to 3 listings", description: "Products with quality photos see 40% higher booking rates.", actionLabel: "Fix Now", actionHref: "/pages/products", icon: "Camera" },
    { id: "create-promo", priority: 2, title: "Create a wellness promotion", description: "This month sees 60% higher demand for your category.", actionLabel: "Create Promo", actionHref: "/pages/setting/shop", icon: "Tag" },
    { id: "bundle-services", priority: 3, title: "Bundle your top 2 services", description: "Customers who book yoga often add nutrition consultations.", actionLabel: "Create Bundle", actionHref: "/pages/products/bundles", icon: "Layers" },
    { id: "corporate-pending", priority: 4, title: "Reach out to 3 pending corporate partners", description: "Response time impacts approval rate.", actionLabel: "View Pending", actionHref: "#", icon: "Building2", comingSoon: true },
  ];

  const mockCorporatePartners: CorporatePartner[] = [
    { name: "TechCorp", bookings: 89, revenue: "$4,560" },
    { name: "Finance Inc", bookings: 67, revenue: "$3,340" },
    { name: "Startup Labs", bookings: 45, revenue: "$2,250" },
  ];

  const initials = getInitials(profile.full_name || profile.email);
  const displayName = profile.full_name || profile.email || "Subscriber";

  return (
    <div className="relative min-h-full flex-1 overflow-auto">
          {/* ═══ BACKGROUND IMAGE ═══ */}
          <div className="absolute top-0 left-0 right-0 h-[420px] overflow-hidden pointer-events-none">
            <img src="/images/vendor bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-[#F6F6FC]" />
          </div>

          {/* ═══ CONTENT (on top of image) ═══ */}
          <div className="relative px-6 sm:px-8 py-6 sm:py-8 space-y-6">

            {/* ═══ GLASS PANEL — hero ═══ */}
            <div className="rounded-3xl bg-white/[0.25] backdrop-blur-3xl border border-white/40 shadow-[0_22px_90px_rgba(124,58,237,0.35)] p-4 sm:p-6 xl:p-10">
              {/* Top row: Welcome + Avatar */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold text-black tracking-tight">
                    Welcome back, {profile.full_name?.split(" ")[0] || "there"}
                  </h1>
                  <p className="mt-1.5 text-sm text-black/50">
                    {format(new Date(), "EEEE, MMMM d, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {displayName}
                    </p>
                    <p className="text-xs text-gray-400">Subscriber</p>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-purple-600 text-sm font-bold text-white">
                    {initials}
                  </div>
                </div>
              </div>

              {/* Notification badges bar */}
              <div className="mt-5 flex items-center gap-2">
                <div className="inline-flex items-center gap-5 rounded-full bg-black/[0.08] px-5 py-2.5">
                  <span className="flex items-center gap-1.5 text-xs text-black/70">
                    <Lightbulb className="h-3.5 w-3.5 text-purple-500" />
                    <span className="font-semibold text-black">12</span> AI suggestions
                  </span>
                  <span className="h-1 w-1 rounded-full bg-black/20" />
                  <span className="flex items-center gap-1.5 text-xs text-black/70">
                    <Bell className="h-3.5 w-3.5 text-purple-500" />
                    <span className="font-semibold text-black">5</span> notifications
                  </span>
                  <span className="h-1 w-1 rounded-full bg-black/20" />
                  <span className="flex items-center gap-1.5 text-xs text-black/70">
                    <Users className="h-3.5 w-3.5 text-purple-500" />
                    <span className="font-semibold text-black">3</span> pending orders
                  </span>
                </div>
              </div>

              {/* Hero Stats inside glass */}
              <div className="mt-6">
                <StatsOverview metrics={heroMetrics} />
              </div>
            </div>

            {/* ═══ BODY CONTENT ═══ */}

            {/* Revenue Trend Chart */}
            <SalesChart data={mockRevenueTrend} />

            {/* Two-column: Wellness Dimensions + Bookings Calendar */}
            <div className="mb-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <VendorInsights
                wellnessDimensions={mockWellnessDimensions}
                strongest={{ dimension: "Physical", count: 142 }}
                vendorComparison={mockVendorComparison}
              />
              <BookingsCalendar bookings={mockCalendarBookings} />
            </div>

            {/* Quick Actions */}
            <QuickActionsPanel actions={mockQuickActions} />

            {/* Alerts & Quick-Fixes */}
            <AlertsPanel alerts={mockAlerts} />

            {/* Two-column: Performance Table + Recent Activity */}
            <div className="mb-8 grid gap-6 lg:grid-cols-2">
              <PerformanceTable
                topProducts={mockTopProducts}
                topServices={mockTopServices}
                insight="Sound Healing has highest conversion but lowest visibility. Consider promoting it more."
              />
              <RecentActivity
                orders={mockRecentOrders}
                bookings={mockRecentBookings}
              />
            </div>

            {/* Today's Schedule (full width) */}
            <div className="mb-8">
              <TodaySchedule items={mockTodaySchedule} />
            </div>

            {/* Next Best Actions */}
            <NextActionsPanel actions={mockNextActions} />

            {/* Corporate Summary */}
            <CorporateSummary
              activePartners={12}
              pendingApproval={3}
              topPartners={mockCorporatePartners}
            />

            {/* Coming Soon: Emerging Trends + Competitive Positioning */}
            <div className="grid gap-6 lg:grid-cols-2">
              <ComingSoonCard
                title="Emerging Wellness Demand Trends"
                description="AI-powered trend detection across all wellness dimensions, helping you stay ahead of the market."
                benefits={[
                  "Identify emerging search trends before competitors",
                  "Detect service gaps in your offerings",
                  "Discover bundle opportunities from booking patterns",
                ]}
              />
              <ComingSoonCard
                title="Competitive Positioning"
                description="See how you rank against similar wellness providers in your area with anonymized benchmarks."
                benefits={[
                  "Benchmark your pricing against similar subscribers",
                  "Track your ranking in your category",
                  "Discover growth opportunities and service gaps",
                ]}
              />
            </div>
          </div>
    </div>
  );
}
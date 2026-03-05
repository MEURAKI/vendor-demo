// app/pages/rewards/submissions/page.tsx
"use client";

import { useVendorProfile } from "../../../../context/VendorShellContext";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import clsx from "clsx";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isToday,
  isSameDay,
  getDay,
  isBefore,
  startOfDay,
} from "date-fns";


import ClipLoader from "react-spinners/ClipLoader";

import {
  Gift,
  Plus,
  XCircle,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Send,
  Pencil,
  Copy,
  Percent,
  ShoppingBag,
  Ticket,
  Users,
  TrendingUp,
  Trophy,
  BarChart3,
  Sparkles,
  Zap,
  Star,
  Lock,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Search,
  ListFilter,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Package,
  ExternalLink,
  Eye,
  RotateCcw,
  ArrowUpRight,
  Globe,
  MapPin,
  Link2,
  Check,
  Wrench,
  Home,
} from "lucide-react";

/* ================================================================ */
/* Types                                                            */
/* ================================================================ */

type UserStatus = "active" | "inactive" | "pending";
type Profile = { id: string; email: string | null; status: UserStatus; onboarding_completed: boolean; full_name: string | null };
type SubmissionStatus = "draft" | "pending" | "accepted" | "rejected" | "revision_requested" | "assigned";
type OfferingType = "discount" | "product" | "sample" | "session" | "event";

type RewardSubmission = {
  id: string;
  title: string;
  offeringType: OfferingType;
  description: string;
  retailValue: number;
  cycle: string;
  status: SubmissionStatus;
  submittedDate: string | null;
  assignedDate: string | null;
  requestedDate: string | null;
  adminNote: string | null;
  imageUrl?: string | null;
  // Discount fields
  discountKind: "percentage" | "fixed" | null;
  discountValue: number | null;
  usageLimit: number | null;
  conditions: string | null;
  // Product fields
  quantity: number | null;
  deliveryMethod: "ship" | "pickup" | "digital" | null;
  // Sample fields
  sampleDescription: string | null;
  fullProductLink: string | null;
  // Session fields
  sessionDuration: string | null;
  spotsAvailable: number | null;
  locationKind: "venue" | "online" | "user_location" | null;
  bookingLink: string | null;
  // Scheduling
  preferredDays: string[];
  dayPreference: "any" | "specific" | "week" | "sundays";
  preferredWeek: number | null;
  // Pitch
  pitch: string | null;
  teaserSuggestion: string | null;
  // Stats (for assigned)
  claimsCount?: number;
  participationRate?: number;
};

type DayInsight = {
  applicants: number; slots: number; avgOfferValue: number;
  estimatedReach: number; estimatedRedemptions: number;
  demandScore: number; conversionRate: number;
  status: "open" | "filling" | "last_spot" | "taken";
};

type ActiveTab = "calendar" | "live" | "applications";
type ApplicationFilter = "all" | SubmissionStatus;

type CycleOption = { label: string; value: string; status: "active" | "upcoming" | "draft" };

/* ================================================================ */
/* Constants                                                        */
/* ================================================================ */

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: "Draft", pending: "Pending", accepted: "Accepted",
  rejected: "Rejected", revision_requested: "Revision Requested", assigned: "On Calendar",
};

const STATUS_PILL: Record<SubmissionStatus, string> = {
  draft: "bg-gray-100 text-gray-500",
  pending: "bg-gray-700 text-gray-100",
  accepted: "bg-blue-50 text-blue-600",
  rejected: "bg-red-50 text-red-500",
  revision_requested: "bg-orange-50 text-orange-600",
  assigned: "bg-emerald-50 text-emerald-600",
};

const OFFERING_TYPES: { value: OfferingType; label: string; icon: typeof Gift; desc: string }[] = [
  { value: "product", label: "Product", icon: Package, desc: "A physical product from your catalog" },
  { value: "session", label: "Session", icon: CalendarCheck, desc: "Yoga, meditation, coaching, etc." },
  { value: "event", label: "Event", icon: Ticket, desc: "A workshop, class, or group experience" },
];

const DURATION_OPTIONS = ["30 min", "45 min", "60 min", "90 min"];

/* Mock vendor inventory */
type InventoryVariant = { id: string; label: string; sku: string; price: number; stock: number };
type InventoryItem = {
  id: string; name: string; type: OfferingType; price: number; imageUrl?: string;
  // Products
  sku?: string; variantCount?: number; variants?: InventoryVariant[];
  // Sessions/services
  serviceTypes?: ("1-on-1" | "group")[]; locationTypes?: ("online" | "venue" | "at_home")[];
  maxParticipants?: number; sessionDuration?: string;
};
const VENDOR_INVENTORY: InventoryItem[] = [
  { id: "inv-1", name: "Organic Face Mask Set", type: "product", price: 85, sku: "SKU-FM-001", variantCount: 3,
    variants: [{ id: "v1a", label: "30ml", sku: "SKU-FM-001-30", price: 75, stock: 42 }, { id: "v1b", label: "50ml", sku: "SKU-FM-001-50", price: 85, stock: 28 }, { id: "v1c", label: "100ml", sku: "SKU-FM-001-100", price: 110, stock: 15 }],
    imageUrl: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&h=300&fit=crop" },
  { id: "inv-2", name: "Wellness Tea Sampler", type: "product", price: 45, sku: "SKU-TS-002", variantCount: 0,
    imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop" },
  { id: "inv-3", name: "Aromatherapy Session", type: "session", price: 120, sku: "SVC-AR-003",
    serviceTypes: ["1-on-1"], locationTypes: ["venue", "at_home"], sessionDuration: "60 min", maxParticipants: 1,
    imageUrl: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=400&h=300&fit=crop" },
  { id: "inv-4", name: "Yoga Flow Class", type: "session", price: 45, sku: "SVC-YG-004",
    serviceTypes: ["1-on-1", "group"], locationTypes: ["venue", "online", "at_home"], sessionDuration: "60 min", maxParticipants: 12,
    imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop" },
  { id: "inv-5", name: "Sound Healing Session", type: "session", price: 120, sku: "SVC-SH-005",
    serviceTypes: ["group"], locationTypes: ["venue"], sessionDuration: "75 min", maxParticipants: 8,
    imageUrl: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=300&fit=crop" },
  { id: "inv-6", name: "Deep Tissue Massage", type: "session", price: 150, sku: "SVC-DT-006",
    serviceTypes: ["1-on-1"], locationTypes: ["venue", "at_home"], sessionDuration: "90 min", maxParticipants: 1,
    imageUrl: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop" },
  { id: "inv-7", name: "Meditation Candle Set", type: "product", price: 55, sku: "SKU-MC-007", variantCount: 2,
    variants: [{ id: "v7a", label: "Lavender", sku: "SKU-MC-007-LAV", price: 55, stock: 60 }, { id: "v7b", label: "Eucalyptus", sku: "SKU-MC-007-EUC", price: 55, stock: 45 }],
    imageUrl: "https://images.unsplash.com/photo-1602607550887-3f6a0c6b1650?w=400&h=300&fit=crop" },
  { id: "inv-11", name: "Wellness Workshop", type: "event", price: 180, imageUrl: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&h=300&fit=crop" },
  { id: "inv-12", name: "Sound Bath Experience", type: "event", price: 95, imageUrl: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=300&fit=crop" },
  { id: "inv-13", name: "Breathwork & Mindfulness Event", type: "event", price: 75, imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=300&fit=crop" },
];

const CYCLES: CycleOption[] = [
  { label: "Feb — Mar 2026", value: "feb-mar-2026", status: "active" },
  { label: "Apr — May 2026", value: "apr-may-2026", status: "upcoming" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isXpDay(day: Date) { const d = getDay(day); return d === 1 || d === 2; }
function isSunday(day: Date) { return getDay(day) === 0; }
function fmt$(n: number) { return `$${n.toFixed(0)}`; }

function discountBadgeText(sub: RewardSubmission): string | null {
  if (sub.discountKind === "percentage" && sub.discountValue) return `${sub.discountValue}% OFF`;
  if (sub.discountKind === "fixed" && sub.discountValue) return `$${sub.discountValue} OFF`;
  if (sub.offeringType === "sample") return "Free Sample";
  if (sub.retailValue === 0) return "Free Gift";
  return null;
}

function offeringTypeLabel(type: string): string {
  const map: Record<string, string> = {
    product: "Product", session: "Session", event: "Event",
    discount: "Discount", sample: "Sample",
  };
  return map[type] || type;
}

/* ================================================================ */
/* Mock intelligence                                                */
/* ================================================================ */

/* Hardcoded high-bid example for demo */
const HIGH_BID_DATE = "2026-03-11"; // Wednesday with 5 bids

function genInsight(ds: string, hasSubs: boolean): DayInsight {
  // Show a hot bidding day
  if (ds === HIGH_BID_DATE) {
    return {
      applicants: 5, slots: 2, avgOfferValue: 135,
      estimatedReach: 3200, estimatedRedemptions: 120,
      demandScore: 92, conversionRate: 38,
      status: "filling",
    };
  }
  let h = 0;
  for (let i = 0; i < ds.length; i++) { h = ((h << 5) - h) + ds.charCodeAt(i); h |= 0; }
  const r = (a: number, b: number) => { h = ((h * 1103515245) + 12345) & 0x7fffffff; return a + (h % (b - a + 1)); };
  const slots = r(2, 4);
  const app = hasSubs ? r(0, slots - 1) : r(0, slots + 1);
  const filled = !hasSubs && app >= slots;
  const lastSpot = !filled && app === slots - 1;
  const filling = !filled && app >= 2;
  return {
    applicants: app, slots, avgOfferValue: app > 0 ? r(40, 180) : 0,
    estimatedReach: r(800, 5000), estimatedRedemptions: r(20, 200),
    demandScore: Math.min(100, app * 15 + r(10, 30)), conversionRate: r(12, 45),
    status: filled ? "taken" : lastSpot ? "last_spot" : filling ? "filling" : "open",
  };
}

/* ================================================================ */
/* Mock data                                                        */
/* ================================================================ */

const MOCK: RewardSubmission[] = [
  {
    id: "1", title: "20% Off Yoga Package", offeringType: "discount",
    description: "20% discount on any 5-class yoga package.", retailValue: 150,
    discountKind: "percentage", discountValue: 20, usageLimit: 50, conditions: "New customers only",
    quantity: null, deliveryMethod: null, sampleDescription: null, fullProductLink: null,
    sessionDuration: null, spotsAvailable: null, locationKind: null, bookingLink: null,
    cycle: "feb-mar-2026", status: "assigned", submittedDate: "2026-02-15",
    assignedDate: "2026-03-04", requestedDate: "2026-03-04", adminNote: null,
    imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop",
    preferredDays: ["2026-03-04"], dayPreference: "specific", preferredWeek: null,
    pitch: "Our yoga package is perfect for wellness-focused users starting their fitness journey.",
    teaserSuggestion: "Something relaxing from ZenFlow Yoga...",
    claimsCount: 47, participationRate: 78,
  },
  {
    id: "2", title: "Free Aromatherapy Session", offeringType: "session",
    description: "Complimentary 30-min aromatherapy session.", retailValue: 85,
    discountKind: null, discountValue: null, usageLimit: null, conditions: null,
    quantity: null, deliveryMethod: null, sampleDescription: null, fullProductLink: null,
    sessionDuration: "30 min", spotsAvailable: 20, locationKind: "venue", bookingLink: null,
    cycle: "feb-mar-2026", status: "accepted", submittedDate: "2026-02-18",
    assignedDate: null, requestedDate: "2026-03-12", adminNote: null,
    imageUrl: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=400&h=300&fit=crop",
    preferredDays: [], dayPreference: "any", preferredWeek: null,
    pitch: "Aromatherapy is a gateway to our full wellness menu.", teaserSuggestion: null,
  },
  {
    id: "3", title: "Wellness Tea Sampler", offeringType: "sample",
    description: "Curated box of 6 organic wellness teas.", retailValue: 45,
    discountKind: null, discountValue: null, usageLimit: null, conditions: null,
    quantity: 30, deliveryMethod: "ship", sampleDescription: "6 individual tea sachets: chamomile, matcha, turmeric latte, peppermint, rooibos, and ginger lemon.",
    fullProductLink: "https://example.com/full-tea-set",
    sessionDuration: null, spotsAvailable: null, locationKind: null, bookingLink: null,
    cycle: "feb-mar-2026", status: "pending", submittedDate: "2026-02-25",
    assignedDate: null, requestedDate: "2026-03-13", adminNote: null,
    imageUrl: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=300&fit=crop",
    preferredDays: ["2026-03-13"], dayPreference: "specific", preferredWeek: null,
    pitch: "Tea sampling drives repeat purchases — 40% conversion rate.", teaserSuggestion: "A taste of calm from TeaHaven...",
  },
  {
    id: "4", title: "Sound Healing Session", offeringType: "session",
    description: "Group sound healing for 8 participants.", retailValue: 120,
    discountKind: null, discountValue: null, usageLimit: null, conditions: null,
    quantity: null, deliveryMethod: null, sampleDescription: null, fullProductLink: null,
    sessionDuration: "60 min", spotsAvailable: 8, locationKind: "venue", bookingLink: null,
    cycle: "feb-mar-2026", status: "rejected", submittedDate: "2026-02-10",
    assignedDate: null, requestedDate: "2026-03-07", adminNote: "Duplicate offering this cycle. Resubmit for April.",
    imageUrl: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=300&fit=crop",
    preferredDays: ["2026-03-07"], dayPreference: "specific", preferredWeek: null,
    pitch: null, teaserSuggestion: null,
  },
  {
    id: "5", title: "15% Off Meditation Cushion", offeringType: "discount",
    description: "15% off eco-friendly meditation cushion.", retailValue: 68,
    discountKind: "percentage", discountValue: 15, usageLimit: 100, conditions: null,
    quantity: null, deliveryMethod: null, sampleDescription: null, fullProductLink: null,
    sessionDuration: null, spotsAvailable: null, locationKind: null, bookingLink: null,
    cycle: "feb-mar-2026", status: "assigned", submittedDate: "2026-02-20",
    assignedDate: "2026-03-06", requestedDate: "2026-03-06", adminNote: null,
    imageUrl: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&h=300&fit=crop",
    preferredDays: ["2026-03-06"], dayPreference: "specific", preferredWeek: null,
    pitch: "Meditation cushions are our bestseller.", teaserSuggestion: null,
    claimsCount: 32, participationRate: 65,
  },
  {
    id: "6", title: "Organic Face Mask Set", offeringType: "product",
    description: "3 organic vegan face masks.", retailValue: 55,
    discountKind: null, discountValue: null, usageLimit: null, conditions: null,
    quantity: 25, deliveryMethod: "ship", sampleDescription: null, fullProductLink: null,
    sessionDuration: null, spotsAvailable: null, locationKind: null, bookingLink: null,
    cycle: "feb-mar-2026", status: "assigned", submittedDate: "2026-02-12",
    assignedDate: "2026-03-14", requestedDate: "2026-03-14", adminNote: null,
    imageUrl: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&h=300&fit=crop",
    preferredDays: ["2026-03-14"], dayPreference: "specific", preferredWeek: null,
    pitch: null, teaserSuggestion: "A glow-up gift from GlowNatural...",
    claimsCount: 25, participationRate: 100,
  },
  {
    id: "7", title: "25% Off Wellness Workshop", offeringType: "discount",
    description: "25% off any corporate wellness workshop.", retailValue: 200,
    discountKind: "percentage", discountValue: 25, usageLimit: 30, conditions: "Min 5 pax",
    quantity: null, deliveryMethod: null, sampleDescription: null, fullProductLink: null,
    sessionDuration: null, spotsAvailable: null, locationKind: null, bookingLink: null,
    cycle: "feb-mar-2026", status: "assigned", submittedDate: "2026-02-22",
    assignedDate: "2026-03-19", requestedDate: "2026-03-19", adminNote: null,
    imageUrl: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&h=300&fit=crop",
    preferredDays: ["2026-03-19"], dayPreference: "specific", preferredWeek: null,
    pitch: "Corporate workshops generate B2B leads.", teaserSuggestion: null,
    claimsCount: 18, participationRate: 60,
  },
  {
    id: "8", title: "Mini Skincare Kit", offeringType: "sample",
    description: "Trial-size cleanser, toner, and moisturizer.", retailValue: 25,
    discountKind: null, discountValue: null, usageLimit: null, conditions: null,
    quantity: 50, deliveryMethod: "ship",
    sampleDescription: "3 travel-size products from our organic skincare line.", fullProductLink: "https://example.com/skincare",
    sessionDuration: null, spotsAvailable: null, locationKind: null, bookingLink: null,
    cycle: "feb-mar-2026", status: "revision_requested", submittedDate: "2026-02-28",
    assignedDate: null, requestedDate: null, adminNote: "Please add clearer product photos and increase quantity to at least 40.",
    preferredDays: [], dayPreference: "any", preferredWeek: null,
    pitch: "Skincare samples drive the highest repeat purchases.", teaserSuggestion: null,
  },
];

/* ================================================================ */
/* PAGE                                                             */
/* ================================================================ */

export default function RewardSubmissionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile: vendorProfile, loading: shellLoading } = useVendorProfile();
  const [subs, setSubs] = useState<RewardSubmission[]>(MOCK);
  const [month, setMonth] = useState(new Date());
  const [selCycle, setSelCycle] = useState(CYCLES[0].value);

  // Selection & tabs
  const [activeTab, setActiveTab] = useState<ActiveTab>("calendar");
  const [selDate, setSelDate] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showCyclePicker, setShowCyclePicker] = useState(false);

  // Applications
  const [appFilter, setAppFilter] = useState<ApplicationFilter>("all");
  const [appSearch, setAppSearch] = useState("");
  const [appCycleFilter, setAppCycleFilter] = useState("all");

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  function showToast(message: string, type: "success" | "error" = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // Modal
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selSub, setSelSub] = useState<RewardSubmission | null>(null);
  const [editingSub, setEditingSub] = useState<RewardSubmission | null>(null);

  // Form state
  const emptyForm = {
    title: "", offeringType: "" as OfferingType, desc: "",
    retailVal: "", notInCatalog: false,
    // Session details
    sessionFormat: "" as "" | "1-on-1" | "group",
    sessionLocation: "" as "" | "online" | "venue" | "at_home",
    selectedVariantId: "",
    // Pricing
    pricingKind: "" as "" | "free" | "percentage" | "fixed",
    discountKind: "percentage" as "percentage" | "fixed",
    discountValue: "", usageLimit: "", conditions: "",
    // Product
    quantity: "", deliveryMethod: "pickup" as "ship" | "pickup" | "digital",
    // Sample
    sampleDescription: "", fullProductLink: "",
    // Session
    sessionDuration: "60 min", spotsAvailable: "", locationKind: "venue" as "venue" | "online" | "user_location",
    bookingLink: "",
    // Schedule
    dayPreference: "any" as "any" | "specific" | "week" | "sundays",
    preferredDays: [] as string[], preferredWeek: 0,
    // Pitch
    pitch: "", teaserSuggestion: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [invSearch, setInvSearch] = useState("");
  const [selectedInv, setSelectedInv] = useState<InventoryItem | null>(null);

  const filteredInventory = VENDOR_INVENTORY.filter((item) => {
    const matchesType = !form.offeringType || item.type === form.offeringType;
    const matchesSearch = item.name.toLowerCase().includes(invSearch.toLowerCase());
    return matchesType && matchesSearch;
  });

  function selectInventoryItem(item: InventoryItem) {
    setSelectedInv(item);
    setInvSearch("");
    // Auto-set single-option session format/location
    const autoFormat = item.serviceTypes?.length === 1 ? item.serviceTypes[0] : "";
    const autoLocation = item.locationTypes?.length === 1 ? item.locationTypes[0] : "";
    setForm((f) => ({
      ...f,
      title: item.name,
      retailVal: item.price.toString(),
      offeringType: item.type,
      sessionFormat: autoFormat as "" | "1-on-1" | "group",
      sessionLocation: autoLocation as "" | "online" | "venue" | "at_home",
      selectedVariantId: "",
    }));
  }

  useEffect(() => { if (searchParams.get("new") === "true") openAdd(); }, [searchParams]);

  // Auth redirect handled by shell layout

  /* Computed */
  const stats = useMemo(() => {
    const cycleSubs = subs.filter((s) => s.cycle === selCycle);
    let total = 0, pending = 0, assigned = 0, drafts = 0, totalVal = 0, revReq = 0;
    cycleSubs.forEach((s) => {
      total++;
      if (s.status === "pending") pending++;
      if (s.status === "assigned") { assigned++; totalVal += s.retailValue; }
      if (s.status === "draft") drafts++;
      if (s.status === "revision_requested") revReq++;
    });
    const avgParticipation = cycleSubs.filter((s) => s.participationRate).length > 0
      ? Math.round(cycleSubs.reduce((sum, s) => sum + (s.participationRate || 0), 0) / cycleSubs.filter((s) => s.participationRate).length)
      : 0;
    return { total, pending, assigned, drafts, totalVal, revReq, avgParticipation };
  }, [subs, selCycle]);

  /* Calendar */
  const days = useMemo(() => {
    const s = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const e = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const arr: Date[] = []; let c = s;
    while (c <= e) { arr.push(c); c = addDays(c, 1); }
    return arr;
  }, [month]);

  const monthWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
    return weeks;
  }, [days]);

  const subsByDate = useMemo(() => {
    const m = new Map<string, RewardSubmission[]>();
    subs.forEach((s) => { const k = s.assignedDate || s.requestedDate; if (k) m.set(k, [...(m.get(k) || []), s]); });
    return m;
  }, [subs]);

  const insights = useMemo(() => {
    const m = new Map<string, DayInsight>();
    days.forEach((d) => { if (!isXpDay(d) && isSameMonth(d, month)) { const k = format(d, "yyyy-MM-dd"); m.set(k, genInsight(k, subsByDate.has(k))); } });
    return m;
  }, [days, month, subsByDate]);

  /* My Applications filtered */
  const filteredApps = useMemo(() => {
    return subs.filter((s) => {
      if (appCycleFilter !== "all" && s.cycle !== appCycleFilter) return false;
      if (appFilter !== "all" && s.status !== appFilter) return false;
      if (appSearch) {
        const q = appSearch.toLowerCase();
        return s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [subs, appFilter, appSearch, appCycleFilter]);

  const filterCounts = useMemo(() => {
    const base = appCycleFilter !== "all" ? subs.filter((s) => s.cycle === appCycleFilter) : subs;
    const c: Record<string, number> = { all: base.length };
    base.forEach((s) => { c[s.status] = (c[s.status] || 0) + 1; });
    return c;
  }, [subs, appCycleFilter]);

  if (shellLoading) return <div className="flex h-full w-full items-center justify-center">
    <ClipLoader size={55} color="#6B46C1" cssOverride={{ animationDuration: "3s" }} />
  </div>;

  /* Actions */
  function clickDate(d: Date) {
    if (!isSameMonth(d, month) || isXpDay(d)) return;
    setSelDate(d);
    setSelSub(null);
    setShowDetail(false);
  }

  function openAdd(presetSunday = false) {
    const newForm = { ...emptyForm };
    if (selDate) {
      newForm.preferredDays = [format(selDate, "yyyy-MM-dd")];
      newForm.dayPreference = "specific";
    }
    if (presetSunday) {
      newForm.dayPreference = "sundays";
    }
    setForm(newForm);
    setSelectedInv(null);
    setInvSearch("");
    setEditingSub(null);
    setShowAdd(true);
  }

  function openEdit(sub: RewardSubmission) {
    setForm({
      title: sub.title, offeringType: sub.offeringType, desc: sub.description,
      retailVal: sub.retailValue.toString(), notInCatalog: false,
      sessionFormat: "", sessionLocation: "", selectedVariantId: "",
      pricingKind: sub.discountKind === "percentage" ? "percentage" : sub.discountKind === "fixed" ? "fixed" : "free",
      discountKind: sub.discountKind || "percentage",
      discountValue: sub.discountValue?.toString() || "",
      usageLimit: sub.usageLimit?.toString() || "",
      conditions: sub.conditions || "",
      quantity: sub.quantity?.toString() || "",
      deliveryMethod: sub.deliveryMethod || "pickup",
      sampleDescription: sub.sampleDescription || "",
      fullProductLink: sub.fullProductLink || "",
      sessionDuration: sub.sessionDuration || "60 min",
      spotsAvailable: sub.spotsAvailable?.toString() || "",
      locationKind: sub.locationKind || "venue",
      bookingLink: sub.bookingLink || "",
      dayPreference: sub.dayPreference,
      preferredDays: sub.preferredDays,
      preferredWeek: sub.preferredWeek || 0,
      pitch: sub.pitch || "",
      teaserSuggestion: sub.teaserSuggestion || "",
    });
    setEditingSub(sub);
    setSelectedInv(null);
    setInvSearch("");
    setShowAdd(true);
  }

  function buildSubmission(now: boolean): Omit<RewardSubmission, "id"> {
    return {
      title: form.title, offeringType: form.offeringType, description: form.desc,
      retailValue: parseFloat(form.retailVal) || 0,
      cycle: selCycle,
      status: now ? "pending" : "draft",
      submittedDate: now ? format(new Date(), "yyyy-MM-dd") : null,
      assignedDate: null,
      requestedDate: form.preferredDays[0] || null,
      imageUrl: selectedInv?.imageUrl || null,
      adminNote: null,
      discountKind: form.pricingKind === "percentage" ? "percentage" : form.pricingKind === "fixed" ? "fixed" : null,
      discountValue: (form.pricingKind === "percentage" || form.pricingKind === "fixed") && form.discountValue ? parseFloat(form.discountValue) : null,
      usageLimit: null,
      conditions: null,
      quantity: ["product", "sample"].includes(form.offeringType) && form.quantity ? parseInt(form.quantity) : null,
      deliveryMethod: ["product", "sample"].includes(form.offeringType) ? form.deliveryMethod : null,
      sampleDescription: form.offeringType === "sample" ? form.sampleDescription || null : null,
      fullProductLink: form.offeringType === "sample" ? form.fullProductLink || null : null,
      sessionDuration: form.offeringType === "session" ? form.sessionDuration : null,
      spotsAvailable: form.offeringType === "session" && form.spotsAvailable ? parseInt(form.spotsAvailable) : null,
      locationKind: form.offeringType === "session" ? form.locationKind : null,
      bookingLink: form.offeringType === "session" ? form.bookingLink || null : null,
      preferredDays: form.preferredDays,
      dayPreference: form.dayPreference,
      preferredWeek: form.dayPreference === "week" ? form.preferredWeek : null,
      pitch: form.pitch || null,
      teaserSuggestion: form.teaserSuggestion || null,
    };
  }

  function submitReward(now = false) {
    if (!form.title || !form.retailVal || !form.pricingKind || form.preferredDays.length === 0) return;
    if (editingSub) {
      setSubs((p) => p.map((s) => s.id === editingSub.id ? { ...s, ...buildSubmission(now), id: s.id } : s));
      showToast(now ? "Application resubmitted!" : "Changes saved");
    } else {
      setSubs((p) => [{ ...buildSubmission(now), id: `rs-${Date.now()}` } as RewardSubmission, ...p]);
      showToast(now ? "Application submitted! You'll be notified when admin reviews it." : "Draft saved successfully");
    }
    setShowAdd(false);
    if (now) setActiveTab("applications");
  }

  function doSubmit(id: string) {
    setSubs((p) => p.map((s) => s.id === id ? { ...s, status: "pending" as SubmissionStatus, submittedDate: format(new Date(), "yyyy-MM-dd") } : s));
    showToast("Application submitted for review!");
  }
  function doWithdraw(id: string) {
    if (!confirm("Withdraw this application?")) return;
    setSubs((p) => p.filter((s) => s.id !== id));
    showToast("Application withdrawn");
    setShowDetail(false); setSelSub(null);
  }
  function doDuplicate(s: RewardSubmission) {
    setSubs((p) => [{ ...s, id: `rs-${Date.now()}`, title: `${s.title} (Copy)`, status: "draft" as SubmissionStatus, submittedDate: null, assignedDate: null, adminNote: null, claimsCount: undefined, participationRate: undefined }, ...p]);
    showToast("Duplicated as draft");
  }
  function viewCalendarSlot(sub: RewardSubmission) {
    const date = sub.assignedDate;
    if (!date) return;
    const d = new Date(date + "T00:00:00");
    setMonth(startOfMonth(d));
    setSelDate(d);
    setActiveTab("calendar");
    setShowDetail(false);
  }

  const selDateStr = selDate ? format(selDate, "yyyy-MM-dd") : null;
  const selDateSubs = selDateStr ? subsByDate.get(selDateStr) || [] : [];
  const selDateIns = selDateStr ? insights.get(selDateStr) : null;
  const alreadyApplied = selDateSubs.some((s) => s.status === "accepted" || s.status === "assigned" || s.status === "pending");
  const canAddToSelDate = selDate && !isXpDay(selDate) && !isBefore(startOfDay(selDate), startOfDay(new Date())) && selDateIns?.status !== "taken" && !alreadyApplied;

  const curCycle = CYCLES.find((c) => c.value === selCycle);

  return (
    <div className="relative min-h-full flex-1 overflow-auto">
      {/* Background image */}
      <div className="absolute top-0 left-0 right-0 h-[420px] overflow-hidden pointer-events-none">
        <img src="/images/rewards bg.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-[#F6F6FC]" />
      </div>

      {/* Content */}
      <div className="relative px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

      {/* ======== GLASS PANEL — hero + stats ======== */}
      <div className="rounded-3xl bg-white/[0.25] backdrop-blur-3xl border border-white/40 shadow-[0_22px_90px_rgba(124,58,237,0.35)] p-4 sm:p-6 xl:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1B1529] tracking-tight">Rewards Calendar</h1>
            {/* Cycle switcher */}
            <div className="relative">
              <button onClick={() => setShowCyclePicker((v) => !v)} className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-gray-50 transition-colors">
                <span className={clsx("h-2.5 w-2.5 rounded-full", curCycle?.status === "active" ? "bg-emerald-400" : "bg-amber-400")} />
                {curCycle?.label}
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>
              {showCyclePicker && (
                <div className="absolute left-0 top-full mt-1 z-50 rounded-xl bg-white border border-gray-200 shadow-xl p-2 min-w-[220px]">
                  {CYCLES.map((c) => (
                    <button key={c.value} onClick={() => { setSelCycle(c.value); setShowCyclePicker(false); }}
                      className={clsx("flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                        selCycle === c.value ? "bg-[#1B1529] text-white" : "text-gray-600 hover:bg-gray-100"
                      )}>
                      <span className={clsx("h-2.5 w-2.5 rounded-full", c.status === "active" ? "bg-emerald-400" : "bg-amber-400")} />
                      {c.label}
                      <span className={clsx("ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                        c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>{c.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => openAdd()} className="flex items-center gap-2 rounded-xl bg-[#1B1529] px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white hover:bg-[#2D1F5E] shadow-sm">
              <Plus className="h-5 w-5" /> <span className="hidden sm:inline">Apply to Contribute</span><span className="sm:hidden">Apply</span>
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-5">
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 sm:px-5 py-3 sm:py-4 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1B1529]"><CalendarCheck className="h-4 w-4 text-white" /></span>
            <div><p className="text-xs sm:text-sm text-gray-400 font-medium">Your Contributions</p><p className="text-xl sm:text-2xl font-bold text-[#1B1529]">{stats.assigned} <span className="text-sm font-normal text-gray-400">slots</span></p></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 sm:px-5 py-3 sm:py-4 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1B1529]"><TrendingUp className="h-4 w-4 text-white" /></span>
            <div><p className="text-xs sm:text-sm text-gray-400 font-medium">Total Value Contributed</p><p className="text-xl sm:text-2xl font-bold text-[#1B1529]">{fmt$(stats.totalVal)}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 sm:px-5 py-3 sm:py-4 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1B1529]"><AlertCircle className="h-4 w-4 text-white" /></span>
            <div><p className="text-xs sm:text-sm text-gray-400 font-medium">Pending Applications</p><p className="text-xl sm:text-2xl font-bold text-[#1B1529]">{stats.pending}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 sm:px-5 py-3 sm:py-4 shadow-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1B1529]"><BarChart3 className="h-4 w-4 text-white" /></span>
            <div><p className="text-xs sm:text-sm text-gray-400 font-medium">Avg Participation Rate</p><p className="text-xl sm:text-2xl font-bold text-[#1B1529]">{stats.avgParticipation}%</p></div>
          </div>
        </div>

      </div>{/* close glass panel */}

      {/* ======== TABS + CONTENT CARD ======== */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Tab bar */}
        <div className="shrink-0 border-b border-gray-100 px-4 sm:px-6 py-3">
          <div className="flex items-center rounded-full border border-gray-200/80 bg-gray-50 p-1 gap-1">
            {([
              { key: "calendar" as ActiveTab, label: "Calendar", icon: CalendarDays, badge: null },
              { key: "live" as ActiveTab, label: "Live Rewards", icon: Sparkles, badge: stats.assigned > 0 ? String(stats.assigned) : null },
              { key: "applications" as ActiveTab, label: "My Applications", icon: ListFilter, badge: String(subs.length) },
            ]).map((t) => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={clsx(
                  "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all whitespace-nowrap",
                  activeTab === t.key ? "bg-[#1B1529] text-white shadow-sm" : "text-gray-400 hover:text-gray-600"
                )}>
                <t.icon className="h-4 w-4 shrink-0" />
                {t.label}
                {t.badge && <span className={clsx("inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                  activeTab === t.key ? "bg-white/20 text-white" : t.key === "live" ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-500"
                )}>{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ======== CALENDAR TAB ======== */}
        {activeTab === "calendar" && (
          <div className="flex flex-1 flex-col overflow-auto no-scrollbar">
            {/* Weekday headers */}
              <div className="sticky top-0 z-40 grid border-b border-gray-100 bg-white rounded-t-2xl" style={{ gridTemplateColumns: "0.45fr 0.45fr 1fr 1fr 1fr 1fr 1fr" }}>
                {WEEKDAYS.map((d, i) => (
                  <div key={d} className={clsx("py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold uppercase tracking-wider",
                    (i === 0 || i === 1) ? "text-[#1B1529]" : i === 5 ? "text-amber-500" : i === 6 ? "text-purple-500" : "text-gray-400"
                  )}>
                    {d}
                    {(i === 0 || i === 1) && <Zap className="ml-0.5 mb-px inline h-3 sm:h-3.5 w-3 sm:w-3.5 text-[#1B1529]" />}
                    {i === 5 && <Star className="ml-0.5 mb-px inline h-3 sm:h-3.5 w-3 sm:w-3.5 text-amber-400" fill="currentColor" />}
                    {i === 6 && <Image src="/images/glass_crown_transparent.png" alt="" width={16} height={16} className="ml-0.5 mb-px inline" />}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid flex-1 gap-y-2 sm:gap-y-3" style={{ gridTemplateColumns: "0.45fr 0.45fr 1fr 1fr 1fr 1fr 1fr", gridAutoRows: "minmax(220px, 1fr)" }}>
                {days.map((day, i) => {
                  const inM = isSameMonth(day, month);
                  const today = isToday(day);
                  const xp = isXpDay(day);
                  const sunday = isSunday(day);
                  const ds = format(day, "yyyy-MM-dd");
                  const daySubs = subsByDate.get(ds) || [];
                  const selected = selDate && isSameDay(day, selDate);
                  const past = isBefore(startOfDay(day), startOfDay(new Date()));
                  const canAdd = inM && !xp && !past;
                  const dayIns = insights.get(ds);
                  const myAssigned = daySubs.find((s) => s.status === "assigned" || s.status === "accepted");
                  const takenByOther = !myAssigned && dayIns && dayIns.applicants >= dayIns.slots && dayIns.slots > 0;
                  const hotBids = dayIns && dayIns.applicants >= 4 && !takenByOther && !myAssigned;
                  const pendingSub = daySubs.find((s) => s.status === "pending");
                  const revisionSub = daySubs.find((s) => s.status === "revision_requested");
                  const rejectedSub = daySubs.find((s) => s.status === "rejected");
                  const primarySub = myAssigned || pendingSub || revisionSub || rejectedSub || daySubs[0];
                  const isRejected = primarySub && primarySub.status === "rejected";
                  const hasImage = primarySub && primarySub.imageUrl && inM && !xp && !isRejected;

                  return (
                    <div key={i} onClick={() => {
                      if (!inM) return;
                      if (takenByOther) return;
                      if (xp) return;
                      clickDate(day);
                    }}
                      className={clsx(
                        "group relative flex flex-col m-0.5 sm:m-1 rounded-lg sm:rounded-xl border border-gray-200 transition-all",
                        !inM && "opacity-20",
                        inM && takenByOther && "bg-gray-50 cursor-default",
                        isRejected && "!bg-red-50/80",
                        inM && xp && !takenByOther && "bg-purple-50/60",
                        selected && !takenByOther && "ring-2 ring-purple-200",
                        canAdd && !selected && !takenByOther && "cursor-pointer hover:shadow-md",
                        inM && !xp && past && !takenByOther && "cursor-pointer opacity-70",
                        inM && xp && "cursor-default",
                      )}>

                      {/* Sunday crown */}
                      {sunday && inM && (
                        <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 z-30">
                          <Image src="/images/glass_crown_transparent.png" alt="Streak" width={24} height={24} className="drop-shadow-lg sm:w-[30px] sm:h-[30px]" />
                        </div>
                      )}

                      {/* ── REJECTED CELL ── */}
                      {isRejected && primarySub ? (
                        <>
                          <div className="relative z-10 flex items-start justify-between w-full p-1.5 sm:p-2">
                            <span className={clsx(
                              "flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-xs sm:text-sm font-bold",
                              today ? "bg-purple-600 text-white" : "text-red-400"
                            )}>{day.getDate()}</span>
                          </div>
                          <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-2">
                            <span className="text-sm sm:text-base font-semibold text-red-300">Rejected</span>
                            <span className="text-[10px] sm:text-xs text-red-300/70 mt-0.5 line-clamp-1">{primarySub.title}</span>
                          </div>
                        </>

                      ) : hasImage ? (
                        /* ── PRODUCT CARD CELL ── */
                        <>
                          {/* Image area */}
                          <div className="relative w-full flex-1 min-h-[150px] overflow-hidden rounded-t-lg sm:rounded-t-xl">
                            <img src={primarySub!.imageUrl!} alt={primarySub!.title} className="absolute inset-0 w-full h-full object-cover" />
                            {/* Date number on image */}
                            <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-10">
                              <span className={clsx(
                                "flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-xs sm:text-sm font-bold bg-white/90 text-gray-900 shadow-sm",
                                today && "!bg-purple-600 !text-white"
                              )}>{day.getDate()}</span>
                            </div>
                            {/* Discount badge on image */}
                            {discountBadgeText(primarySub!) && (
                              <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 z-10">
                                <span className="inline-flex items-center rounded-lg bg-red-500 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-bold text-white uppercase tracking-wide shadow-md">
                                  {discountBadgeText(primarySub!)}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Info area — white bottom */}
                          <div className="shrink-0 bg-white px-2 sm:px-2.5 py-1.5 sm:py-2">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-gray-600">{primarySub!.offeringType === "session" ? "Session" : "Product"}</span>
                              <span className={clsx(
                                "inline-flex rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-semibold",
                                (primarySub!.status === "assigned" || primarySub!.status === "accepted")
                                  ? "bg-emerald-50 text-emerald-700"
                                  : primarySub!.status === "pending"
                                  ? "bg-gray-700 text-gray-100"
                                  : primarySub!.status === "revision_requested"
                                  ? "bg-orange-50 text-orange-700"
                                  : "bg-gray-100 text-gray-600"
                              )}>
                                {(primarySub!.status === "assigned" || primarySub!.status === "accepted")
                                  ? "Live"
                                  : primarySub!.status === "revision_requested"
                                  ? "Revise"
                                  : primarySub!.status === "pending"
                                  ? "Pending"
                                  : primarySub!.status}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-[1.2] line-clamp-2">{primarySub!.title}</p>
                            <p className="text-xs sm:text-sm font-bold text-gray-900 mt-1">{fmt$(primarySub!.retailValue)} {primarySub!.discountKind && <span className="text-[10px] sm:text-xs font-normal text-gray-400 line-through ml-1">{fmt$(primarySub!.retailValue * 1.25)}</span>}</p>
                          </div>
                        </>
                      ) : (
                        /* ── EMPTY / XP / FILLED CELL ── */
                        <>
                          <div className="relative z-10 flex items-start justify-between w-full p-1.5 sm:p-2">
                            <span className={clsx(
                              "flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-xs sm:text-sm font-bold",
                              today ? "bg-purple-600 text-white" :
                              inM && takenByOther ? "text-gray-400" :
                              inM ? "text-gray-900" : "text-gray-300"
                            )}>{day.getDate()}</span>

                            {primarySub && inM && !xp && !isRejected && (
                              <span className={clsx(
                                "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-semibold",
                                (primarySub.status === "assigned" || primarySub.status === "accepted")
                                  ? "bg-emerald-50 text-emerald-700"
                                  : primarySub.status === "pending"
                                  ? "bg-gray-700 text-gray-100"
                                  : primarySub.status === "revision_requested"
                                  ? "bg-orange-50 text-orange-700"
                                  : "bg-gray-100 text-gray-600"
                              )}>
                                {(primarySub.status === "assigned" || primarySub.status === "accepted")
                                  ? "Live"
                                  : primarySub.status === "revision_requested"
                                  ? "Revise"
                                  : primarySub.status === "pending"
                                  ? "Pending"
                                  : primarySub.status}
                              </span>
                            )}
                          </div>

                          <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-1.5 sm:p-2">
                            {takenByOther && daySubs.length === 0 && inM && !xp && (
                              <div className="flex flex-col items-center gap-1.5">
                                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gray-300">
                                  <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                                </div>
                                <span className="text-[10px] sm:text-xs font-semibold text-gray-400">Filled</span>
                              </div>
                            )}

                            {canAdd && daySubs.length === 0 && !takenByOther && (
                              <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-[#1B1529] text-white shadow-md transition-transform group-hover:scale-110">
                                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                              </span>
                            )}

                            {xp && inM && (
                              <div className="rounded-full bg-gradient-to-r from-purple-500 via-pink-400 to-purple-400 p-[2px]">
                                <div className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-[#1B1529] pl-1 sm:pl-1.5 pr-2 sm:pr-2.5 py-1">
                                  <Image src="/images/xp-badge.png" alt="XP" width={14} height={14} className="shrink-0" />
                                  <span className="text-[10px] sm:text-xs font-bold text-white tracking-wide">+20 XP</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
          </div>
        )}

        {/* ======== LIVE REWARDS TAB ======== */}
        {activeTab === "live" && (
          <div className="flex flex-1 flex-col overflow-auto no-scrollbar p-4">
          {(() => {
            const acceptedSubs = subs.filter((s) => s.status === "assigned" || s.status === "accepted");
            if (acceptedSubs.length === 0) return (
              <div className="flex flex-1 flex-col items-center justify-center py-16">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gray-100 mb-4"><Sparkles className="h-7 w-7 text-gray-300" /></div>
                <p className="text-sm font-medium text-gray-500">You haven&apos;t contributed to this cycle yet.</p>
                <p className="mt-1 text-xs text-gray-400">Your products and services can reach hundreds of MEURAKI users!</p>
                <button onClick={() => openAdd()} className="mt-4 flex items-center gap-2 rounded-xl bg-[#1B1529] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2D1F5E]">
                  <Plus className="h-4 w-4" /> Apply to Contribute
                </button>
              </div>
            );
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {acceptedSubs.sort((a, b) => (a.assignedDate || a.requestedDate || "").localeCompare(b.assignedDate || b.requestedDate || "")).map((sub) => {
                  const dateStr = sub.assignedDate || sub.requestedDate;
                  const d = dateStr ? new Date(dateStr + "T00:00:00") : null;
                  const typeOpt = OFFERING_TYPES.find((t) => t.value === sub.offeringType);
                  const badge = discountBadgeText(sub);
                  return (
                    <div key={sub.id} onClick={() => { setSelSub(sub); setShowDetail(true); }}
                      className="group rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-lg transition-all flex flex-col">
                      {/* Image with overlays */}
                      <div className="relative h-40 w-full bg-gray-100 overflow-hidden">
                        {sub.imageUrl ? (
                          <Image src={sub.imageUrl} alt={sub.title} fill className="object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center"><Gift className="h-8 w-8 text-gray-300" /></div>
                        )}
                        {/* Live badge */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1 shadow-md">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          <span className="text-[9px] font-bold text-white uppercase tracking-wide">Live</span>
                        </div>
                        {/* Discount badge */}
                        {badge && (
                          <div className="absolute bottom-3 left-3">
                            <span className="inline-flex items-center rounded-lg bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wide shadow-md">{badge}</span>
                          </div>
                        )}
                        {/* Date chip */}
                        <div className="absolute top-3 right-3">
                          <div className="flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-white/95 shadow-sm backdrop-blur-sm">
                            <span className="text-sm font-extrabold text-gray-900 leading-none">{d ? format(d, "d") : "—"}</span>
                            <span className="text-[7px] font-semibold text-gray-400 uppercase">{d ? format(d, "MMM") : ""}</span>
                          </div>
                        </div>
                      </div>
                      {/* Content */}
                      <div className="flex flex-col flex-1 p-4">
                        <p className="text-[10px] text-gray-400 mb-0.5">{typeOpt?.label}</p>
                        <p className="text-[14px] font-bold text-gray-900 leading-snug line-clamp-2 mb-1">{sub.title}</p>
                        {sub.claimsCount != null && (
                          <p className="text-[11px] text-emerald-600 font-medium mb-2.5">
                            <CheckCircle2 className="inline h-3 w-3 mr-0.5" />{sub.claimsCount} users claimed
                          </p>
                        )}
                        <div className="mt-auto flex items-baseline gap-1.5">
                          <span className="text-[10px] text-gray-400">Value</span>
                          <span className="text-base font-bold text-gray-900">{fmt$(sub.retailValue)}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 capitalize">{sub.offeringType}</span>
                          {sub.participationRate != null && (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">{sub.participationRate}% claimed</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          </div>
        )}

        {/* ======== MY APPLICATIONS TAB ======== */}
        {activeTab === "applications" && (
          <div className="flex flex-1 flex-col overflow-hidden px-4 pb-4">
          <div className="shrink-0 flex flex-wrap items-center gap-3 py-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" value={appSearch} onChange={(e) => setAppSearch(e.target.value)} placeholder="Search submissions..."
                className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100" />
            </div>
            {/* Cycle filter */}
            <select value={appCycleFilter} onChange={(e) => setAppCycleFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-600 outline-none">
              <option value="all">All Cycles</option>
              {CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(["all", "draft", "pending", "accepted", "assigned", "revision_requested", "rejected"] as ApplicationFilter[]).map((f) => (
                <button key={f} onClick={() => setAppFilter(f)}
                  className={clsx("shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all",
                    appFilter === f ? "bg-[#1B1529] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  )}>
                  {f === "all" ? "All" : STATUS_LABELS[f]}
                  <span className="ml-1 opacity-60">{filterCounts[f] || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto no-scrollbar rounded-2xl border border-gray-200 bg-white">
            {filteredApps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gray-100 mb-4"><FileText className="h-7 w-7 text-gray-300" /></div>
                <p className="text-sm font-medium text-gray-500">
                  {subs.length === 0 ? "You haven't applied to any reward calendar yet." : "No submissions match your filters"}
                </p>
                <p className="mt-1 text-xs text-gray-400 max-w-xs text-center">Your products and services can reach hundreds of MEURAKI users!</p>
                <button onClick={() => openAdd()} className="mt-4 flex items-center gap-2 rounded-xl bg-[#1B1529] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2D1F5E]">
                  <Plus className="h-4 w-4" /> Apply to Contribute
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-[#F6F5FF] text-[11px] font-semibold text-gray-500 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-left">Offering</th>
                      <th className="px-3 py-3 text-left">Type</th>
                      <th className="px-3 py-3 text-left">Value</th>
                      <th className="px-3 py-3 text-left">Qty / Spots</th>
                      <th className="px-3 py-3 text-left">Preferred</th>
                      <th className="px-3 py-3 text-left">Cycle</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-3 py-3 text-left">Assigned</th>
                      <th className="px-3 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApps.map((sub, idx) => {
                      const typeOpt = OFFERING_TYPES.find((t) => t.value === sub.offeringType);
                      const TypeIcon = typeOpt?.icon || Gift;
                      const cycleLbl = CYCLES.find((c) => c.value === sub.cycle)?.label || sub.cycle;
                      const qtyLabel = sub.offeringType === "session" ? sub.spotsAvailable : sub.quantity;
                      const prefLabel = sub.dayPreference === "any" ? "Any day" :
                        sub.dayPreference === "sundays" ? "Sundays only" :
                        sub.dayPreference === "week" ? `Week ${(sub.preferredWeek || 0) + 1}` :
                        sub.preferredDays.length > 0 ? sub.preferredDays.map((d) => format(new Date(d + "T00:00:00"), "d MMM")).join(", ") : "—";
                      return (
                        <tr key={sub.id} className={clsx("border-t border-gray-100 transition-colors hover:bg-gray-50/60", idx % 2 === 1 && "bg-[#FBFBFE]")}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {sub.imageUrl ? (
                                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-gray-100"><Image src={sub.imageUrl} alt={sub.title} fill className="object-cover" /></div>
                              ) : (
                                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gray-100"><Gift className="h-4 w-4 text-gray-400" /></div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-900 truncate max-w-[180px]">{sub.title}</p>
                                <p className="text-[10px] text-gray-400 truncate max-w-[180px]">{sub.description || "—"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                              <TypeIcon className="h-3 w-3 text-gray-400" />{typeOpt?.label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs font-semibold text-gray-900">{fmt$(sub.retailValue)}</td>
                          <td className="px-3 py-3 text-xs text-gray-600">{qtyLabel || "—"}</td>
                          <td className="px-3 py-3 text-[11px] text-gray-500">{prefLabel}</td>
                          <td className="px-3 py-3 text-[11px] text-gray-500">{cycleLbl}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", STATUS_PILL[sub.status])}>
                              {STATUS_LABELS[sub.status]}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-[11px] text-gray-500">
                            {sub.assignedDate ? <span className="font-medium text-emerald-600">{format(new Date(sub.assignedDate + "T00:00:00"), "d MMM")}</span> : "—"}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button onClick={() => { setSelSub(sub); setShowDetail(true); }} className="rounded-full bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200" title="View"><Eye className="h-3 w-3" /></button>
                              {(sub.status === "pending" || sub.status === "draft") && (
                                <button onClick={() => openEdit(sub)} className="rounded-full bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200" title="Edit"><Pencil className="h-3 w-3" /></button>
                              )}
                              {(sub.status === "rejected" || sub.status === "revision_requested") && (
                                <button onClick={() => openEdit(sub)} className="rounded-full bg-amber-100 p-1.5 text-amber-600 hover:bg-amber-200" title="Edit & Resubmit"><RotateCcw className="h-3 w-3" /></button>
                              )}
                              {sub.status === "draft" && (
                                <button onClick={() => doSubmit(sub.id)} className="rounded-full bg-[#1B1529] p-1.5 text-white hover:bg-[#2D1F5E]" title="Submit"><Send className="h-3 w-3" /></button>
                              )}
                              {sub.status === "pending" && (
                                <button onClick={() => doWithdraw(sub.id)} className="rounded-full bg-gray-100 p-1.5 text-gray-500 hover:bg-gray-200" title="Withdraw"><XCircle className="h-3 w-3" /></button>
                              )}
                              {sub.status === "assigned" && (
                                <button onClick={() => viewCalendarSlot(sub)} className="rounded-full bg-purple-100 p-1.5 text-purple-600 hover:bg-purple-200" title="View Calendar Slot"><ArrowUpRight className="h-3 w-3" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="shrink-0 flex items-center justify-between py-3 text-[11px] text-gray-400">
            <span>Showing {filteredApps.length} of {subs.length} submissions</span>
            <span>Total value: {fmt$(subs.reduce((sum, s) => sum + s.retailValue, 0))}</span>
          </div>
          </div>
        )}
      </div>{/* close tabs card */}

      {/* ======== DAY DETAIL POPUP ======== */}
      {selDate && createPortal(
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/25 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) setSelDate(null); }}>
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-gray-900">{format(selDate, "EEEE")}</p>
                  {isSunday(selDate) && (
                    <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-600">
                      <Image src="/images/glass_crown_transparent.png" alt="" width={12} height={12} /> Streak
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{format(selDate, "MMMM d, yyyy")}</p>
              </div>
              <button onClick={() => setSelDate(null)} className="text-gray-400 hover:text-gray-600"><XCircle className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-auto no-scrollbar px-5 pb-5">
              {selDateSubs.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    const discounts = selDateSubs.filter(s => s.offeringType === "discount");
                    const others = selDateSubs.filter(s => s.offeringType !== "discount");
                    return (
                      <>
                        {discounts.length > 0 && (
                          <>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Discounts <span className="ml-1 text-gray-300">{discounts.length}</span></p>
                            {discounts.map((sub) => (
                              <SidebarProductCard key={sub.id} sub={sub} onView={() => { setSelSub(sub); setShowDetail(true); }} />
                            ))}
                          </>
                        )}
                        {others.length > 0 && (
                          <>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Products <span className="ml-1 text-gray-300">{others.length}</span></p>
                            {others.map((sub) => (
                              <SidebarProductCard key={sub.id} sub={sub} onView={() => { setSelSub(sub); setShowDetail(true); }} />
                            ))}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-gray-100 mb-3"><Image src="/images/gift-box.png" alt="Gift" width={28} height={28} className="opacity-40" /></div>
                  <p className="text-sm font-medium text-gray-500">No bids yet</p>
                  <p className="mt-1 text-xs text-gray-400 leading-relaxed">Apply to contribute a reward<br/>for this day&apos;s spot</p>
                </div>
              )}
              {selDateIns && selDateSubs.length === 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Bidding Overview</p>
                  <div className="grid grid-cols-2 gap-2">
                    <InsightCard icon={<Users className="h-4 w-4 text-purple-400" />} label="Bids" value={String(selDateIns.applicants)} sub={`of ${selDateIns.slots} spots`} tooltip="Number of vendors who have applied to contribute a reward for this day, out of available spots." />
                    <InsightCard icon={<BarChart3 className="h-4 w-4 text-purple-400" />} label="Avg Bid Value" value={fmt$(selDateIns.avgOfferValue)} sub="from vendors" tooltip="Average retail value of rewards offered by vendors — the listed price of the product, session, or voucher. For free items, this is their market value. Not a cash bid." />
                    <InsightCard icon={<TrendingUp className="h-4 w-4 text-purple-400" />} label="Est. Reach" value={selDateIns.estimatedReach.toLocaleString()} sub="employees" tooltip="Estimated number of employees across active corporate subscriptions who will see this reward in their app." />
                    <InsightCard icon={<Trophy className="h-4 w-4 text-purple-400" />} label="Est. Claims" value={String(selDateIns.estimatedRedemptions)} sub={`${selDateIns.conversionRate}% rate`} tooltip="Estimated number of employees likely to claim this reward, based on historical redemption rates for similar offerings." />
                  </div>
                  {selDateIns.status === "last_spot" && <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200/60 px-3 py-2 text-center"><p className="text-[11px] font-semibold text-amber-600">Last spot — submit a strong offer!</p></div>}
                  {selDateIns.status === "taken" && <div className="mt-2 rounded-lg bg-gray-100 px-3 py-2 text-center"><p className="text-[11px] font-medium text-gray-500">All spots filled for this day</p></div>}
                  {selDateIns.status === "open" && selDateIns.applicants === 0 && <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200/60 px-3 py-2 text-center"><p className="text-[11px] font-semibold text-emerald-600">No bids yet — great opportunity!</p></div>}
                </div>
              )}
              {canAddToSelDate && (
                <button onClick={() => openAdd(isSunday(selDate!))} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B1529] py-3 text-sm font-medium text-white hover:bg-[#2D1F5E]">
                  <Plus className="h-4 w-4" /> Apply to Contribute
                </button>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* ======== APPLICATION SIDE PANEL ======== */}
      {showAdd && createPortal(
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/20 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="h-full w-full max-w-[520px] overflow-hidden bg-white shadow-2xl flex flex-col">
            <div className="shrink-0 flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editingSub ? "Edit Application" : "Apply to Contribute"}</h2>
                {selDate && <p className="text-sm text-gray-400 mt-0.5">{format(selDate, "EEEE, MMMM d, yyyy")}</p>}
              </div>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="h-6 w-6" /></button>
            </div>

            <div className="flex-1 overflow-auto no-scrollbar">
              {(() => {
                const step1Done = !!form.offeringType;
                const needsVariant = (selectedInv?.variants?.length || 0) > 0;
                const needsSessionFormat = (selectedInv?.serviceTypes?.length || 0) > 1;
                const needsSessionLocation = (selectedInv?.locationTypes?.length || 0) > 1;
                const step2Done = selectedInv !== null
                  && (!needsVariant || !!form.selectedVariantId)
                  && (!needsSessionFormat || !!form.sessionFormat)
                  && (!needsSessionLocation || !!form.sessionLocation);
                const step3Done = form.pricingKind === "free" || (!!(form.pricingKind) && !!form.discountValue);
                return (
                  <div className="bg-gray-50 min-h-full px-5 py-5 space-y-3">

                    {/* ── Step 1: Type ── */}
                    <div className={clsx("rounded-2xl bg-white border overflow-hidden", step1Done ? "border-purple-200" : "border-gray-200")}>
                      <div className="flex items-center gap-3 px-5 py-4">
                        <div className={clsx("h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0", step1Done ? "bg-purple-600 text-white" : "bg-[#1B1529] text-white")}>
                          {step1Done ? <Check className="h-3.5 w-3.5" /> : "1"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Step 1</p>
                          <p className={clsx("text-sm font-semibold", step1Done ? "text-gray-500" : "text-gray-900")}>
                            {step1Done ? OFFERING_TYPES.find(t => t.value === form.offeringType)?.label : "What are you contributing?"}
                          </p>
                        </div>
                        {step1Done && (
                          <button onClick={() => { setForm(f => ({ ...f, offeringType: "" as OfferingType, pricingKind: "" })); setSelectedInv(null); setInvSearch(""); }}
                            className="shrink-0 text-xs text-purple-500 hover:text-purple-700 font-medium">Change</button>
                        )}
                      </div>
                      {!step1Done && (
                        <div className="px-5 pb-5 space-y-2">
                          {OFFERING_TYPES.map((t) => {
                            const I = t.icon;
                            return (
                              <button key={t.value} onClick={() => { setForm(f => ({ ...f, offeringType: t.value })); setSelectedInv(null); setInvSearch(""); }}
                                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3.5 text-left hover:border-purple-300 hover:bg-purple-50 transition-all">
                                <I className="h-5 w-5 shrink-0 text-gray-400" />
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">{t.label}</p>
                                  <p className="text-xs text-gray-400">{t.desc}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* ── Step 2: Select item ── */}
                    <div className={clsx("rounded-2xl border overflow-hidden transition-all",
                      !step1Done ? "bg-gray-50/60 border-gray-100" : step2Done ? "bg-white border-purple-200" : "bg-white border-gray-200"
                    )}>
                      <div className="flex items-center gap-3 px-5 py-4">
                        <div className={clsx("h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          !step1Done ? "bg-gray-200 text-gray-400" : step2Done ? "bg-purple-600 text-white" : "bg-[#1B1529] text-white"
                        )}>
                          {!step1Done ? <Lock className="h-3 w-3" /> : step2Done ? <Check className="h-3.5 w-3.5" /> : "2"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={clsx("text-[10px] font-semibold uppercase tracking-wider", !step1Done ? "text-gray-300" : "text-gray-400")}>Step 2</p>
                          <p className={clsx("text-sm font-semibold truncate", !step1Done ? "text-gray-300" : step2Done ? "text-gray-500" : "text-gray-900")}>
                            {selectedInv ? selectedInv.name : "Select from your catalog"}
                          </p>
                        </div>
                        {step2Done && (
                          <button onClick={() => { setSelectedInv(null); setInvSearch(""); setForm(f => ({ ...f, title: "", retailVal: "", pricingKind: "", discountValue: "", sessionFormat: "", sessionLocation: "", selectedVariantId: "" })); }}
                            className="shrink-0 text-xs text-purple-500 hover:text-purple-700 font-medium">Change</button>
                        )}
                      </div>
                      {/* Catalog picker — shown when no item selected yet */}
                      {step1Done && selectedInv === null && (
                        <div className="px-5 pb-5">
                          <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input type="text" value={invSearch} onChange={(e) => setInvSearch(e.target.value)}
                              placeholder={`Search your ${form.offeringType}s…`}
                              className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100" />
                          </div>
                          {filteredInventory.length > 0 && (
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                {invSearch ? `${filteredInventory.length} results` : `Top ${Math.min(5, filteredInventory.length)} from your catalog`}
                              </p>
                              {!invSearch && filteredInventory.length > 5 && (
                                <p className="text-[11px] text-gray-400">{filteredInventory.length} total · search to filter</p>
                              )}
                            </div>
                          )}
                          <div className="space-y-1.5">
                            {filteredInventory.length > 0 ? (invSearch ? filteredInventory : filteredInventory.slice(0, 5)).map((item) => (
                              <button key={item.id} onClick={() => selectInventoryItem(item)}
                                className="flex w-full items-center justify-between rounded-xl border border-gray-100 px-4 py-3 text-left hover:border-purple-200 hover:bg-purple-50 transition-all">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                                  <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
                                    <p className="text-xs text-gray-400">Listed at <span className="font-medium text-gray-600">${item.price}</span></p>
                                    {item.sku && <span className="text-[10px] text-gray-400">{item.sku}</span>}
                                    {(item.variantCount || 0) > 0 && <span className="text-[10px] text-gray-400">{item.variantCount} variations</span>}
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-300 shrink-0 ml-3" />
                              </button>
                            )) : (
                              <p className="px-2 py-3 text-sm text-gray-400">No {form.offeringType}s found in your catalog</p>
                            )}
                            {!invSearch && filteredInventory.length > 5 && (
                              <p className="text-center text-xs text-purple-500 py-2 font-medium">Use search to find more ({filteredInventory.length - 5} more items)</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Sub-pickers — shown after item selected but before step2Done */}
                      {step1Done && selectedInv !== null && !step2Done && (
                        <div className="px-5 pb-5 space-y-4">
                          {/* Back to catalog */}
                          <button onClick={() => { setSelectedInv(null); setInvSearch(""); setForm(f => ({ ...f, title: "", retailVal: "", pricingKind: "", discountValue: "", sessionFormat: "", sessionLocation: "", selectedVariantId: "" })); }}
                            className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700 font-medium -mt-1">
                            <ChevronLeft className="h-3 w-3" /> Back to catalog
                          </button>

                          {/* SKU + variant count */}
                          {selectedInv.sku && (
                            <p className="text-[11px] text-gray-400">
                              SKU: <span className="font-medium text-gray-600">{selectedInv.sku}</span>
                              {(selectedInv.variantCount || 0) > 0 && <span> · {selectedInv.variantCount} variations</span>}
                            </p>
                          )}

                          {/* Session format picker */}
                          {needsSessionFormat && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-2">Session Format</p>
                              <div className="flex gap-2">
                                {selectedInv.serviceTypes!.map(st => (
                                  <button key={st} onClick={() => setForm(f => ({ ...f, sessionFormat: st }))}
                                    className={clsx("flex-1 rounded-xl border py-3 text-sm font-semibold transition-all",
                                      form.sessionFormat === st ? "border-purple-300 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                                    )}>
                                    {st === "1-on-1" ? "1-on-1" : "Group"}
                                    {st === "group" && selectedInv.maxParticipants && (
                                      <span className="block text-[10px] font-normal text-gray-400 mt-0.5">up to {selectedInv.maxParticipants} people</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Session location picker */}
                          {needsSessionLocation && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-2">Location</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedInv.locationTypes!.map(lt => (
                                  <button key={lt} onClick={() => setForm(f => ({ ...f, sessionLocation: lt }))}
                                    className={clsx("flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all",
                                      form.sessionLocation === lt ? "border-purple-300 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                                    )}>
                                    {lt === "online" && <Globe className="h-3.5 w-3.5" />}
                                    {lt === "venue" && <MapPin className="h-3.5 w-3.5" />}
                                    {lt === "at_home" && <Home className="h-3.5 w-3.5" />}
                                    {lt === "online" ? "Online" : lt === "venue" ? "At venue" : "At home"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* No-expiry note for sessions */}
                          {selectedInv.type === "session" && (
                            <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5">
                              <p className="text-[11px] font-semibold text-blue-600 mb-0.5">No expiry</p>
                              <p className="text-[10px] text-blue-500 leading-relaxed">Sessions on the rewards calendar have no expiry — members can book any time after claiming.</p>
                            </div>
                          )}

                          {/* Product variant picker */}
                          {needsVariant && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-2">Select Variation</p>
                              <div className="space-y-1.5">
                                {selectedInv.variants!.map(v => (
                                  <button key={v.id} onClick={() => setForm(f => ({ ...f, selectedVariantId: v.id }))}
                                    className={clsx("flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                                      form.selectedVariantId === v.id ? "border-purple-300 bg-purple-50" : "border-gray-200 hover:border-gray-300"
                                    )}>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">{v.label}</p>
                                      <p className="text-[10px] text-gray-400 mt-0.5">SKU: {v.sku} · {v.stock} in stock</p>
                                    </div>
                                    <p className="text-sm font-bold text-gray-900 shrink-0">${v.price}</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── Step 3: Free or Discount ── */}
                    <div className={clsx("rounded-2xl border overflow-hidden transition-all",
                      !step2Done ? "bg-gray-50/60 border-gray-100" : step3Done ? "bg-white border-purple-200" : "bg-white border-gray-200"
                    )}>
                      <div className="flex items-center gap-3 px-5 py-4">
                        <div className={clsx("h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          !step2Done ? "bg-gray-200 text-gray-400" : step3Done ? "bg-purple-600 text-white" : "bg-[#1B1529] text-white"
                        )}>
                          {!step2Done ? <Lock className="h-3 w-3" /> : step3Done ? <Check className="h-3.5 w-3.5" /> : "3"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={clsx("text-[10px] font-semibold uppercase tracking-wider", !step2Done ? "text-gray-300" : "text-gray-400")}>Step 3</p>
                          <p className={clsx("text-sm font-semibold", !step2Done ? "text-gray-300" : step3Done ? "text-gray-500" : "text-gray-900")}>
                            {step3Done
                              ? form.pricingKind === "free" ? "Free" : form.pricingKind === "percentage" ? `${form.discountValue}% off` : `$${form.discountValue} off`
                              : "Free or discount?"}
                          </p>
                        </div>
                        {step3Done && (
                          <button onClick={() => setForm(f => ({ ...f, pricingKind: "", discountValue: "" }))}
                            className="shrink-0 text-xs text-purple-500 hover:text-purple-700 font-medium">Change</button>
                        )}
                      </div>
                      {step2Done && !step3Done && (
                        <div className="px-5 pb-5 space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            {(["free", "percentage", "fixed"] as const).map((k) => {
                              const active = form.pricingKind === k;
                              return (
                                <button key={k} onClick={() => setForm(f => ({ ...f, pricingKind: k, discountValue: k === "free" ? "" : f.discountValue }))}
                                  className={clsx("flex flex-col items-center gap-2 rounded-xl border px-3 py-3.5 transition-all",
                                    active ? "border-purple-300 bg-purple-50" : k === "free" ? "border-gray-900 hover:border-black" : "border-gray-200 hover:border-gray-300"
                                  )}>
                                  <span className={clsx("flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white",
                                    k === "free" ? "bg-emerald-500" : "bg-red-500"
                                  )}>
                                    {k === "free" ? "✓" : k === "percentage" ? "%" : "$"}
                                  </span>
                                  <span className={clsx("text-xs font-semibold", active ? "text-purple-700" : "text-gray-600")}>
                                    {k === "free" ? "Free" : k === "percentage" ? "% Off" : "$ Off"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          {(form.pricingKind === "percentage" || form.pricingKind === "fixed") && (
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-gray-500">
                                {form.pricingKind === "percentage" ? "Discount percentage" : "Amount off ($)"}
                              </label>
                              <input type="number" value={form.discountValue}
                                onChange={(e) => setForm(f => ({ ...f, discountValue: e.target.value }))}
                                placeholder={form.pricingKind === "percentage" ? "e.g. 20" : "e.g. 15"}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100" />
                            </div>
                          )}
                          {form.pricingKind === "free" && (
                            <p className="text-xs text-gray-400">This item will be offered for free to eligible employees.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── Step 4: Date ── */}
                    <div className={clsx("rounded-2xl border overflow-hidden transition-all",
                      !step3Done ? "bg-gray-50/60 border-gray-100" : "bg-white border-gray-200"
                    )}>
                      <div className="flex items-center gap-3 px-5 py-4">
                        <div className={clsx("h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          !step3Done ? "bg-gray-200 text-gray-400" : form.preferredDays.length > 0 ? "bg-purple-600 text-white" : "bg-[#1B1529] text-white"
                        )}>
                          {!step3Done ? <Lock className="h-3 w-3" /> : form.preferredDays.length > 0 ? <Check className="h-3.5 w-3.5" /> : "4"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={clsx("text-[10px] font-semibold uppercase tracking-wider", !step3Done ? "text-gray-300" : "text-gray-400")}>Step 4</p>
                          <p className={clsx("text-sm font-semibold", !step3Done ? "text-gray-300" : "text-gray-900")}>
                            {form.preferredDays.length > 0
                              ? form.preferredDays.map(d => format(new Date(d + "T00:00:00"), "EEE, MMM d")).join(" · ")
                              : "Choose a date"}
                          </p>
                        </div>
                      </div>
                      {step3Done && (
                        <div className="px-3 pb-5">
                          <div className="rounded-xl border border-gray-200 p-4">
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-lg font-bold text-gray-800">{format(month, "MMMM yyyy")}</span>
                              <div className="flex items-center gap-1">
                                <button onClick={() => setMonth(m => subMonths(m, 1))} className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100"><ChevronLeft className="h-5 w-5" /></button>
                                <button onClick={() => setMonth(m => addMonths(m, 1))} className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100"><ChevronRight className="h-5 w-5" /></button>
                              </div>
                            </div>
                            <div className="grid grid-cols-7 gap-1 mb-2">
                              {WEEKDAYS.map((d) => <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase py-1">{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                              {days.map((day) => {
                                const inMonth = isSameMonth(day, month);
                                if (!inMonth) return <div key={format(day, "yyyy-MM-dd")} />;
                                const ds = format(day, "yyyy-MM-dd");
                                const xp = isXpDay(day);
                                const sun = isSunday(day);
                                const past = isBefore(startOfDay(day), startOfDay(new Date()));
                                const disabled = xp || past;
                                const sel = form.preferredDays.includes(ds);
                                const dayIns = insights.get(ds);
                                const taken = dayIns && dayIns.status === "taken";
                                // Their own submission on this date
                                const myDateSubs = subsByDate.get(ds) || [];
                                const myFilled = myDateSubs.some(s => s.status === "assigned" || s.status === "accepted" || s.status === "pending");
                                return (
                                  <button key={ds} disabled={disabled || !!taken || myFilled}
                                    onClick={() => setForm(f => ({ ...f, preferredDays: sel ? [] : [ds] }))}
                                    className={clsx("relative flex flex-col items-center justify-center h-12 rounded-xl text-sm font-medium transition-all",
                                      disabled && "opacity-25 cursor-default",
                                      taken && !disabled && "opacity-40 cursor-default line-through",
                                      myFilled && !disabled && "bg-emerald-50 text-emerald-700 cursor-default opacity-70",
                                      !disabled && !taken && !sel && !sun && !myFilled && "text-gray-700 hover:bg-gray-100",
                                      sun && !sel && !disabled && !taken && !myFilled && "bg-purple-50 text-purple-600 font-semibold hover:bg-purple-100",
                                      sel && "bg-purple-600 text-white font-bold",
                                    )}>
                                    {sun && !sel && !disabled && !taken && !myFilled
                                      ? <><span className="text-base leading-none">🔥</span><span className="text-xs leading-none font-bold text-purple-600">{day.getDate()}</span></>
                                      : <span className="text-sm">{day.getDate()}</span>
                                    }
                                    {xp && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-purple-400 leading-none font-bold">XP</span>}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                              <span className="text-xs text-gray-400">🔥 Sunday streak</span>
                              <span className="flex items-center gap-1 text-xs text-emerald-500"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Your slot</span>
                              <span className="text-xs text-gray-400 line-through">Filled</span>
                              <span className="text-xs text-purple-400">XP = locked</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })()}
            </div>

            <div className="shrink-0 flex justify-end gap-3 border-t border-gray-100 px-6 py-5">
              <button onClick={() => setShowAdd(false)} className="rounded-xl px-5 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={() => submitReward(false)} disabled={!form.title || !form.pricingKind || form.preferredDays.length === 0} className="rounded-xl bg-gray-100 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-40">Save as Draft</button>
              <button onClick={() => submitReward(true)} disabled={!form.title || !form.pricingKind || form.preferredDays.length === 0} className="flex items-center gap-2 rounded-xl bg-[#1B1529] px-6 py-3 text-sm font-medium text-white hover:bg-[#2D1F5E] disabled:opacity-40">
                <Send className="h-4 w-4" /> {editingSub ? "Resubmit" : "Submit Application"}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ======== DETAIL MODAL ======== */}
      {showDetail && selSub && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowDetail(false); setSelSub(null); } }}>
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl flex">

            {/* Left: image */}
            <div className="relative w-56 shrink-0 bg-gray-100">
              {selSub.imageUrl
                ? <img src={selSub.imageUrl} alt={selSub.title} className="absolute inset-0 h-full w-full object-cover" />
                : <div className="flex h-full w-full items-center justify-center"><Gift className="h-12 w-12 text-gray-300" /></div>
              }
              {/* Discount badge on image */}
              {discountBadgeText(selSub) && (
                <div className="absolute bottom-4 left-4">
                  <span className="inline-flex items-center rounded-lg bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wide shadow-md">{discountBadgeText(selSub)}</span>
                </div>
              )}
            </div>

            {/* Right: content */}
            <div className="flex flex-1 flex-col overflow-auto no-scrollbar">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-600 capitalize">
                    {offeringTypeLabel(selSub.offeringType)}
                  </span>
                  <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", STATUS_PILL[selSub.status])}>
                    {STATUS_LABELS[selSub.status]}
                  </span>
                </div>
                <button onClick={() => { setShowDetail(false); setSelSub(null); }} className="text-gray-400 hover:text-gray-600 shrink-0"><XCircle className="h-5 w-5" /></button>
              </div>

              {/* Title + price */}
              <div className="flex items-start justify-between gap-4 px-6">
                <h2 className="text-lg font-bold text-gray-900 leading-snug">{selSub.title}</h2>
                <p className="text-xl font-extrabold text-[#1B1529] shrink-0">{fmt$(selSub.retailValue)}</p>
              </div>

              {/* Description */}
              {selSub.description && (
                <p className="mt-2 px-6 text-xs text-gray-500 leading-relaxed">{selSub.description}</p>
              )}

              {/* Stats row */}
              <div className="mt-4 px-6 grid grid-cols-3 gap-2">
                <StatCard label={selSub.offeringType === "session" ? "Spots" : "Qty"} value={
                  selSub.offeringType === "session" ? String(selSub.spotsAvailable || "—") : String(selSub.quantity || "—")
                } />
                <StatCard label="Cycle" value={CYCLES.find(c => c.value === selSub.cycle)?.label?.split(" ")[0] || selSub.cycle} />
                <StatCard label="Assigned" value={selSub.assignedDate ? format(new Date(selSub.assignedDate + "T00:00:00"), "d MMM") : "—"} />
              </div>

              {/* Details */}
              <div className="mt-4 px-6 space-y-2">
                <DetailRow label="Preferred" value={
                  selSub.dayPreference === "any" ? "Any available day" :
                  selSub.dayPreference === "sundays" ? "Sundays only" :
                  selSub.dayPreference === "week" ? `Week ${(selSub.preferredWeek || 0) + 1}` :
                  selSub.preferredDays.length > 0 ? selSub.preferredDays.map(d => format(new Date(d + "T00:00:00"), "d MMM")).join(", ") : "—"
                } />
                {selSub.offeringType === "session" && selSub.sessionDuration && <DetailRow label="Duration" value={selSub.sessionDuration} />}
                {selSub.offeringType === "session" && selSub.locationKind && <DetailRow label="Location" value={selSub.locationKind === "venue" ? "In-person" : selSub.locationKind === "online" ? "Online" : "At user's location"} />}
                {selSub.deliveryMethod && <DetailRow label="Delivery" value={selSub.deliveryMethod === "ship" ? "Ship to user" : selSub.deliveryMethod === "pickup" ? "Pickup" : "Digital"} />}
                {selSub.submittedDate && <DetailRow label="Submitted" value={selSub.submittedDate} />}
              </div>

              {/* Participation stats */}
              {selSub.status === "assigned" && (selSub.claimsCount != null || selSub.participationRate != null) && (
                <div className="mt-4 mx-6 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-2">Participation</p>
                  <div className="grid grid-cols-2 gap-2">
                    {selSub.claimsCount != null && <StatCard label="Claimed" value={String(selSub.claimsCount)} />}
                    {selSub.participationRate != null && <StatCard label="Claim Rate" value={`${selSub.participationRate}%`} />}
                  </div>
                </div>
              )}

              {/* Pitch */}
              {selSub.pitch && (
                <div className="mt-4 px-6">
                  <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1">Your Pitch</p>
                  <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 leading-relaxed">{selSub.pitch}</p>
                </div>
              )}

              {/* Admin note */}
              {(selSub.status === "rejected" || selSub.status === "revision_requested") && selSub.adminNote && (
                <div className={clsx("mt-4 mx-6 rounded-xl p-3", selSub.status === "rejected" ? "bg-red-50 border border-red-200" : "bg-orange-50 border border-orange-200")}>
                  <p className={clsx("text-[10px] font-semibold uppercase mb-1", selSub.status === "rejected" ? "text-red-500" : "text-orange-500")}>
                    {selSub.status === "rejected" ? "Rejection Reason" : "Admin Feedback"}
                  </p>
                  <p className={clsx("text-xs leading-relaxed", selSub.status === "rejected" ? "text-red-600" : "text-orange-700")}>{selSub.adminNote}</p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-5 px-6 pb-6 flex flex-wrap gap-2">
                <button onClick={() => { router.push("/pages/products"); setShowDetail(false); setSelSub(null); }}
                  className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                  <ExternalLink className="h-3.5 w-3.5" /> View Product Settings
                </button>
                {(selSub.status === "pending" || selSub.status === "draft") && (
                  <button onClick={() => { openEdit(selSub); setShowDetail(false); }}
                    className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                )}
                {(selSub.status === "rejected" || selSub.status === "revision_requested") && (
                  <button onClick={() => { openEdit(selSub); setShowDetail(false); }}
                    className="flex items-center gap-1.5 rounded-full bg-[#1B1529] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D1F5E]">
                    <Pencil className="h-3.5 w-3.5" /> Edit & Resubmit
                  </button>
                )}
                {selSub.status === "draft" && (
                  <button onClick={() => { doSubmit(selSub.id); setShowDetail(false); setSelSub(null); }}
                    className="flex items-center gap-1.5 rounded-full bg-[#1B1529] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D1F5E]">
                    <Send className="h-3.5 w-3.5" /> Submit
                  </button>
                )}
                {selSub.status === "pending" && (
                  <button onClick={() => doWithdraw(selSub.id)}
                    className="flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50">
                    <XCircle className="h-3.5 w-3.5" /> Withdraw
                  </button>
                )}
                {selSub.status === "assigned" && (
                  <button onClick={() => viewCalendarSlot(selSub)}
                    className="flex items-center gap-1.5 rounded-full border border-purple-200 px-4 py-2 text-xs font-semibold text-purple-600 hover:bg-purple-50">
                    <CalendarDays className="h-3.5 w-3.5" /> View Calendar Slot
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ======== TOAST ======== */}
      {toast && createPortal(
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-[slideUp_0.3s_ease-out]">
          <div className={clsx("flex items-center gap-3 rounded-xl px-5 py-3 shadow-lg", toast.type === "success" ? "bg-[#1B1529] text-white" : "bg-red-600 text-white")}>
            {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> : <AlertCircle className="h-4 w-4 text-red-200 shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-white/60 hover:text-white"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      , document.body)}
      </div>{/* close content wrapper */}
    </div>
  );
}

/* ================================================================ */
/* Small components                                                 */
/* ================================================================ */

function InsightCard({ icon, label, value, sub, tooltip }: { icon: React.ReactNode; label: string; value: string; sub: string; tooltip?: string }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200/60 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-400">{label}</span>
        {tooltip && (
          <div className="relative ml-auto group">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300 cursor-help shrink-0">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-50 w-52 rounded-xl bg-gray-900 px-3 py-2.5 text-[11px] leading-relaxed text-white shadow-xl">
              {tooltip}
              <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-sm text-gray-400 mt-1.5">{sub}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-gray-50 px-4 py-3 text-center"><p className="text-base font-bold text-gray-900">{value}</p><p className="text-xs text-gray-400 mt-0.5">{label}</p></div>;
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className="flex items-center justify-between"><span className="text-xs text-gray-400">{label}</span><span className={clsx("text-xs font-medium text-right max-w-[60%]", highlight ? "text-purple-600" : "text-gray-700")}>{value}</span></div>;
}

function SidebarProductCard({ sub, onView }: { sub: RewardSubmission; onView: () => void }) {
  const badge = discountBadgeText(sub);
  const discountedPrice = sub.discountKind === "percentage" && sub.discountValue
    ? sub.retailValue * (1 - sub.discountValue / 100)
    : sub.discountKind === "fixed" && sub.discountValue
    ? sub.retailValue - sub.discountValue
    : sub.retailValue === 0 ? 0
    : null;

  return (
    <button onClick={onView}
      className="group w-full rounded-2xl border border-gray-100 bg-white overflow-hidden text-left transition-all hover:shadow-lg hover:border-gray-200 shadow-sm">
      <div className="relative h-40 w-full bg-gray-100 overflow-hidden">
        {sub.imageUrl ? (
          <Image src={sub.imageUrl} alt={sub.title} fill className="object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-50">
            <Image src="/images/gift-box.png" alt="Gift" width={56} height={56} className="opacity-40" />
          </div>
        )}
        {badge && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white uppercase tracking-wide shadow-md">{badge}</span>
          </div>
        )}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B1529] text-white shadow-lg">
            <Plus className="h-4 w-4" />
          </span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 capitalize">
            {offeringTypeLabel(sub.offeringType)}
          </span>
          <span className={clsx(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            STATUS_PILL[sub.status]
          )}>{STATUS_LABELS[sub.status]}</span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">{sub.title}</p>
          <div className="shrink-0 text-right">
            {discountedPrice === 0 ? (
              <p className="text-sm font-bold text-emerald-600">FREE</p>
            ) : discountedPrice != null ? (
              <>
                <p className="text-sm font-bold text-gray-900">{fmt$(discountedPrice)}</p>
                <p className="text-[10px] text-gray-400 line-through">{fmt$(sub.retailValue)}</p>
              </>
            ) : (
              <p className="text-sm font-bold text-gray-900">{fmt$(sub.retailValue)}</p>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

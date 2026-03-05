// app/pages/quests/linking/page.tsx
"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  Search,
  Plus,
  Trash2,
  XCircle,
  Brain,
  Heart,
  Dumbbell,
  Leaf,
  Briefcase,
  Smile,
  Users,
  Compass,
  Target,
  ExternalLink,
  Package,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Link2,
  ChevronDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import ClipLoader from "react-spinners/ClipLoader";
import { useVendorProfile } from "../../../../context/VendorShellContext";

/* ================================================================ */
/* Types & Mock Data                                                */
/* ================================================================ */

type LinkedProduct = {
  id: string;
  productName: string;
  productType: "product" | "session";
  price: number;
  range: string;
  displayType: "card" | "link" | "cta_button";
  ctaText: string;
  clicks: number;
  conversions: number;
};

type PlatformQuest = {
  id: string;
  title: string;
  type: string;
  duration: string;
  dimensions: string[];
  ranges: string[];
  myLinks: LinkedProduct[];
};

const DIMENSION_ICONS: Record<string, typeof Brain> = {
  Mental: Brain, Emotional: Heart, Physical: Dumbbell, Environmental: Leaf,
  Occupational: Briefcase, Social: Users, Spiritual: Compass, Intellectual: Smile,
};

const PLATFORM_QUESTS: PlatformQuest[] = [
  {
    id: "pq1", title: "Stress Deep Dive", type: "Deep Dive", duration: "5 min",
    dimensions: ["Mental", "Emotional"],
    ranges: ["Low", "Moderate", "High"],
    myLinks: [
      { id: "l1", productName: "Calm Mind Session", productType: "session", price: 85, range: "Moderate", displayType: "card", ctaText: "Book Session", clicks: 34, conversions: 8 },
      { id: "l2", productName: "Anxiety Management Package", productType: "session", price: 450, range: "High", displayType: "cta_button", ctaText: "Get Started", clicks: 22, conversions: 5 },
    ],
  },
  {
    id: "pq2", title: "Burnout Risk Check", type: "Assessment", duration: "10 min",
    dimensions: ["Occupational", "Mental"],
    ranges: ["Low Risk", "Moderate Risk", "High Risk", "Critical"],
    myLinks: [
      { id: "l3", productName: "Recovery Wellness Package", productType: "session", price: 200, range: "High Risk", displayType: "card", ctaText: "Book Now", clicks: 12, conversions: 3 },
    ],
  },
  {
    id: "pq3", title: "Emotional Wellness Check", type: "Assessment", duration: "7 min",
    dimensions: ["Emotional", "Social"],
    ranges: ["Thriving", "Stable", "Struggling"],
    myLinks: [],
  },
  {
    id: "pq4", title: "Physical Activity Readiness", type: "Simple", duration: "3 min",
    dimensions: ["Physical"],
    ranges: ["Ready", "Moderate", "Consult First"],
    myLinks: [],
  },
];

const MY_QUESTS: PlatformQuest[] = [
  {
    id: "mq1", title: "Anxiety Pre-Screen", type: "Assessment", duration: "5 min",
    dimensions: ["Mental", "Emotional"],
    ranges: ["Low", "Moderate", "High"],
    myLinks: [
      { id: "ml1", productName: "Intro Therapy Session", productType: "session", price: 85, range: "Moderate", displayType: "card", ctaText: "Book Session", clicks: 18, conversions: 6 },
      { id: "ml2", productName: "Anxiety Management (6 sessions)", productType: "session", price: 450, range: "High", displayType: "cta_button", ctaText: "Start Recovery", clicks: 29, conversions: 11 },
    ],
  },
];

const VENDOR_CATALOG = [
  { id: "vc1", name: "Calm Mind Session", type: "session" as const, price: 85 },
  { id: "vc2", name: "Anxiety Management Package", type: "session" as const, price: 450 },
  { id: "vc3", name: "Recovery Wellness Package", type: "session" as const, price: 200 },
  { id: "vc4", name: "Intro Therapy Session", type: "session" as const, price: 85 },
  { id: "vc5", name: "Relaxation Kit", type: "product" as const, price: 35 },
  { id: "vc6", name: "Meditation Candle Bundle", type: "product" as const, price: 55 },
];

/* ================================================================ */
/* PAGE                                                             */
/* ================================================================ */

export default function ProductLinkingPage() {
  const router = useRouter();
  const { loading: shellLoading } = useVendorProfile();
  const [dimFilter, setDimFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkQuest, setLinkQuest] = useState<PlatformQuest | null>(null);
  const [linkRange, setLinkRange] = useState("");
  const [linkProduct, setLinkProduct] = useState("");
  const [linkDisplay, setLinkDisplay] = useState<"card" | "link" | "cta_button">("card");
  const [linkCta, setLinkCta] = useState("Book a Session");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  function openLinkModal(quest: PlatformQuest) {
    setLinkQuest(quest);
    setLinkRange(quest.ranges[0] || "");
    setLinkProduct("");
    setLinkDisplay("card");
    setLinkCta("Book a Session");
    setShowLinkModal(true);
  }

  const filteredPlatform = PLATFORM_QUESTS.filter((q) => {
    if (dimFilter !== "all" && !q.dimensions.includes(dimFilter)) return false;
    if (search && !q.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (shellLoading) return <div className="flex h-full w-full items-center justify-center">
    <ClipLoader size={55} color="#6B46C1" cssOverride={{ animationDuration: "3s" }} />
  </div>;

  return (
    <>
      {/* Hero */}
      <div className="shrink-0 relative z-30 overflow-visible bg-gradient-to-br from-[#7B61FF]/20 via-[#C084FC]/15 to-white px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#1B1529] tracking-tight">Product Linking</h1>
        <p className="text-xs text-gray-400 mt-0.5">Connect your products to quest results — get recommended when users score in your range</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quests..."
              className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100" />
          </div>
          <select value={dimFilter} onChange={(e) => setDimFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 outline-none">
            <option value="all">All Dimensions</option>
            {Object.keys(DIMENSION_ICONS).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-3 sm:px-4 lg:px-6 py-4 space-y-6">
        {/* Section 1: Platform Quests */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">Platform Quests</h2>
          <div className="space-y-3">
            {filteredPlatform.map((quest) => (
              <QuestLinkCard key={quest.id} quest={quest} onLink={() => openLinkModal(quest)} onRemove={(linkId) => showToast("Product link removed")} />
            ))}
            {filteredPlatform.length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">No platform quests match your filters</p>
            )}
          </div>
        </div>

        {/* Section 2: My Quests */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">My Quests</h2>
          <div className="space-y-3">
            {MY_QUESTS.map((quest) => (
              <QuestLinkCard key={quest.id} quest={quest} isMine onLink={() => openLinkModal(quest)} onRemove={(linkId) => showToast("Product link removed")}
                onEditInBuilder={() => router.push(`/pages/quests/builder?id=${quest.id}`)} />
            ))}
          </div>
        </div>
      </div>

      {/* Link Modal */}
      {showLinkModal && linkQuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowLinkModal(false); }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-bold text-gray-900">Link Product</h2>
              <button onClick={() => setShowLinkModal(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase text-gray-400">Quest</p>
                <p className="text-sm font-medium text-gray-900">{linkQuest.title}</p>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500">Show when result is:</label>
                <div className="flex flex-wrap gap-1.5">
                  {linkQuest.ranges.map((r) => (
                    <button key={r} onClick={() => setLinkRange(r)}
                      className={clsx("rounded-full px-3 py-1.5 text-xs font-medium border transition-all",
                        linkRange === r ? "border-purple-300 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500"
                      )}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500">Which product/service?</label>
                <select value={linkProduct} onChange={(e) => setLinkProduct(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-purple-300">
                  <option value="">Select...</option>
                  {VENDOR_CATALOG.map((p) => <option key={p.id} value={p.id}>{p.name} — ${p.price}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500">Display as:</label>
                <div className="flex gap-2">
                  {(["card", "link", "cta_button"] as const).map((d) => (
                    <button key={d} onClick={() => setLinkDisplay(d)}
                      className={clsx("flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-all",
                        linkDisplay === d ? "border-purple-300 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500"
                      )}>{d === "cta_button" ? "CTA Button" : d === "card" ? "Product Card" : "Simple Link"}</button>
                  ))}
                </div>
              </div>
              {linkDisplay === "cta_button" && (
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-500">CTA Text</label>
                  <input type="text" value={linkCta} onChange={(e) => setLinkCta(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-purple-300" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button onClick={() => setShowLinkModal(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={() => { setShowLinkModal(false); showToast("Product linked!"); }}
                disabled={!linkProduct}
                className="flex items-center gap-1.5 rounded-xl bg-[#1B1529] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#2D1F5E] disabled:opacity-40">
                <Link2 className="h-3.5 w-3.5" /> Link Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
          <div className={clsx("flex items-center gap-3 rounded-xl px-5 py-3 shadow-lg", toast.type === "success" ? "bg-[#1B1529] text-white" : "bg-red-600 text-white")}>
            {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-red-200" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-white/60 hover:text-white"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
    </>
  );
}

/* ================================================================ */
/* Quest Link Card                                                  */
/* ================================================================ */

function QuestLinkCard({ quest, isMine, onLink, onRemove, onEditInBuilder }: {
  quest: PlatformQuest; isMine?: boolean; onLink: () => void; onRemove: (id: string) => void; onEditInBuilder?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-gray-900">{quest.title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{quest.type} · {quest.duration} · Scored</p>
        </div>
        <div className="flex items-center gap-1.5">
          {quest.dimensions.map((d) => {
            const DI = DIMENSION_ICONS[d] || Target;
            return <span key={d} className="flex items-center gap-0.5 text-[10px] text-gray-400"><DI className="h-3 w-3" /> {d}</span>;
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {quest.ranges.map((r) => (
          <span key={r} className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-medium text-gray-500">{r}</span>
        ))}
      </div>

      {quest.myLinks.length > 0 ? (
        <div className="space-y-2 mb-3">
          <p className="text-[10px] font-semibold uppercase text-gray-400">Your linked products:</p>
          {quest.myLinks.map((link) => (
            <div key={link.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
              <div className="flex items-center gap-2">
                {link.productType === "session" ? <CalendarCheck className="h-3.5 w-3.5 text-violet-400" /> : <Package className="h-3.5 w-3.5 text-orange-400" />}
                <div>
                  <p className="text-xs font-medium text-gray-700">{link.productName}</p>
                  <p className="text-[10px] text-gray-400">{link.range} · {link.clicks} clicks · {link.conversions} bookings</p>
                </div>
              </div>
              <button onClick={() => onRemove(link.id)} className="text-gray-300 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-gray-400 mb-3">Your linked products: None</p>
      )}

      <div className="flex items-center gap-2">
        <button onClick={onLink} className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:underline">
          <Plus className="h-3 w-3" /> Link Product to a Range
        </button>
        {isMine && onEditInBuilder && (
          <button onClick={onEditInBuilder} className="flex items-center gap-1 ml-auto text-[11px] font-semibold text-gray-500 hover:underline">
            Edit in Builder <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

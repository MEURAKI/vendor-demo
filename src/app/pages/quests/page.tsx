// app/pages/quests/page.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import clsx from "clsx";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Copy,
  Send,
  RotateCcw,
  BarChart3,
  MoreHorizontal,
  XCircle,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  Zap,
  Target,
  Brain,
  Heart,
  Dumbbell,
  Leaf,
  Briefcase,
  Smile,
  Users,
  Compass,
  ChevronDown,
  LayoutTemplate,
  MessageSquare,
  ClipboardList,
  PauseCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import ClipLoader from "react-spinners/ClipLoader";
import { useVendorProfile } from "../../../context/VendorShellContext";
import { supabase } from "../../../lib/supabase/client";

/* ================================================================ */
/* Types                                                            */
/* ================================================================ */

type QuestStatus = "draft" | "pending_approval" | "approved" | "published" | "rejected" | "revision_requested" | "deactivation_requested";
type QuestType = "assessment" | "deep_dive" | "personality" | "simple" | "feedback";
type ScoringMode = "none" | "simple" | "dimension" | "weighted";

type Quest = {
  id: string;
  title: string;
  type: QuestType;
  status: QuestStatus;
  questionCount: number;
  duration: string;
  scoringMode: ScoringMode;
  xp: number;
  dimensions: string[];
  completions: number;
  productClicks: number;
  resultRanges: string[];
  createdAt: string;
  updatedAt: string;
  adminNote: string | null;
  imageUrl?: string;
};

type StatusFilter = "all" | QuestStatus;

/* ================================================================ */
/* Constants                                                        */
/* ================================================================ */

const STATUS_LABELS: Record<QuestStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
  revision_requested: "Revision Requested",
  deactivation_requested: "Deactivation Requested",
};

const STATUS_PILL: Record<QuestStatus, string> = {
  draft: "bg-gray-100 text-gray-500",
  pending_approval: "bg-amber-50 text-amber-600",
  approved: "bg-emerald-50 text-emerald-600",
  published: "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-500",
  revision_requested: "bg-orange-50 text-orange-600",
  deactivation_requested: "bg-purple-50 text-purple-600",
};

const TYPE_LABELS: Record<QuestType, string> = {
  assessment: "Assessment",
  deep_dive: "Deep Dive",
  personality: "Personality",
  simple: "Simple",
  feedback: "Feedback",
};

const TYPE_COLORS: Record<QuestType, string> = {
  assessment: "bg-blue-100 text-blue-700",
  deep_dive: "bg-purple-100 text-purple-700",
  personality: "bg-pink-100 text-pink-700",
  simple: "bg-gray-100 text-gray-700",
  feedback: "bg-teal-100 text-teal-700",
};

const DIMENSION_ICONS: Record<string, typeof Brain> = {
  Mental: Brain,
  Emotional: Heart,
  Physical: Dumbbell,
  Environmental: Leaf,
  Occupational: Briefcase,
  Social: Users,
  Spiritual: Compass,
  Intellectual: Smile,
};

const TEMPLATES = [
  { id: "t1", title: "Post-Session Feedback", type: "simple" as QuestType, questions: 5, desc: "\"How was your session?\" — rating + text" },
  { id: "t2", title: "Client Intake Form", type: "assessment" as QuestType, questions: 15, desc: "New client onboarding with 3 sections" },
  { id: "t3", title: "Pre-Session Check-In", type: "simple" as QuestType, questions: 3, desc: "\"How are you feeling before we start?\"" },
  { id: "t4", title: "Treatment Progress Tracker", type: "assessment" as QuestType, questions: 10, desc: "Re-take weekly, shows progress comparison" },
  { id: "t5", title: "Wellness Style Quiz", type: "personality" as QuestType, questions: 8, desc: "Fun quiz: \"What's your wellness personality?\"" },
  { id: "t6", title: "Satisfaction Survey", type: "simple" as QuestType, questions: 6, desc: "\"Rate your experience\"" },
];

/* ================================================================ */
/* PAGE                                                             */
/* ================================================================ */

export default function MyQuestsPage() {
  const router = useRouter();
  const { loading: shellLoading } = useVendorProfile();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selQuest, setSelQuest] = useState<Quest | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    fetchQuests();
  }, []);

  async function fetchQuests() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/quests", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.quests) setQuests(json.quests);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return quests.filter((q) => {
      if (filter !== "all" && q.status !== filter) return false;
      if (search) {
        const s = search.toLowerCase();
        return q.title.toLowerCase().includes(s);
      }
      return true;
    });
  }, [quests, filter, search]);

  const filterCounts = useMemo(() => {
    const c: Record<string, number> = { all: quests.length };
    quests.forEach((q) => { c[q.status] = (c[q.status] || 0) + 1; });
    return c;
  }, [quests]);

  async function doSubmit(id: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/quests/${id}/submit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      showToast("Quest submitted for approval!");
      fetchQuests();
    } else {
      showToast("Failed to submit", "error");
    }
    setMenuOpen(null);
  }
  async function doDuplicate(q: Quest) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/quests/${q.id}/duplicate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      showToast("Duplicated as draft");
      fetchQuests();
    } else {
      showToast("Failed to duplicate", "error");
    }
    setMenuOpen(null);
  }
  async function doRequestDeactivation(id: string) {
    if (!confirm("Request admin to deactivate this quest?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/quests/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "deactivation_requested" }),
    });
    if (res.ok) {
      showToast("Deactivation requested");
      fetchQuests();
    } else {
      showToast("Failed to request deactivation", "error");
    }
    setMenuOpen(null);
  }

  if (shellLoading || loading) return <div className="flex h-full w-full items-center justify-center">
    <ClipLoader size={55} color="#6B46C1" cssOverride={{ animationDuration: "3s" }} />
  </div>;

  return (
    <div className="relative min-h-full flex-1 overflow-auto">
      {/* Background image */}
      <div className="absolute top-0 left-0 right-0 h-[420px] overflow-hidden pointer-events-none">
        <img src="/images/vendor bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-[#F6F6FC]" />
      </div>

      <div className="relative px-6 sm:px-8 py-6 sm:py-8 space-y-6">
        {/* ======== HERO (glass panel) ======== */}
        <div className="rounded-3xl bg-white/[0.25] backdrop-blur-3xl border border-white/40 shadow-[0_22px_90px_rgba(124,58,237,0.35)] p-4 sm:p-6 xl:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#1B1529] tracking-tight">My Quests</h1>
              <p className="text-xs text-gray-400 mt-0.5">Build questionnaires to engage users and drive bookings</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowTemplates(true)} className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-50 shadow-sm">
                <LayoutTemplate className="h-4 w-4" /> Templates
              </button>
              <button onClick={() => router.push("/pages/quests/builder")} className="flex items-center gap-1.5 rounded-xl bg-[#1B1529] px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#2D1F5E] shadow-sm">
                <Plus className="h-4 w-4" /> Create Quest
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search quests..."
                className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100" />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(["all", "draft", "pending_approval", "approved", "published", "rejected", "revision_requested"] as StatusFilter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={clsx("shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all",
                    filter === f ? "bg-[#1B1529] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  )}>
                  {f === "all" ? "All" : STATUS_LABELS[f]}
                  <span className="ml-1 opacity-60">{filterCounts[f] || 0}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ======== QUEST GRID ======== */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center py-16">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gray-100 mb-4"><ClipboardList className="h-7 w-7 text-gray-300" /></div>
            <p className="text-sm font-medium text-gray-500">
              {quests.length === 0 ? "Create your first questionnaire to engage users and drive bookings." : "No quests match your filters"}
            </p>
            <p className="mt-1 text-xs text-gray-400 max-w-xs text-center">Therapists love using our builder for client intake forms and progress tracking.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => router.push("/pages/quests/builder")} className="flex items-center gap-2 rounded-xl bg-[#1B1529] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2D1F5E]">
                <Plus className="h-4 w-4" /> Create Quest
              </button>
              <button onClick={() => setShowTemplates(true)} className="flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                <LayoutTemplate className="h-4 w-4" /> Browse Templates
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((quest) => {
              const TypeIcon = DIMENSION_ICONS[quest.dimensions[0]] || Brain;
              return (
                <div key={quest.id} className="relative rounded-2xl bg-white shadow-sm flex flex-col hover:shadow-md transition-shadow">
                  {/* Image or gradient header */}
                  <div className="relative h-28 w-full rounded-t-2xl overflow-hidden bg-gradient-to-br from-purple-100 via-violet-50 to-pink-50">
                    {quest.imageUrl && <Image src={quest.imageUrl} alt={quest.title} fill className="object-cover opacity-60" />}
                    <div className="absolute inset-0 p-3 flex items-start justify-between">
                      <span className={clsx("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", TYPE_COLORS[quest.type])}>{TYPE_LABELS[quest.type]}</span>
                      <span className={clsx("rounded-full px-2.5 py-1 text-[10px] font-semibold", STATUS_PILL[quest.status])}>{STATUS_LABELS[quest.status]}</span>
                    </div>
                  </div>

                  <div className="flex flex-col flex-1 p-4">
                    <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">{quest.title}</h3>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {quest.questionCount} questions · {quest.duration} · {quest.scoringMode === "none" ? "No scoring" : "Scored"}
                    </p>

                    <div className="flex items-center gap-2 mt-2.5">
                      <span className="flex items-center gap-1 rounded-full bg-[#1B1529] px-2 py-0.5 text-[9px] font-bold text-white">
                        <Zap className="h-2.5 w-2.5" /> {quest.xp} XP
                      </span>
                      {quest.dimensions.slice(0, 2).map((d) => {
                        const DI = DIMENSION_ICONS[d] || Target;
                        return (
                          <span key={d} className="flex items-center gap-0.5 text-[10px] text-gray-400">
                            <DI className="h-3 w-3" /> {d}
                          </span>
                        );
                      })}
                    </div>

                    {quest.resultRanges.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-2">Result: {quest.resultRanges.join(" / ")}</p>
                    )}

                    {(quest.status === "approved" || quest.status === "published") && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-gray-50 px-2.5 py-2 text-center">
                          <p className="text-sm font-bold text-gray-900">{quest.completions}</p>
                          <p className="text-[9px] text-gray-400">Completions</p>
                        </div>
                        <div className="rounded-lg bg-gray-50 px-2.5 py-2 text-center">
                          <p className="text-sm font-bold text-gray-900">{quest.productClicks}</p>
                          <p className="text-[9px] text-gray-400">Product Clicks</p>
                        </div>
                      </div>
                    )}

                    {/* Admin feedback banner */}
                    {(quest.status === "rejected" || quest.status === "revision_requested") && quest.adminNote && (
                      <div className={clsx("mt-3 rounded-lg px-3 py-2", quest.status === "rejected" ? "bg-red-50" : "bg-orange-50")}>
                        <p className={clsx("text-[10px] font-semibold", quest.status === "rejected" ? "text-red-500" : "text-orange-500")}>
                          {quest.status === "rejected" ? "Rejection reason:" : "Admin feedback:"}
                        </p>
                        <p className={clsx("text-[10px] leading-relaxed mt-0.5 line-clamp-2", quest.status === "rejected" ? "text-red-600" : "text-orange-600")}>
                          {quest.adminNote}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-auto pt-3 flex items-center gap-1.5">
                      <button onClick={() => { setSelQuest(quest); setShowDetail(true); }}
                        className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 py-2 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                        <Eye className="h-3 w-3" /> Preview
                      </button>
                      {(quest.status === "draft" || quest.status === "revision_requested" || quest.status === "rejected") && (
                        <button onClick={() => router.push(`/pages/quests/builder?id=${quest.id}`)}
                          className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 py-2 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                      )}
                      <div className="relative">
                        <button onClick={() => setMenuOpen(menuOpen === quest.id ? null : quest.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuOpen === quest.id && (
                          <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-xl bg-white border border-gray-200 shadow-xl py-1.5">
                            <MenuBtn icon={Copy} label="Duplicate" onClick={() => doDuplicate(quest)} />
                            {quest.status === "draft" && <MenuBtn icon={Send} label="Submit for Approval" onClick={() => doSubmit(quest.id)} />}
                            {(quest.status === "revision_requested" || quest.status === "rejected") && <MenuBtn icon={RotateCcw} label="Resubmit" onClick={() => doSubmit(quest.id)} />}
                            {(quest.status === "rejected" || quest.status === "revision_requested") && (
                              <MenuBtn icon={MessageSquare} label="View Feedback" onClick={() => { setSelQuest(quest); setShowDetail(true); setMenuOpen(null); }} />
                            )}
                            {(quest.status === "approved" || quest.status === "published") && (
                              <>
                                <MenuBtn icon={BarChart3} label="View Analytics" onClick={() => { router.push("/pages/quests/analytics"); setMenuOpen(null); }} />
                                <MenuBtn icon={PauseCircle} label="Request Deactivation" onClick={() => doRequestDeactivation(quest.id)} danger />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ======== TEMPLATE MODAL ======== */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowTemplates(false); }}>
          <div className="w-full max-w-lg max-h-[80vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-bold text-gray-900">Quest Templates</h2>
              <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-auto no-scrollbar p-4 space-y-3">
              {TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => { setShowTemplates(false); router.push(`/pages/quests/builder?template=${t.id}`); }}
                  className="w-full text-left rounded-xl border border-gray-200 px-4 py-3.5 hover:border-purple-300 hover:bg-purple-50/30 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{t.questions} questions · {TYPE_LABELS[t.type]}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{t.desc}</p>
                    </div>
                    <span className={clsx("shrink-0 ml-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", TYPE_COLORS[t.type])}>{TYPE_LABELS[t.type]}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======== DETAIL DRAWER ======== */}
      {showDetail && selQuest && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) { setShowDetail(false); setSelQuest(null); } }}>
          <div className="h-full w-full max-w-sm overflow-auto no-scrollbar bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", TYPE_COLORS[selQuest.type])}>{TYPE_LABELS[selQuest.type]}</span>
                <span className={clsx("rounded-full px-2.5 py-1 text-[10px] font-semibold", STATUS_PILL[selQuest.status])}>{STATUS_LABELS[selQuest.status]}</span>
              </div>
              <button onClick={() => { setShowDetail(false); setSelQuest(null); }} className="text-gray-400 hover:text-gray-600"><XCircle className="h-5 w-5" /></button>
            </div>

            {selQuest.imageUrl && (
              <div className="relative h-40 w-full bg-gray-100"><Image src={selQuest.imageUrl} alt={selQuest.title} fill className="object-cover" /></div>
            )}

            <div className="px-6 py-6">
              <h2 className="text-lg font-bold text-gray-900">{selQuest.title}</h2>
              <p className="text-xs text-gray-400 mt-1">{selQuest.questionCount} questions · {selQuest.duration} · {selQuest.xp} XP</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {selQuest.dimensions.map((d) => {
                  const DI = DIMENSION_ICONS[d] || Target;
                  return (
                    <span key={d} className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-medium text-gray-600">
                      <DI className="h-3 w-3" /> {d}
                    </span>
                  );
                })}
              </div>

              {selQuest.resultRanges.length > 0 && (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase text-gray-400 mb-2">Result Ranges</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selQuest.resultRanges.map((r) => (
                      <span key={r} className="rounded-lg bg-purple-50 px-2.5 py-1.5 text-[11px] font-medium text-purple-700">{r}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 space-y-3">
                <div className="flex justify-between text-xs"><span className="text-gray-400">Scoring</span><span className="font-medium text-gray-700 capitalize">{selQuest.scoringMode}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-400">Created</span><span className="font-medium text-gray-700">{selQuest.createdAt}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-400">Updated</span><span className="font-medium text-gray-700">{selQuest.updatedAt}</span></div>
              </div>

              {(selQuest.status === "approved" || selQuest.status === "published") && (
                <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <p className="text-[10px] font-semibold uppercase text-emerald-600 mb-3">Performance</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white px-3 py-2.5 text-center border border-emerald-100">
                      <p className="text-base font-bold text-gray-900">{selQuest.completions}</p>
                      <p className="text-[9px] text-gray-400">Completions</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2.5 text-center border border-emerald-100">
                      <p className="text-base font-bold text-gray-900">{selQuest.productClicks}</p>
                      <p className="text-[9px] text-gray-400">Product Clicks</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin feedback */}
              {(selQuest.status === "rejected" || selQuest.status === "revision_requested") && selQuest.adminNote && (
                <div className={clsx("mt-5 rounded-xl p-4", selQuest.status === "rejected" ? "bg-red-50 border border-red-200" : "bg-orange-50 border border-orange-200")}>
                  <p className={clsx("text-[10px] font-semibold uppercase mb-1", selQuest.status === "rejected" ? "text-red-500" : "text-orange-500")}>
                    {selQuest.status === "rejected" ? "Rejection Reason" : "Admin Feedback"}
                  </p>
                  <p className={clsx("text-xs leading-relaxed", selQuest.status === "rejected" ? "text-red-600" : "text-orange-700")}>{selQuest.adminNote}</p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 space-y-2">
                {selQuest.status === "draft" && (
                  <button onClick={() => { doSubmit(selQuest.id); setShowDetail(false); setSelQuest(null); }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B1529] py-3 text-sm font-medium text-white hover:bg-[#2D1F5E]">
                    <Send className="h-3.5 w-3.5" /> Submit for Approval
                  </button>
                )}
                {(selQuest.status === "draft" || selQuest.status === "revision_requested") && (
                  <button onClick={() => { router.push(`/pages/quests/builder?id=${selQuest.id}`); setShowDetail(false); }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    <Pencil className="h-3.5 w-3.5" /> Edit in Builder
                  </button>
                )}
                {(selQuest.status === "rejected" || selQuest.status === "revision_requested") && (
                  <button onClick={() => { doSubmit(selQuest.id); setShowDetail(false); setSelQuest(null); }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B1529] py-3 text-sm font-medium text-white hover:bg-[#2D1F5E]">
                    <RotateCcw className="h-3.5 w-3.5" /> Edit & Resubmit
                  </button>
                )}
                {(selQuest.status === "approved" || selQuest.status === "published") && (
                  <button onClick={() => { router.push("/pages/quests/analytics"); setShowDetail(false); }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-200 py-3 text-sm font-medium text-purple-600 hover:bg-purple-50">
                    <BarChart3 className="h-3.5 w-3.5" /> View Analytics
                  </button>
                )}
                <button onClick={() => { doDuplicate(selQuest); setShowDetail(false); setSelQuest(null); }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50">
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======== TOAST ======== */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-[slideUp_0.3s_ease-out]">
          <div className={clsx("flex items-center gap-3 rounded-xl px-5 py-3 shadow-lg", toast.type === "success" ? "bg-[#1B1529] text-white" : "bg-red-600 text-white")}>
            {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> : <AlertCircle className="h-4 w-4 text-red-200 shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-white/60 hover:text-white"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================ */
/* Small components                                                 */
/* ================================================================ */

function MenuBtn({ icon: Icon, label, onClick, danger }: { icon: typeof Copy; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={clsx("flex w-full items-center gap-2.5 px-4 py-2 text-xs font-medium transition-colors", danger ? "text-red-500 hover:bg-red-50" : "text-gray-600 hover:bg-gray-50")}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

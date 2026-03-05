// app/pages/quests/builder/page.tsx
"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  Plus,
  Save,
  Send,
  Eye,
  ArrowLeft,
  GripVertical,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  Settings,
  FileText,
  BarChart3,
  Type,
  Hash,
  CheckSquare,
  CircleDot,
  Star,
  SlidersHorizontal,
  AlignLeft,
  Calendar,
  Image as ImageIcon,
  ListOrdered,
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
  XCircle,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import ClipLoader from "react-spinners/ClipLoader";
import { useVendorProfile } from "../../../../context/VendorShellContext";

/* ================================================================ */
/* Types                                                            */
/* ================================================================ */

type QuestionType = "short_text" | "long_text" | "single_choice" | "multiple_choice" | "rating" | "scale" | "yes_no" | "number" | "date" | "image_choice" | "ranking";

type Question = {
  id: string;
  type: QuestionType;
  text: string;
  required: boolean;
  options: string[];
  points: number;
  branchTo: string | null;
};

type BuilderTab = "questions" | "results" | "settings";

/* ================================================================ */
/* Constants                                                        */
/* ================================================================ */

const QUESTION_TYPES: { value: QuestionType; label: string; icon: typeof Type; desc: string }[] = [
  { value: "short_text", label: "Short Text", icon: Type, desc: "One-line answer" },
  { value: "long_text", label: "Long Text", icon: AlignLeft, desc: "Paragraph answer" },
  { value: "single_choice", label: "Single Choice", icon: CircleDot, desc: "Pick one option" },
  { value: "multiple_choice", label: "Multiple Choice", icon: CheckSquare, desc: "Pick multiple" },
  { value: "rating", label: "Rating", icon: Star, desc: "Star rating (1-5)" },
  { value: "scale", label: "Scale", icon: SlidersHorizontal, desc: "Numeric scale" },
  { value: "yes_no", label: "Yes / No", icon: ToggleLeft, desc: "Binary choice" },
  { value: "number", label: "Number", icon: Hash, desc: "Numeric input" },
  { value: "date", label: "Date", icon: Calendar, desc: "Date picker" },
  { value: "image_choice", label: "Image Choice", icon: ImageIcon, desc: "Pick from images" },
  { value: "ranking", label: "Ranking", icon: ListOrdered, desc: "Order items" },
];

const DIMENSIONS = [
  { id: "Mental", icon: Brain },
  { id: "Emotional", icon: Heart },
  { id: "Physical", icon: Dumbbell },
  { id: "Environmental", icon: Leaf },
  { id: "Occupational", icon: Briefcase },
  { id: "Social", icon: Users },
  { id: "Spiritual", icon: Compass },
  { id: "Intellectual", icon: Smile },
];

/* ================================================================ */
/* PAGE                                                             */
/* ================================================================ */

export default function QuestBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: shellLoading } = useVendorProfile();

  const [tab, setTab] = useState<BuilderTab>("questions");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showAddQ, setShowAddQ] = useState(false);
  const [selQuestion, setSelQuestion] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Settings
  const [questType, setQuestType] = useState("assessment");
  const [scoringMode, setScoringMode] = useState("simple");
  const [xp, setXp] = useState("50");
  const [duration, setDuration] = useState("5 min");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selDimensions, setSelDimensions] = useState<string[]>(["Mental"]);

  // Results
  const [ranges, setRanges] = useState([
    { label: "Low", min: 0, max: 10, message: "You're doing well! Keep up the healthy habits.", color: "bg-emerald-100 text-emerald-700" },
    { label: "Moderate", min: 11, max: 17, message: "Some areas could use attention. Consider speaking with a professional.", color: "bg-amber-100 text-amber-700" },
    { label: "High", min: 18, max: 25, message: "Your responses suggest this may be affecting your daily life. We recommend booking a session.", color: "bg-red-100 text-red-700" },
  ]);

  function showToastMsg(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  function addQuestion(type: QuestionType) {
    const q: Question = {
      id: `q-${Date.now()}`,
      type,
      text: "",
      required: true,
      options: type === "single_choice" || type === "multiple_choice" || type === "image_choice" || type === "ranking" ? ["Option 1", "Option 2"] : [],
      points: 0,
      branchTo: null,
    };
    setQuestions((p) => [...p, q]);
    setSelQuestion(q.id);
    setShowAddQ(false);
  }

  function updateQuestion(id: string, updates: Partial<Question>) {
    setQuestions((p) => p.map((q) => q.id === id ? { ...q, ...updates } : q));
  }

  function removeQuestion(id: string) {
    setQuestions((p) => p.filter((q) => q.id !== id));
    if (selQuestion === id) setSelQuestion(null);
  }

  function duplicateQuestion(q: Question) {
    const dup = { ...q, id: `q-${Date.now()}`, text: `${q.text} (Copy)` };
    setQuestions((p) => [...p, dup]);
  }

  function moveQuestion(id: string, dir: -1 | 1) {
    setQuestions((p) => {
      const idx = p.findIndex((q) => q.id === id);
      if (idx < 0) return p;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= p.length) return p;
      const arr = [...p];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }

  if (shellLoading) return <div className="flex h-full w-full items-center justify-center">
    <ClipLoader size={55} color="#6B46C1" cssOverride={{ animationDuration: "3s" }} />
  </div>;

  return (
    <>
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/pages/quests")} className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quest title..."
            className="text-base sm:text-lg font-bold text-gray-900 outline-none border-none bg-transparent placeholder:text-gray-300 w-64 sm:w-80" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => showToastMsg("Draft saved!")} className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
            <Save className="h-3.5 w-3.5" /> Save Draft
          </button>
          <button className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <button onClick={() => {
            if (questions.length === 0) { showToastMsg("Add at least 1 question", "error"); return; }
            if (!title) { showToastMsg("Add a title", "error"); return; }
            showToastMsg("Quest submitted for approval!");
          }} className="flex items-center gap-1.5 rounded-xl bg-[#1B1529] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D1F5E]">
            <Send className="h-3.5 w-3.5" /> Submit for Approval
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-1 border-b border-gray-200 bg-white px-4 sm:px-6">
        {([
          { key: "questions" as BuilderTab, label: "Questions", icon: FileText, badge: String(questions.length) },
          { key: "results" as BuilderTab, label: "Results", icon: BarChart3, badge: null },
          { key: "settings" as BuilderTab, label: "Settings", icon: Settings, badge: null },
        ]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx("relative shrink-0 px-4 py-3 text-sm font-semibold transition-colors",
              tab === t.key ? "text-[#1B1529]" : "text-gray-400 hover:text-gray-600"
            )}>
            <t.icon className="mr-1.5 inline h-4 w-4" />
            {t.label}
            {t.badge && <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-200 px-1.5 text-[10px] font-bold text-gray-600">{t.badge}</span>}
            {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1B1529] rounded-full" />}
          </button>
        ))}
      </div>

      {/* ======== QUESTIONS TAB ======== */}
      {tab === "questions" && (
        <div className="flex-1 overflow-auto no-scrollbar px-4 sm:px-6 py-4">
          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gray-100 mb-4"><FileText className="h-7 w-7 text-gray-300" /></div>
              <p className="text-sm font-medium text-gray-500">No questions yet</p>
              <p className="mt-1 text-xs text-gray-400">Start building your quest by adding questions</p>
              <button onClick={() => setShowAddQ(true)} className="mt-4 flex items-center gap-2 rounded-xl bg-[#1B1529] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2D1F5E]">
                <Plus className="h-4 w-4" /> Add Question
              </button>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-3">
              {questions.map((q, idx) => {
                const typeInfo = QUESTION_TYPES.find((t) => t.value === q.type);
                const QIcon = typeInfo?.icon || Type;
                const isSelected = selQuestion === q.id;
                return (
                  <div key={q.id}
                    className={clsx("rounded-xl border bg-white p-4 transition-all", isSelected ? "border-purple-300 shadow-md" : "border-gray-200 hover:border-gray-300")}
                    onClick={() => setSelQuestion(q.id)}>
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center gap-1 pt-1">
                        <GripVertical className="h-4 w-4 text-gray-300 cursor-grab" />
                        <span className="text-[10px] font-bold text-gray-300">{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <QIcon className="h-4 w-4 text-purple-400 shrink-0" />
                          <span className="text-[10px] font-semibold text-purple-500 uppercase">{typeInfo?.label}</span>
                          {q.required && <span className="text-[9px] text-red-400 font-medium">Required</span>}
                          {q.points > 0 && <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-600">{q.points} pts</span>}
                        </div>
                        <input type="text" value={q.text} onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                          placeholder="Enter your question..."
                          className="w-full text-sm font-medium text-gray-900 outline-none bg-transparent placeholder:text-gray-300" />

                        {/* Options for choice types */}
                        {(q.type === "single_choice" || q.type === "multiple_choice" || q.type === "ranking") && isSelected && (
                          <div className="mt-3 space-y-1.5">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <span className={clsx("h-4 w-4 shrink-0 rounded-full border-2 border-gray-300", q.type === "multiple_choice" && "rounded")} />
                                <input type="text" value={opt}
                                  onChange={(e) => {
                                    const newOpts = [...q.options];
                                    newOpts[oi] = e.target.value;
                                    updateQuestion(q.id, { options: newOpts });
                                  }}
                                  className="flex-1 rounded-lg border border-gray-100 px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-purple-200" />
                                <button onClick={() => updateQuestion(q.id, { options: q.options.filter((_, i) => i !== oi) })}
                                  className="text-gray-300 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                              </div>
                            ))}
                            <button onClick={() => updateQuestion(q.id, { options: [...q.options, `Option ${q.options.length + 1}`] })}
                              className="text-[11px] font-medium text-purple-500 hover:underline">+ Add option</button>
                          </div>
                        )}

                        {/* Points & required (expanded) */}
                        {isSelected && (
                          <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3">
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-medium text-gray-400">Points</label>
                              <input type="number" value={q.points} onChange={(e) => updateQuestion(q.id, { points: parseInt(e.target.value) || 0 })}
                                className="w-14 rounded-lg border border-gray-200 px-2 py-1 text-xs text-center outline-none" />
                            </div>
                            <button onClick={() => updateQuestion(q.id, { required: !q.required })}
                              className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
                              {q.required ? <ToggleRight className="h-4 w-4 text-purple-500" /> : <ToggleLeft className="h-4 w-4" />}
                              Required
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); moveQuestion(q.id, -1); }} className="text-gray-300 hover:text-gray-500"><ChevronUp className="h-4 w-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); moveQuestion(q.id, 1); }} className="text-gray-300 hover:text-gray-500"><ChevronDown className="h-4 w-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); duplicateQuestion(q); }} className="text-gray-300 hover:text-gray-500"><Copy className="h-3.5 w-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }} className="text-gray-300 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => setShowAddQ(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-4 text-sm font-medium text-gray-400 hover:border-purple-300 hover:text-purple-500 transition-colors">
                <Plus className="h-4 w-4" /> Add Question
              </button>
            </div>
          )}
        </div>
      )}

      {/* ======== RESULTS TAB ======== */}
      {tab === "results" && (
        <div className="flex-1 overflow-auto no-scrollbar px-4 sm:px-6 py-4">
          <div className="max-w-2xl mx-auto space-y-4">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Scoring Mode</label>
              <div className="grid grid-cols-4 gap-2">
                {(["none", "simple", "dimension", "weighted"] as const).map((m) => (
                  <button key={m} onClick={() => setScoringMode(m)}
                    className={clsx("rounded-lg border px-3 py-2.5 text-xs font-medium capitalize transition-all",
                      scoringMode === m ? "border-purple-300 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                    )}>{m}</button>
                ))}
              </div>
            </div>

            {scoringMode !== "none" && (
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Score Ranges</label>
                <div className="space-y-3">
                  {ranges.map((r, i) => (
                    <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <span className={clsx("rounded-full px-3 py-1 text-xs font-bold", r.color)}>{r.label}</span>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <input type="number" value={r.min} onChange={(e) => { const nr = [...ranges]; nr[i].min = parseInt(e.target.value) || 0; setRanges(nr); }}
                            className="w-12 rounded border border-gray-200 px-2 py-1 text-center text-xs outline-none" />
                          <span>—</span>
                          <input type="number" value={r.max} onChange={(e) => { const nr = [...ranges]; nr[i].max = parseInt(e.target.value) || 0; setRanges(nr); }}
                            className="w-12 rounded border border-gray-200 px-2 py-1 text-center text-xs outline-none" />
                          <span>points</span>
                        </div>
                      </div>
                      <textarea rows={2} value={r.message}
                        onChange={(e) => { const nr = [...ranges]; nr[i].message = e.target.value; setRanges(nr); }}
                        placeholder="Result message shown to user..."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-purple-300" />

                      <div className="mt-3 rounded-lg border border-dashed border-gray-200 px-3 py-2.5">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Linked Products</p>
                        <p className="text-[11px] text-gray-400">No products linked to this range yet</p>
                        <button className="mt-1.5 text-[11px] font-medium text-purple-500 hover:underline">+ Link Product</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setRanges([...ranges, { label: `Range ${ranges.length + 1}`, min: 0, max: 0, message: "", color: "bg-gray-100 text-gray-700" }])}
                    className="text-xs font-medium text-purple-500 hover:underline">+ Add Range</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======== SETTINGS TAB ======== */}
      {tab === "settings" && (
        <div className="flex-1 overflow-auto no-scrollbar px-4 sm:px-6 py-4">
          <div className="max-w-2xl mx-auto space-y-5">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Quest Title *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Anxiety Pre-Screen"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-purple-300" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Description</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this quest about?"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-purple-300" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500">Quest Type</label>
                <select value={questType} onChange={(e) => setQuestType(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-purple-300">
                  <option value="assessment">Assessment</option>
                  <option value="deep_dive">Deep Dive</option>
                  <option value="personality">Personality</option>
                  <option value="simple">Simple</option>
                  <option value="feedback">Feedback</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500">Estimated Duration</label>
                <select value={duration} onChange={(e) => setDuration(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-purple-300">
                  {["2 min", "5 min", "8 min", "10 min", "15 min", "20 min"].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">XP Reward</label>
              <input type="number" value={xp} onChange={(e) => setXp(e.target.value)} placeholder="50"
                className="w-32 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-purple-300" />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">Wellness Dimensions</label>
              <div className="flex flex-wrap gap-2">
                {DIMENSIONS.map((d) => {
                  const DI = d.icon;
                  const sel = selDimensions.includes(d.id);
                  return (
                    <button key={d.id} onClick={() => setSelDimensions((p) => sel ? p.filter((x) => x !== d.id) : [...p, d.id])}
                      className={clsx("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        sel ? "border-purple-300 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500 hover:border-gray-300"
                      )}>
                      <DI className="h-3.5 w-3.5" /> {d.id}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Anonymous Responses</p>
                <p className="text-xs text-gray-400">Users&apos; identities won&apos;t be linked to responses</p>
              </div>
              <button onClick={() => setIsAnonymous(!isAnonymous)}>
                {isAnonymous ? <ToggleRight className="h-6 w-6 text-purple-500" /> : <ToggleLeft className="h-6 w-6 text-gray-300" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======== ADD QUESTION MODAL ======== */}
      {showAddQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowAddQ(false); }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-bold text-gray-900">Add Question</h2>
              <button onClick={() => setShowAddQ(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2 max-h-[60vh] overflow-auto">
              {QUESTION_TYPES.map((t) => {
                const I = t.icon;
                return (
                  <button key={t.value} onClick={() => addQuestion(t.value)}
                    className="flex items-start gap-2.5 rounded-xl border border-gray-200 px-3 py-3 text-left hover:border-purple-300 hover:bg-purple-50/30 transition-all">
                    <I className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{t.label}</p>
                      <p className="text-[10px] text-gray-400">{t.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======== TOAST ======== */}
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

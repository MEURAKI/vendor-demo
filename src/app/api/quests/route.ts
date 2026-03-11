// app/api/quests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

function supaWithAuth(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const token = req.headers.get("authorization") || "";

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: token,
      },
    },
  });
}

/**
 * GET /api/quests
 * List quests for authenticated vendor
 */
export async function GET(req: NextRequest) {
  const client = supaWithAuth(req);

  // 1) Get user
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // 2) Fetch vendor quests
  const { data: quests, error } = await client
    .from("quests")
    .select("*")
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!quests || quests.length === 0) {
    return NextResponse.json({ quests: [] });
  }

  const questIds = quests.map((q: any) => q.id);

  // 3) Fetch quest_dimensions with wellness_dimensions name
  const { data: dimensions } = await client
    .from("quest_dimensions")
    .select("quest_id, dimension_id, wellness_dimensions ( name )")
    .in("quest_id", questIds);

  const dimsByQuest: Record<string, string[]> = {};
  (dimensions ?? []).forEach((d: any) => {
    if (!dimsByQuest[d.quest_id]) dimsByQuest[d.quest_id] = [];
    const name = d.wellness_dimensions?.name;
    if (name) dimsByQuest[d.quest_id].push(name);
  });

  // 4) Fetch quest_result_ranges labels
  const { data: ranges } = await client
    .from("quest_result_ranges")
    .select("quest_id, label")
    .in("quest_id", questIds);

  const rangesByQuest: Record<string, string[]> = {};
  (ranges ?? []).forEach((r: any) => {
    if (!rangesByQuest[r.quest_id]) rangesByQuest[r.quest_id] = [];
    if (r.label) rangesByQuest[r.quest_id].push(r.label);
  });

  // 5) Count completions from quest_completions
  const { data: completions } = await client
    .from("quest_completions")
    .select("quest_id")
    .in("quest_id", questIds);

  const completionsByQuest: Record<string, number> = {};
  (completions ?? []).forEach((c: any) => {
    completionsByQuest[c.quest_id] = (completionsByQuest[c.quest_id] ?? 0) + 1;
  });

  // 6) Shape response
  const payload = quests.map((q: any) => ({
    id: q.id,
    title: q.title,
    type: q.type,
    status: q.status,
    questionCount: q.total_questions,
    duration: q.estimated_minutes ? `${q.estimated_minutes} min` : null,
    scoringMode: q.scoring_mode,
    xp: q.xp_reward,
    dimensions: dimsByQuest[q.id] ?? [],
    completions: completionsByQuest[q.id] ?? 0,
    productClicks: 0,
    resultRanges: rangesByQuest[q.id] ?? [],
    createdAt: q.created_at,
    updatedAt: q.updated_at,
    adminNote: null,
    imageUrl: q.cover_image_url,
  }));

  return NextResponse.json({ quests: payload });
}

/**
 * POST /api/quests
 * Create a new quest with all related data
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const client = supa(); // service role

  const {
    vendorId,
    title,
    description,
    type,
    scoringMode,
    xpReward,
    estimatedMinutes,
    isAnonymous,
    dimensionIds,
    questions,
    resultRanges,
    status,
  } = body;

  // 1) Insert quest
  const { data: quest, error } = await client
    .from("quests")
    .insert({
      vendor_id: vendorId,
      title,
      description,
      type: type ?? "simple",
      scoring_mode: scoringMode ?? "none",
      xp_reward: xpReward ?? 0,
      estimated_minutes: estimatedMinutes ?? null,
      is_anonymous: isAnonymous ?? false,
      total_questions: Array.isArray(questions) ? questions.length : 0,
      status: status ?? "draft",
      created_by_role: "vendor",
      created_by_id: vendorId,
      requires_approval: status === "pending_approval",
    })
    .select()
    .single();

  if (error || !quest) {
    return NextResponse.json(
      { error: error?.message ?? "Quest create failed" },
      { status: 400 }
    );
  }

  const questId = quest.id;

  // 2) Insert quest_dimensions
  if (Array.isArray(dimensionIds) && dimensionIds.length) {
    const { error: dimErr } = await client.from("quest_dimensions").insert(
      dimensionIds.map((dimId: number, idx: number) => ({
        quest_id: questId,
        dimension_id: dimId,
        is_primary: idx === 0,
      }))
    );
    if (dimErr) {
      return NextResponse.json({ error: dimErr.message }, { status: 400 });
    }
  }

  // 3) Insert default section
  const { data: section, error: secErr } = await client
    .from("quest_sections")
    .insert({
      quest_id: questId,
      title: "Default Section",
      description: null,
      order_index: 0,
    })
    .select()
    .single();

  if (secErr) {
    return NextResponse.json({ error: secErr.message }, { status: 400 });
  }

  const sectionId = section.id;

  // 4) Insert quest_questions with order_index
  // Map builder question types to DB-valid types
  const questionTypeMap: Record<string, string> = {
    short_text: "text_short",
    long_text: "text_long",
    rating: "emoji_scale",
    scale: "number_scale",
    number: "number_scale",
    date: "text_short",
    image_choice: "single_choice",
    ranking: "single_choice",
    // These are already valid:
    single_choice: "single_choice",
    multiple_choice: "multiple_choice",
    yes_no: "yes_no",
  };

  if (Array.isArray(questions) && questions.length) {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const dbType = questionTypeMap[q.type] ?? "single_choice";

      const { data: insertedQ, error: qErr } = await client
        .from("quest_questions")
        .insert({
          quest_id: questId,
          section_id: sectionId,
          text: q.text,
          type: dbType,
          required: q.required ?? true,
          order_index: i,
          weight: q.points ?? null,
        })
        .select()
        .single();

      if (qErr) {
        return NextResponse.json({ error: qErr.message }, { status: 400 });
      }

      // 5) Insert quest_answer_options for choice-type questions
      const choiceTypes = [
        "single_choice",
        "multiple_choice",
        "image_choice",
        "ranking",
      ];
      if (
        choiceTypes.includes(q.type ?? "single_choice") &&
        Array.isArray(q.options) &&
        q.options.length
      ) {
        const { error: optErr } = await client
          .from("quest_answer_options")
          .insert(
            q.options.map((opt: any, idx: number) => ({
              question_id: insertedQ.id,
              text: opt.text,
              points: opt.points ?? 0,
              order_index: idx,
            }))
          );
        if (optErr) {
          return NextResponse.json({ error: optErr.message }, { status: 400 });
        }
      }
    }
  }

  // 6) Insert quest_result_configs
  const { error: rcErr } = await client.from("quest_result_configs").insert({
    quest_id: questId,
    result_type: "no_score_reset",
    scoring_method: "sum",
    vendor_id: vendorId,
  });
  if (rcErr) {
    return NextResponse.json({ error: rcErr.message }, { status: 400 });
  }

  // 7) Insert quest_result_ranges
  if (Array.isArray(resultRanges) && resultRanges.length) {
    const { error: rrErr } = await client.from("quest_result_ranges").insert(
      resultRanges.map((r: any, idx: number) => ({
        quest_id: questId,
        min_score: r.minScore ?? 0,
        max_score: r.maxScore ?? 0,
        label: r.label,
        summary: r.message ?? null,
        color: r.color ?? null,
        order_index: idx,
      }))
    );
    if (rrErr) {
      return NextResponse.json({ error: rrErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, questId });
}

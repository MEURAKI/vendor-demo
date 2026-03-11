// app/api/quests/[id]/route.ts
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
    global: { headers: { Authorization: token } },
  });
}

/**
 * GET /api/quests/[id]
 * Get single quest with full detail
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = supaWithAuth(req);
  const questId = params.id;

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Fetch quest
  const { data: quest, error } = await client
    .from("quests")
    .select("*")
    .eq("id", questId)
    .single();

  if (error || !quest) {
    return NextResponse.json({ error: "Quest not found" }, { status: 404 });
  }

  if (quest.vendor_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch questions with answer options
  const { data: questions } = await client
    .from("quest_questions")
    .select("*")
    .eq("quest_id", questId)
    .order("order_index", { ascending: true });

  const questionIds = (questions ?? []).map((q: any) => q.id);

  let optionsByQuestion: Record<string, any[]> = {};
  if (questionIds.length > 0) {
    const { data: options } = await client
      .from("quest_answer_options")
      .select("*")
      .in("question_id", questionIds)
      .order("order_index", { ascending: true });

    (options ?? []).forEach((o: any) => {
      if (!optionsByQuestion[o.question_id])
        optionsByQuestion[o.question_id] = [];
      optionsByQuestion[o.question_id].push(o);
    });
  }

  // Fetch dimensions
  const { data: dimensions } = await client
    .from("quest_dimensions")
    .select("quest_id, dimension_id, is_primary, wellness_dimensions ( name )")
    .eq("quest_id", questId);

  // Fetch result ranges
  const { data: resultRanges } = await client
    .from("quest_result_ranges")
    .select("*")
    .eq("quest_id", questId)
    .order("order_index", { ascending: true });

  // Fetch result config
  const { data: resultConfig } = await client
    .from("quest_result_configs")
    .select("*")
    .eq("quest_id", questId)
    .maybeSingle();

  // Shape response
  const payload = {
    id: quest.id,
    title: quest.title,
    description: quest.description,
    type: quest.type,
    status: quest.status,
    scoringMode: quest.scoring_mode,
    xpReward: quest.xp_reward,
    duration: quest.estimated_minutes ? `${quest.estimated_minutes} min` : "5 min",
    estimatedMinutes: quest.estimated_minutes,
    isAnonymous: quest.is_anonymous,
    coverImageUrl: quest.cover_image_url,
    createdAt: quest.created_at,
    updatedAt: quest.updated_at,
    dimensions: (dimensions ?? []).map(
      (d: any) => d.wellness_dimensions?.name ?? "Unknown"
    ),
    dimensionIds: (dimensions ?? []).map((d: any) => d.dimension_id),
    questions: (questions ?? []).map((q: any) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      required: q.required,
      points: q.weight ?? 0,
      orderIndex: q.order_index,
      options: (optionsByQuestion[q.id] ?? []).map((o: any) => ({
        id: o.id,
        text: o.text,
        points: o.points,
        orderIndex: o.order_index,
      })),
    })),
    resultRanges: (resultRanges ?? []).map((r: any) => ({
      id: r.id,
      label: r.label,
      minScore: r.min_score,
      maxScore: r.max_score,
      headline: r.headline,
      summary: r.summary,
      color: r.color,
      orderIndex: r.order_index,
    })),
    resultConfig: resultConfig
      ? {
          id: resultConfig.id,
          resultType: resultConfig.result_type,
          scoringMethod: resultConfig.scoring_method,
        }
      : null,
  };

  return NextResponse.json({ quest: payload });
}

/**
 * PUT /api/quests/[id]
 * Update quest with all related data
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const questId = params.id;
  const client = supa(); // service role

  // Verify ownership via auth client
  const authClient = supaWithAuth(req);
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: existing } = await client
    .from("quests")
    .select("id, vendor_id")
    .eq("id", questId)
    .single();

  if (!existing || existing.vendor_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const {
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

  // 1) Update quest row
  const { error: updateErr } = await client
    .from("quests")
    .update({
      title,
      description,
      type: type ?? "simple",
      scoring_mode: scoringMode ?? "none",
      xp_reward: xpReward ?? 0,
      estimated_minutes: estimatedMinutes ?? null,
      is_anonymous: isAnonymous ?? false,
      total_questions: Array.isArray(questions) ? questions.length : 0,
      status: status ?? "draft",
      requires_approval: status === "pending_approval",
      updated_at: new Date().toISOString(),
    })
    .eq("id", questId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  // 2) Delete existing related data and re-insert
  // Delete answer options (need question IDs first)
  const { data: oldQuestions } = await client
    .from("quest_questions")
    .select("id")
    .eq("quest_id", questId);

  const oldQIds = (oldQuestions ?? []).map((q: any) => q.id);
  if (oldQIds.length > 0) {
    await client
      .from("quest_answer_options")
      .delete()
      .in("question_id", oldQIds);
  }

  await client.from("quest_questions").delete().eq("quest_id", questId);
  await client.from("quest_dimensions").delete().eq("quest_id", questId);
  await client.from("quest_result_ranges").delete().eq("quest_id", questId);
  await client.from("quest_result_configs").delete().eq("quest_id", questId);
  await client.from("quest_sections").delete().eq("quest_id", questId);

  // 3) Re-insert dimensions
  if (Array.isArray(dimensionIds) && dimensionIds.length) {
    await client.from("quest_dimensions").insert(
      dimensionIds.map((dimId: number, idx: number) => ({
        quest_id: questId,
        dimension_id: dimId,
        is_primary: idx === 0,
      }))
    );
  }

  // 4) Re-insert default section
  const { data: section } = await client
    .from("quest_sections")
    .insert({
      quest_id: questId,
      title: "Default Section",
      description: null,
      order_index: 0,
    })
    .select()
    .single();

  const sectionId = section?.id;

  // 5) Re-insert questions + options
  const questionTypeMap: Record<string, string> = {
    short_text: "text_short",
    long_text: "text_long",
    rating: "emoji_scale",
    scale: "number_scale",
    number: "number_scale",
    date: "text_short",
    image_choice: "single_choice",
    ranking: "single_choice",
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

      if (qErr || !insertedQ) continue;

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
        await client.from("quest_answer_options").insert(
          q.options.map((opt: any, idx: number) => ({
            question_id: insertedQ.id,
            text: opt.text,
            points: opt.points ?? 0,
            order_index: idx,
          }))
        );
      }
    }
  }

  // 6) Re-insert result config
  await client.from("quest_result_configs").insert({
    quest_id: questId,
    result_type: "no_score_reset",
    scoring_method: "sum",
    vendor_id: existing.vendor_id,
  });

  // 7) Re-insert result ranges
  if (Array.isArray(resultRanges) && resultRanges.length) {
    await client.from("quest_result_ranges").insert(
      resultRanges.map((r: any, idx: number) => ({
        quest_id: questId,
        min_score: r.minScore ?? 0,
        max_score: r.maxScore ?? 0,
        label: r.label,
        summary: r.message ?? r.summary ?? null,
        color: r.color ?? null,
        order_index: idx,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/quests/[id]
 * Delete quest (only draft or rejected)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const questId = params.id;
  const client = supaWithAuth(req);

  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const serviceClient = supa();

  const { data: quest } = await serviceClient
    .from("quests")
    .select("id, vendor_id, status")
    .eq("id", questId)
    .single();

  if (!quest || quest.vendor_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["draft", "rejected"].includes(quest.status)) {
    return NextResponse.json(
      { error: "Can only delete draft or rejected quests" },
      { status: 400 }
    );
  }

  // Delete related data first
  const { data: questions } = await serviceClient
    .from("quest_questions")
    .select("id")
    .eq("quest_id", questId);

  const qIds = (questions ?? []).map((q: any) => q.id);
  if (qIds.length > 0) {
    await serviceClient
      .from("quest_answer_options")
      .delete()
      .in("question_id", qIds);
  }

  await serviceClient.from("quest_questions").delete().eq("quest_id", questId);
  await serviceClient
    .from("quest_dimensions")
    .delete()
    .eq("quest_id", questId);
  await serviceClient
    .from("quest_result_ranges")
    .delete()
    .eq("quest_id", questId);
  await serviceClient
    .from("quest_result_configs")
    .delete()
    .eq("quest_id", questId);
  await serviceClient.from("quest_sections").delete().eq("quest_id", questId);
  await serviceClient.from("quests").delete().eq("id", questId);

  return NextResponse.json({ ok: true });
}

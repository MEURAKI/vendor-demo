// app/api/quests/[id]/duplicate/route.ts
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
 * POST /api/quests/[id]/duplicate
 * Duplicate a quest
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authClient = supaWithAuth(req);
  const serviceClient = supa();

  // 1) Auth check
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // 2) Verify ownership
  const { data: original, error } = await authClient
    .from("quests")
    .select("*")
    .eq("id", id)
    .eq("vendor_id", user.id)
    .single();

  if (error || !original) {
    return NextResponse.json(
      { error: "Quest not found" },
      { status: 404 }
    );
  }

  // 3) Fetch all related data
  const { data: origQuestions } = await serviceClient
    .from("quest_questions")
    .select("*")
    .eq("quest_id", id)
    .order("order_index", { ascending: true });

  const origQIds = (origQuestions ?? []).map((q: any) => q.id);

  let origOptions: any[] = [];
  if (origQIds.length) {
    const { data } = await serviceClient
      .from("quest_answer_options")
      .select("*")
      .in("question_id", origQIds)
      .order("order_index", { ascending: true });
    origOptions = data ?? [];
  }

  const { data: origDimensions } = await serviceClient
    .from("quest_dimensions")
    .select("*")
    .eq("quest_id", id);

  const { data: origRanges } = await serviceClient
    .from("quest_result_ranges")
    .select("*")
    .eq("quest_id", id)
    .order("order_index", { ascending: true });

  const { data: origConfigs } = await serviceClient
    .from("quest_result_configs")
    .select("*")
    .eq("quest_id", id);

  const { data: origSections } = await serviceClient
    .from("quest_sections")
    .select("*")
    .eq("quest_id", id)
    .order("order_index", { ascending: true });

  // 4) Insert the copied quest
  const { data: newQuest, error: insertErr } = await serviceClient
    .from("quests")
    .insert({
      vendor_id: original.vendor_id,
      title: `${original.title} (Copy)`,
      description: original.description,
      type: original.type,
      category: original.category,
      status: "draft",
      result_type: original.result_type,
      xp_reward: original.xp_reward,
      estimated_minutes: original.estimated_minutes,
      total_questions: original.total_questions,
      cover_image_url: original.cover_image_url,
      is_anonymous: original.is_anonymous,
      is_template: original.is_template,
      scoring_mode: original.scoring_mode,
      frequency: original.frequency,
      difficulty: original.difficulty,
      primary_dimension: original.primary_dimension,
      retake_comparison: original.retake_comparison,
      tags: original.tags,
      dimension_8d: original.dimension_8d,
      created_by_role: original.created_by_role,
      created_by_id: original.created_by_id,
      requires_approval: false,
    })
    .select()
    .single();

  if (insertErr || !newQuest) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to duplicate quest" },
      { status: 400 }
    );
  }

  const newQuestId = newQuest.id;

  // 5) Copy dimensions
  if ((origDimensions ?? []).length) {
    await serviceClient.from("quest_dimensions").insert(
      origDimensions!.map((d: any) => ({
        quest_id: newQuestId,
        dimension_id: d.dimension_id,
        is_primary: d.is_primary,
      }))
    );
  }

  // 6) Copy sections and build section ID mapping
  const sectionIdMap: Record<string, string> = {};

  for (const sec of origSections ?? []) {
    const { data: newSec } = await serviceClient
      .from("quest_sections")
      .insert({
        quest_id: newQuestId,
        title: sec.title,
        description: sec.description,
        order_index: sec.order_index,
      })
      .select()
      .single();

    if (newSec) {
      sectionIdMap[sec.id] = newSec.id;
    }
  }

  // 7) Copy questions and answer options
  const optionsByOldQ: Record<string, any[]> = {};
  origOptions.forEach((o: any) => {
    if (!optionsByOldQ[o.question_id]) optionsByOldQ[o.question_id] = [];
    optionsByOldQ[o.question_id].push(o);
  });

  for (const q of origQuestions ?? []) {
    const { data: newQ } = await serviceClient
      .from("quest_questions")
      .insert({
        quest_id: newQuestId,
        section_id: q.section_id ? (sectionIdMap[q.section_id] ?? null) : null,
        text: q.text,
        type: q.type,
        required: q.required,
        order_index: q.order_index,
        placeholder_text: q.placeholder_text,
        min_value: q.min_value,
        max_value: q.max_value,
        timer_seconds: q.timer_seconds,
        branch_rules: q.branch_rules,
        keyword_scores: q.keyword_scores,
        slider_point_ranges: q.slider_point_ranges,
        dimension_mapping: q.dimension_mapping,
        weight: q.weight,
        reverse_score: q.reverse_score,
        critical_flag_enabled: q.critical_flag_enabled,
        auto_advance: q.auto_advance,
        helper_text: q.helper_text,
        show_condition: q.show_condition,
        after_action: q.after_action,
      })
      .select()
      .single();

    if (!newQ) continue;

    const opts = optionsByOldQ[q.id] ?? [];
    if (opts.length) {
      await serviceClient.from("quest_answer_options").insert(
        opts.map((o: any) => ({
          question_id: newQ.id,
          text: o.text,
          emoji: o.emoji,
          points: o.points,
          personality_tag: o.personality_tag,
          result_key: o.result_key,
          order_index: o.order_index,
        }))
      );
    }
  }

  // 8) Copy result configs
  for (const rc of origConfigs ?? []) {
    await serviceClient.from("quest_result_configs").insert({
      quest_id: newQuestId,
      result_type: rc.result_type,
      scoring_method: rc.scoring_method,
      max_possible_score: rc.max_possible_score,
      descriptive_results: rc.descriptive_results,
      personality_results: rc.personality_results,
      anonymous_config: rc.anonymous_config,
      reset_config: rc.reset_config,
      result_template: rc.result_template,
      personality_tie_breaker: rc.personality_tie_breaker,
      show_tag_breakdown: rc.show_tag_breakdown,
      show_score_secondary: rc.show_score_secondary,
      score_per_section: rc.score_per_section,
      data_rich_config: rc.data_rich_config,
      clinical_config: rc.clinical_config,
      vendor_scope: rc.vendor_scope,
      vendor_id: rc.vendor_id,
    });
  }

  // 9) Copy result ranges
  if ((origRanges ?? []).length) {
    await serviceClient.from("quest_result_ranges").insert(
      origRanges!.map((r: any) => ({
        quest_id: newQuestId,
        min_score: r.min_score,
        max_score: r.max_score,
        label: r.label,
        color: r.color,
        emoji: r.emoji,
        headline: r.headline,
        summary: r.summary,
        detailed_text: r.detailed_text,
        cta_text: r.cta_text,
        cta_link: r.cta_link,
        cta_style: r.cta_style,
        recommended_product_ids: r.recommended_product_ids,
        order_index: r.order_index,
        recommended_actions: r.recommended_actions,
        follow_up_quest_id: r.follow_up_quest_id,
        retake_days_suggestion: r.retake_days_suggestion,
        profile_label: r.profile_label,
        hero_product_id: r.hero_product_id,
        disclaimer: r.disclaimer,
      }))
    );
  }

  return NextResponse.json({ ok: true, questId: newQuestId });
}

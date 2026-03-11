// app/api/quests/analytics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
 * GET /api/quests/analytics
 * Analytics data for vendor's quests
 */
export async function GET(req: NextRequest) {
  const client = supaWithAuth(req);

  // 1) Auth check
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

  // 2) Fetch vendor's published/approved quests
  const { data: quests, error } = await client
    .from("quests")
    .select("id, title, type, status, total_questions, xp_reward, scoring_mode, created_at")
    .eq("vendor_id", user.id)
    .in("status", ["approved", "published"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const questIds = (quests ?? []).map((q: any) => q.id);

  // 3) Get completion counts (currently empty, but structured correctly)
  let completionsByQuest: Record<string, number> = {};
  if (questIds.length) {
    const { data: completions } = await client
      .from("quest_completions")
      .select("quest_id")
      .in("quest_id", questIds);

    (completions ?? []).forEach((c: any) => {
      completionsByQuest[c.quest_id] =
        (completionsByQuest[c.quest_id] ?? 0) + 1;
    });
  }

  // 4) Get result ranges with recommended_product_ids
  let productClicksByQuest: Record<string, number> = {};
  let totalLinkedProducts = 0;

  if (questIds.length) {
    const { data: ranges } = await client
      .from("quest_result_ranges")
      .select("quest_id, recommended_product_ids")
      .in("quest_id", questIds);

    (ranges ?? []).forEach((r: any) => {
      const pids = r.recommended_product_ids ?? [];
      if (pids.length > 0) {
        totalLinkedProducts += pids.length;
        productClicksByQuest[r.quest_id] =
          (productClicksByQuest[r.quest_id] ?? 0) + pids.length;
      }
    });
  }

  // 5) Compute aggregate stats
  const totalCompletions = Object.values(completionsByQuest).reduce(
    (sum, c) => sum + c,
    0
  );

  const questBreakdown = (quests ?? []).map((q: any) => ({
    id: q.id,
    title: q.title,
    type: q.type,
    status: q.status,
    completions: completionsByQuest[q.id] ?? 0,
    productLinks: productClicksByQuest[q.id] ?? 0,
    productClicks: 0, // no click tracking yet
    createdAt: q.created_at,
  }));

  // 6) Platform quests performance -- check if any have vendor's products linked
  const { data: platformQuests } = await client
    .from("platform_quests")
    .select("id, name, category, frequency, xp, dimension, usage_count, status")
    .eq("status", "active");

  const platformQuestIds = (platformQuests ?? []).map((pq: any) => pq.id);

  let platformPerformance: any[] = [];

  if (platformQuestIds.length) {
    const { data: platformRanges } = await client
      .from("quest_result_ranges")
      .select("quest_id, recommended_product_ids")
      .in("quest_id", platformQuestIds);

    platformPerformance = (platformQuests ?? []).map((pq: any) => {
      const ranges = (platformRanges ?? []).filter(
        (r: any) => r.quest_id === pq.id
      );
      const linkedProducts = ranges.reduce((sum: number, r: any) => {
        return sum + (r.recommended_product_ids ?? []).length;
      }, 0);

      return {
        id: pq.id,
        name: pq.name,
        category: pq.category,
        usageCount: pq.usage_count ?? 0,
        linkedProducts,
        productClicks: 0, // no click tracking yet
      };
    });
  }

  return NextResponse.json({
    stats: {
      totalQuests: (quests ?? []).length,
      totalCompletions,
      totalLinkedProducts,
      totalProductClicks: 0, // no click tracking yet
      averageCompletionRate: 0,
    },
    questBreakdown,
    platformPerformance,
  });
}

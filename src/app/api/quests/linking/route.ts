// app/api/quests/linking/route.ts
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
 * GET /api/quests/linking
 * Get platform quests + vendor's own quests with their product links
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

  // 2) Fetch active platform quests
  const { data: platformQuests } = await client
    .from("platform_quests")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  // 3) For platform quests, fetch result ranges
  const platformQuestIds = (platformQuests ?? []).map((pq: any) => pq.id);

  let platformRanges: any[] = [];
  if (platformQuestIds.length) {
    const { data } = await client
      .from("quest_result_ranges")
      .select("*")
      .in("quest_id", platformQuestIds)
      .order("order_index", { ascending: true });
    platformRanges = data ?? [];
  }

  const platformRangesByQuest: Record<string, any[]> = {};
  platformRanges.forEach((r: any) => {
    if (!platformRangesByQuest[r.quest_id])
      platformRangesByQuest[r.quest_id] = [];
    platformRangesByQuest[r.quest_id].push({
      id: r.id,
      label: r.label,
      minScore: r.min_score,
      maxScore: r.max_score,
      color: r.color,
      recommendedProductIds: r.recommended_product_ids ?? [],
    });
  });

  const shapedPlatformQuests = (platformQuests ?? []).map((pq: any) => ({
    id: pq.id,
    name: pq.name,
    description: pq.description,
    category: pq.category,
    frequency: pq.frequency,
    duration: pq.duration,
    icon: pq.icon,
    xp: pq.xp,
    dimension: pq.dimension,
    usageCount: pq.usage_count,
    resultRanges: platformRangesByQuest[pq.id] ?? [],
  }));

  // 4) Fetch vendor's own quests with result ranges
  const { data: myQuests } = await client
    .from("quests")
    .select("id, title, type, status, scoring_mode, created_at")
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false });

  const myQuestIds = (myQuests ?? []).map((q: any) => q.id);

  let myRanges: any[] = [];
  if (myQuestIds.length) {
    const { data } = await client
      .from("quest_result_ranges")
      .select("*")
      .in("quest_id", myQuestIds)
      .order("order_index", { ascending: true });
    myRanges = data ?? [];
  }

  const myRangesByQuest: Record<string, any[]> = {};
  myRanges.forEach((r: any) => {
    if (!myRangesByQuest[r.quest_id]) myRangesByQuest[r.quest_id] = [];
    myRangesByQuest[r.quest_id].push({
      id: r.id,
      label: r.label,
      minScore: r.min_score,
      maxScore: r.max_score,
      color: r.color,
      recommendedProductIds: r.recommended_product_ids ?? [],
    });
  });

  const shapedMyQuests = (myQuests ?? []).map((q: any) => ({
    id: q.id,
    title: q.title,
    type: q.type,
    status: q.status,
    scoringMode: q.scoring_mode,
    createdAt: q.created_at,
    resultRanges: myRangesByQuest[q.id] ?? [],
  }));

  // 5) Fetch vendor's products and services for catalog dropdown
  const { data: products } = await client
    .from("products")
    .select("id, name, status, image_url")
    .eq("vendor_id", user.id)
    .eq("status", "active")
    .order("name", { ascending: true });

  const { data: services } = await client
    .from("services")
    .select("id, name, status, image_url")
    .eq("vendor_id", user.id)
    .eq("status", "active")
    .order("name", { ascending: true });

  const catalog = [
    ...(products ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      type: "product" as const,
      status: p.status,
      imageUrl: p.image_url,
    })),
    ...(services ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      type: "service" as const,
      status: s.status,
      imageUrl: s.image_url,
    })),
  ];

  return NextResponse.json({
    platformQuests: shapedPlatformQuests,
    myQuests: shapedMyQuests,
    catalog,
  });
}

/**
 * POST /api/quests/linking
 * Link a product to a quest result range
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const client = supa(); // service role for writes

  const { questId, rangeLabel, productId } = body;

  if (!questId || !rangeLabel || !productId) {
    return NextResponse.json(
      { error: "questId, rangeLabel, and productId are required" },
      { status: 400 }
    );
  }

  // 1) Find the result range row matching questId + rangeLabel
  const { data: range, error: fetchErr } = await client
    .from("quest_result_ranges")
    .select("id, recommended_product_ids")
    .eq("quest_id", questId)
    .eq("label", rangeLabel)
    .single();

  if (fetchErr || !range) {
    return NextResponse.json(
      { error: "Result range not found" },
      { status: 404 }
    );
  }

  // 2) Append productId to recommended_product_ids array
  const currentIds: string[] = range.recommended_product_ids ?? [];

  if (currentIds.includes(productId)) {
    return NextResponse.json(
      { error: "Product already linked to this range" },
      { status: 400 }
    );
  }

  const updatedIds = [...currentIds, productId];

  const { error: updateErr } = await client
    .from("quest_result_ranges")
    .update({ recommended_product_ids: updatedIds })
    .eq("id", range.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

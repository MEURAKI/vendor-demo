// app/api/quests/linking/[linkId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

/**
 * DELETE /api/quests/linking/[linkId]
 * Remove a product link from a result range
 * linkId = result_range_id, productId from query params
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params;
  const client = supa(); // service role

  // Get productId from query params
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");

  if (!productId) {
    return NextResponse.json(
      { error: "productId query parameter is required" },
      { status: 400 }
    );
  }

  // 1) Fetch the result range row
  const { data: range, error: fetchErr } = await client
    .from("quest_result_ranges")
    .select("id, recommended_product_ids")
    .eq("id", linkId)
    .single();

  if (fetchErr || !range) {
    return NextResponse.json(
      { error: "Result range not found" },
      { status: 404 }
    );
  }

  // 2) Remove productId from the array
  const currentIds: string[] = range.recommended_product_ids ?? [];
  const updatedIds = currentIds.filter((id: string) => id !== productId);

  const { error: updateErr } = await client
    .from("quest_result_ranges")
    .update({ recommended_product_ids: updatedIds })
    .eq("id", range.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

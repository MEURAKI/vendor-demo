// app/api/bundles/search-items/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function GET(req: Request) {
  const client = supa();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  let query = client
    .from("inventory_items")
    .select(
      "id, product_id, variant_id, name, price_cents, stock, image_url, status"
    )
    .gt("stock", 0) // only in-stock items
    .order("name", { ascending: true })
    .limit(50);

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const items =
    data?.map((row) => ({
      id: row.id,
      type: row.variant_id ? "variant" as const : "product",
      productId: row.product_id,
      variantId: row.variant_id,
      name: row.name,
      priceCents: row.price_cents,
      stock: row.stock,
      imageUrl: row.image_url,
    })) ?? [];

  return NextResponse.json({ items });
}
// app/api/bundles/candidates/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1) get all products for this vendor
  const { data: products, error } = await supabase
    .from("products")
    .select("id,name,price_cents,inventory_qty")
    .eq("vendor_id", auth.user.id)
    .eq("deleted", false);

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!products?.length) {
    return NextResponse.json({ items: [] });
  }

  const productIds = products.map((p) => p.id);

  // 2) count variants per product
  const { data: variantRows, error: variantError } = await supabase
    .from("product_variants")
    .select("product_id, id")
    .in("product_id", productIds);

  if (variantError) {
    console.error(variantError);
    return NextResponse.json({ error: variantError.message }, { status: 400 });
  }

  const variantCountByProduct: Record<string, number> = {};
  for (const row of variantRows ?? []) {
    const pid = row.product_id as string;
    variantCountByProduct[pid] = (variantCountByProduct[pid] ?? 0) + 1;
  }

  // 3) map to BundleCandidateItem[]
  const items = products.map((p) => ({
    id: p.id, // use product id as unique key
    productId: p.id,
    name: p.name,
    priceCents: p.price_cents ?? 0,
    stock: p.inventory_qty ?? 0,
    variantCount: variantCountByProduct[p.id] ?? 0,
  }));

  return NextResponse.json({ items });
}
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function POST(req: Request) {
  const body = await req.json();
  const client = supa();

  const ids: string[] = body.productIds ?? [];
  if (!ids.length) {
    return NextResponse.json({ error: "No products provided" }, { status: 400 });
  }

  // Example: update price / status / discount – extend as you like
  const patch: any = {};
  if (typeof body.priceCents === "number") {
    patch.price_cents = body.priceCents;
  }
  if (body.status) {
    patch.status = body.status;
  }
  if (body.discount) {
    patch.discount_type = body.discount.type;
    patch.discount_value = body.discount.value;
    patch.discount_start_at = body.discount.start;
    patch.discount_end_at = body.discount.end;
    patch.discount_all_variants = !!body.discount.applyToVariants;
  }

  if (Object.keys(patch).length) {
    patch.updated_at = new Date().toISOString();
    await client.from("products").update(patch).in("id", ids);
  }

  // You can also update wellness, categories, tags here…

  return NextResponse.json({ ok: true });
}
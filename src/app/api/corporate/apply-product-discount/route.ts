// app/api/corporate/apply-product-discount/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role key (server only)
);

type DiscountType = "percent" | "fixed";

function calcCorporatePriceCents(priceCents: number, type: DiscountType, value: number) {
  const p = Math.max(0, priceCents || 0);
  const v = Math.max(0, value || 0);

  if (type === "percent") {
    const pct = Math.max(0, Math.min(100, v));
    return Math.max(0, Math.round(p - (p * pct) / 100));
  }
  // fixed is in SGD dollars, convert to cents
  const fixedCents = Math.round(v * 100);
  return Math.max(0, p - fixedCents);
}

export async function POST(req: Request) {
  const { vendorId } = await req.json();

  const { data: vb, error: vbErr } = await supabaseAdmin
    .from("vendor_business")
    .select("id, corporate_program_enabled, corporate_discount_products, corporate_product_discount_type, corporate_product_discount_value, updated_at")
    .eq("id", vendorId)
    .maybeSingle();

  if (vbErr || !vb) {
    return NextResponse.json({ error: "Subscriber settings not found" }, { status: 400 });
  }

  if (!vb.corporate_program_enabled || !vb.corporate_discount_products) {
    // if disabled, you can either null out snapshots or keep last applied snapshot
    return NextResponse.json({ ok: true, skipped: true });
  }

  const type = (vb.corporate_product_discount_type || "percent") as DiscountType;
  const value = Number(vb.corporate_product_discount_value ?? 0);

  const { data: products, error: pErr } = await supabaseAdmin
    .from("products")
    .select("id, priceCents")
    .eq("vendor_id", vendorId);

  if (pErr) return NextResponse.json({ error: "Failed to load products" }, { status: 500 });

  const updates = (products || []).map((p) => ({
    id: p.id,
    corporate_discount_type: type,
    corporate_discount_value: value,
    corporate_price_cents: calcCorporatePriceCents(p.priceCents ?? 0, type, value),
    corporate_discount_updated_at: new Date().toISOString(),
  }));

  // bulk upsert by id
  const { error: upErr } = await supabaseAdmin
    .from("products")
    .upsert(updates, { onConflict: "id" });

  if (upErr) return NextResponse.json({ error: "Failed to apply corporate discount" }, { status: 500 });

  return NextResponse.json({ ok: true, updated: updates.length });
}
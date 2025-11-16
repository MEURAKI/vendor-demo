import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

/**
 * GET /api/products/[productId]/variants
 *
 * Returns:
 * {
 *   optionGroups: VariantOptionGroup[],
 *   variants: {
 *     id,
 *     sku,
 *     priceCents,
 *     inventoryQty,
 *     imageUrl,
 *     options
 *   }[]
 * }
 */
export async function GET(
  req: Request,
  context: { params: { productId: string } }
) {
  const { productId } = context.params;
  const client = supa();

  // 1) Load option groups for this product
  const { data: groups, error: gErr } = await client
    .from("product_option_groups")
    .select("id, name, kind")
    .eq("product_id", productId)
    .order("position", { ascending: true });

  if (gErr) {
    return NextResponse.json(
      { error: gErr.message ?? "Failed to load option groups" },
      { status: 400 }
    );
  }

  const groupIds = (groups ?? []).map((g) => g.id);

  // 2) Load option values for these groups
  let values: any[] = [];
  if (groupIds.length > 0) {
    const { data: vData, error: vErr } = await client
      .from("product_option_values")
      .select("id, group_id, label, color_hex")
      .in("group_id", groupIds)
      .order("position", { ascending: true });

    if (vErr) {
      return NextResponse.json(
        { error: vErr.message ?? "Failed to load option values" },
        { status: 400 }
      );
    }

    values = vData ?? [];
  }

  // Shape them as your frontend expects (VariantOptionGroup[])
  const optionGroups = (groups ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    kind: g.kind, // "size" | "color" | "volume" | "weight" | "custom"
    values: values
      .filter((v) => v.group_id === g.id)
      .map((v) => ({
        id: v.id,
        label: v.label,
        colorHex: v.color_hex ?? undefined,
      })),
  }));

  // 3) Load variants for this product
  const { data: variants, error: varErr } = await client
    .from("product_variants")
    .select("id, sku, price_cents, inventory_qty, image_url, options_json")
    .eq("product_id", productId)
    .order("position", { ascending: true });

  if (varErr) {
    return NextResponse.json(
      { error: varErr.message ?? "Failed to load variants" },
      { status: 400 }
    );
  }

  // Shape variants for your frontend
  const shapedVariants =
    (variants ?? []).map((v) => ({
      id: v.id,
      sku: v.sku,
      priceCents: v.price_cents,
      inventoryQty: v.inventory_qty ?? 0,
      imageUrl: v.image_url,
      options: v.options_json ?? {}, // Record<string, string>
    })) ?? [];

  return NextResponse.json({
    optionGroups,
    variants: shapedVariants,
  });
}

/**
 * PUT /api/products/[productId]/variants
 * Body:
 * {
 *   variants: {
 *     id: string;
 *     price: number;      // in dollars
 *     inventory: number;
 *     imageUrl?: string | null;
 *   }[]
 * }
 */
export async function PUT(
  req: Request,
  { params }: { params: { productId: string } }
) {
  const { productId } = params;
  const body = await req.json();
  const client = supa();

  const incoming = body.variants ?? [];

  // optional: wipe existing variants first
  await client.from("product_variants").delete().eq("product_id", productId);

  const rows = incoming.map((v: any, idx: number) => ({
    product_id: productId,
    sku: v.sku,
    price_cents:
      typeof v.priceCents === "number"
        ? v.priceCents
        : Math.round((v.price ?? 0) * 100),
    inventory_qty: v.inventory ?? 0,
    image_url: v.imageUrl ?? null,
    position: idx,
    is_active: (v.inventory ?? 0) > 0,
    // 🔑 NEVER null – always normalize to an object
    options_json:
      v.options_json ??
      v.optionsJson ??
      v.options ??
      {}, // this guarantees NOT NULL
  }));

  const { error } = await client.from("product_variants").insert(rows);

  if (error) {
    console.error("variant save error", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
// app/api/bundles/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// ---------- GET: list bundles for logged-in vendor ----------
export async function GET(req: Request) {
  const client = supa();

  // 0) Auth – same pattern you use elsewhere
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : undefined;

  if (!token) {
    return NextResponse.json(
      { error: "Missing access token" },
      { status: 401 }
    );
  }

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      { error: userError?.message ?? "Unauthenticated" },
      { status: 401 }
    );
  }

  const vendorId = user.id;

  // 1) Load bundles for this vendor
  const { data: bundlesData, error: bundlesError } = await client
    .from("bundles")
    .select(
      `
        id,
        vendor_id,
        name,
        base_sku,
        price_cents,
        discount_type,
        discount_value,
        discount_start,
        discount_end,
        status,
        image_url
      `
    )
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (bundlesError) {
    console.error("[bundles GET] bundlesError:", bundlesError);
    return NextResponse.json(
      { error: bundlesError.message },
      { status: 400 }
    );
  }

  const bundles = bundlesData ?? [];
  if (!bundles.length) {
    return NextResponse.json({ bundles: [] });
  }

  // 2) Get product counts per bundle (bundle_items)
  const bundleIds = bundles.map((b) => b.id);

  const { data: bundleItemsRows, error: itemsError } = await client
    .from("bundle_items")
    .select("bundle_id")
    .in("bundle_id", bundleIds);

  if (itemsError) {
    console.error("[bundles GET] itemsError:", itemsError);
    return NextResponse.json(
      { error: itemsError.message },
      { status: 400 }
    );
  }

  const countsMap = new Map<string, number>();
  (bundleItemsRows ?? []).forEach((row: any) => {
    const id = row.bundle_id as string;
    countsMap.set(id, (countsMap.get(id) ?? 0) + 1);
  });

  // 3) Map + add discountDisplay + productsIncluded
  const mapped = bundles.map((b: any) => {
    const productsIncluded = countsMap.get(b.id) ?? 0;

    const discountType = b.discount_type as "fixed" | "percent" | null;
    const discountValue = b.discount_value as number | null;

    let discountDisplay: string | null = null;
    if (discountType && discountValue != null) {
      if (discountType === "fixed") {
        // assuming discount_value is in dollars (not cents),
        // if you store cents, divide by 100 instead.
        discountDisplay = `$${Number(discountValue).toFixed(2)}`;
      } else if (discountType === "percent") {
        discountDisplay = `${Number(discountValue)}%`;
      }
    }

    return {
      id: b.id as string,
      name: b.name as string,
      type: "Multiple" as const, // or compute if needed
      productsIncluded,          // ✅ number of products in the bundle
      sku: b.base_sku as string,
      priceCents: b.price_cents as number,
      discountType,
      discountValue,
      discountDisplay,           // ✅ "$5.00" or "5%"
      status: b.status as "draft" | "active" | "inactive" | "out_of_stock" | "published",
      imageUrl: b.image_url as string | null,
    };
  });

  return NextResponse.json({ bundles: mapped });
}

// POST / PUT handlers stay as you have them

// POST /api/bundles  -> create bundle
export async function POST(req: Request) {
  const body = await req.json();
  const client = supa();

  // --- 1. Insert main bundle row ---
  const { data: bundle, error: bundleErr } = await client
    .from("bundles")
    .insert({
      vendor_id: body.vendorId ?? null,
      name: body.name,
      description: body.description ?? "",
      sku: body.sku,
      base_sku: body.base_sku ?? body.sku,
      status: body.status ?? "draft",
      price_cents: body.priceCents ?? 0,
      // ⬇️ align with columns used in GET/PUT (discount_start / discount_end)
      discount_type: body.discount?.type ?? null,
      discount_value: body.discount?.value ?? null,
      discount_start: body.discount?.start ?? null,
      discount_end: body.discount?.end ?? null,
      image_url: body.imageUrl ?? null,
      inventory_qty: 0,
    })
    .select("*")
    .single();

  if (bundleErr || !bundle) {
    console.error("[bundles POST] bundle error:", bundleErr);
    return NextResponse.json(
      { error: bundleErr?.message ?? "Failed to create bundle" },
      { status: 400 }
    );
  }

  // --- 2. Insert bundle items (products / variants) ---
  if (Array.isArray(body.items) && body.items.length > 0) {
    const itemRows = body.items.map((item: any, idx: number) => {
      const variantId = item.variantId ?? null;
      const productId = item.productId ?? variantId; // ✅ fallback so one is always set

      const kind =
        item.kind ??
        (variantId ? "variant" : "single"); // default based on variantId

      return {
        bundle_id: bundle.id,
        product_id: productId,
        variant_id: variantId,
        item_name: item.itemName,
        item_price_cents: item.itemPriceCents ?? 0,
        quantity: item.quantity ?? 1,
        position: idx,

        // 🔹 NEW FIELDS for variant / single behaviour
        kind,
        variant_label: item.variantLabel ?? null,
        choice_count:
          typeof item.choiceCount === "number" ? item.choiceCount : null,
        is_multiple:
          typeof item.isMultiple === "boolean" ? item.isMultiple : null,
      };
    });

    const { error: itemsErr } = await client
      .from("bundle_items")
      .insert(itemRows);

    if (itemsErr) {
      console.error("[bundles POST] items error:", itemsErr);
      return NextResponse.json({ error: itemsErr.message }, { status: 400 });
    }
  }

  // --- 3. Wellness / categories / tags ---

  if (
    Array.isArray(body.wellnessDimensions) &&
    body.wellnessDimensions.length
  ) {
    await client.from("bundle_wellness_dimensions").insert(
      body.wellnessDimensions.map((dimId: string | number) => ({
        bundle_id: bundle.id,
        dimension_id: dimId,
      }))
    );
  }

  if (Array.isArray(body.categories) && body.categories.length) {
    await client.from("bundle_categories").insert(
      body.categories.map((cat: string) => ({
        bundle_id: bundle.id,
        category: cat,
      }))
    );
  }

  if (Array.isArray(body.tags) && body.tags.length) {
    await client.from("bundle_tags").insert(
      body.tags.map((tag: string) => ({
        bundle_id: bundle.id,
        tag,
      }))
    );
  }

  return NextResponse.json({ ok: true, bundleId: bundle.id });
}
// app/api/bundles/search-products/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // or anon if RLS allows it
  );

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Number(searchParams.get("limit") ?? "25");

  const client = supa();

  // Join product_variants -> products to get product name & image
  const { data, error } = await client
  .from("product_variants")
  .select(
    `
      id,
      sku,
      price_cents,
      inventory_qty,
      options_json,
      products:product_id (
        id,
        name
      )
    `
  )
  .gt("inventory_qty", 0)
  .ilike("products.name", q ? `%${q}%` : "%")
  .order("products(name)", { ascending: true })

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const items =
    data?.map((row: any) => {
      const productName = row.products?.name ?? "Unnamed product";
      const options = row.options_json ?? {};
      // Build "Eye Pillow – Ajrakh Fig Leaf (Blue)" style label
      const optionSuffix =
        options && Object.keys(options).length
          ? " – " +
            Object.values(options)
              .map((v: any) => String(v))
              .join(" / ")
          : "";

      return {
        id: row.id as string, // variant id
        productId: row.products?.id as string | undefined,
        name: productName + optionSuffix,
        sku: row.sku as string,
        priceCents: row.price_cents ?? 0,
        stock: row.inventory_qty ?? 0,
        imageUrl: row.image_url ?? row.products?.image_url ?? null,
      };
    }) ?? [];

  return NextResponse.json({ items });
}
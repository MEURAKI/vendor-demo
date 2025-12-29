import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Orders for this vendor which have at least one PRODUCT line item
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      *,
      order_items!inner (
        id,
        line_type,
        product_id,
        product_variant_id,
        name_snapshot,
        sku_snapshot,
        options_snapshot,
        image_url_snapshot,
        quantity,
        unit_price_cents,
        subtotal_cents,
        line_subtotal_cents,
        item_fulfilment_status
      )
    `
    )
    .eq("vendor_id", user.id)
    .in("order_items.line_type", ["product", "bundle"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Wrap in { orders: ... } if your frontend expects that shape
  return NextResponse.json({ orders: data });
}
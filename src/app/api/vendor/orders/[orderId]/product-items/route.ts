import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(
  req: Request,
  { params }: { params: { orderId: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const orderId = params.orderId;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1) Load the order and verify it belongs to this vendor
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, vendor_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.vendor_id !== user.id) {
    return NextResponse.json(
      { error: "You do not have permission to view this order" },
      { status: 403 }
    );
  }

  // 2) Load *product* order items only
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .in("line_type", ["product", "bundle"])
    .order("created_at", { ascending: true });

  if (itemsError) {
    console.error(itemsError);
    return NextResponse.json(
      { error: "Failed to load order items" },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: items ?? [] });
}
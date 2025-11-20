import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type ServiceStatus = "draft" | "active" | "unavailable";
type DiscountType = "fixed" | "percent" | null;

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    serviceIds: string[];
    price?: number | null;
    discountType?: DiscountType;
    discountValue?: number | null;
    status?: ServiceStatus | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { serviceIds, price, discountType, discountValue, status } = body;

  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    return NextResponse.json(
      { error: "serviceIds must be a non-empty array" },
      { status: 400 }
    );
  }

  // Only allow services that belong to this vendor
  const { data: services, error: svcErr } = await supabase
    .from("services")
    .select("id")
    .in("id", serviceIds)
    .eq("vendor_id", auth.user.id);

  if (svcErr) {
    console.error(svcErr);
    return NextResponse.json(
      { error: "Failed to load services" },
      { status: 500 }
    );
  }

  const allowedIds = (services ?? []).map((s) => s.id as string);

  if (allowedIds.length === 0) {
    return NextResponse.json(
      { error: "No matching services for this vendor" },
      { status: 404 }
    );
  }

  // 1) Update service.status if requested
  if (status) {
    const { error: statusErr } = await supabase
      .from("services")
      .update({ status })
      .in("id", allowedIds);

    if (statusErr) {
      console.error(statusErr);
      return NextResponse.json(
        { error: "Failed to update service status" },
        { status: 500 }
      );
    }
  }

  // 2) Update per-location price/discount if requested
  const locPatch: Record<string, any> = {};

  // price is in SGD (same as edit page) – store as cents
  if (typeof price === "number") {
    locPatch.price_cents = Math.round(price * 100);
  }

  if (discountType !== undefined) {
    // if discountType is null, we clear it
    locPatch.discount_type = discountType;
  }

  if (discountValue !== undefined) {
    locPatch.discount_value = discountValue;
  }

  if (Object.keys(locPatch).length > 0) {
    const { error: locErr } = await supabase
      .from("service_location_settings")
      .update(locPatch)
      .in("service_id", allowedIds);

    if (locErr) {
      console.error(locErr);
      return NextResponse.json(
        { error: "Failed to update location settings" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    updatedServiceIds: allowedIds,
  });
}
// app/api/bundles/bulk-update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

type BundleStatus = "draft" | "active" | "out_of_stock";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Missing Authorization token" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const vendorId = user.id;

    const body = await req.json();
    const { bundleIds, priceCents, status } = body as {
      bundleIds: string[];
      priceCents?: number;
      status?: BundleStatus;
    };

    if (!Array.isArray(bundleIds) || bundleIds.length === 0) {
      return NextResponse.json(
        { error: "bundleIds is required" },
        { status: 400 }
      );
    }

    const patch: Record<string, any> = {};

    if (typeof priceCents === "number") {
      patch.price_cents = priceCents;
    }

    if (status) {
      patch.status = status;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const { error: updateErr } = await supabase
      .from("bundles")
      .update(patch)
      .in("id", bundleIds)
      .eq("vendor_id", vendorId);

    if (updateErr) {
      console.error("[bundle bulk-update] error:", updateErr);
      return NextResponse.json(
        { error: updateErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[bundle bulk-update] unexpected:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: err?.message },
      { status: 500 }
    );
  }
}
// app/api/spaces/bulk-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";

/* ---------- Supabase server client ---------- */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// SERVICE KEY – server-side only
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Node runtime
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 0) Auth – same pattern as your variants bulk upload
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
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const vendorId = user.id;

    // 1) Read CSV file from multipart form-data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "CSV file is required" },
        { status: 400 }
      );
    }

    const text = await file.text();
    if (!text.trim()) {
      return NextResponse.json(
        { error: "CSV file is empty" },
        { status: 400 }
      );
    }

    // 2) Parse CSV – first row as header
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    if (!records.length) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    // 👉 At this point you can map + insert into your "spaces" table.
    // For now we just log some info and return success so the UI works.

    console.log(
      `[spaces bulk upload] vendor=${vendorId}, fileRows=${records.length}`
    );
    console.log("Example row:", records[0]);

    // TODO: map headers -> your spaces schema and insert with supabase.from("spaces").insert(...)

    return NextResponse.json({
      ok: true,
      rowCount: records.length,
    });
  } catch (err: any) {
    console.error("Spaces bulk upload error:", err);
    return NextResponse.json(
      { error: "Unexpected error", details: err?.message },
      { status: 500 }
    );
  }
}
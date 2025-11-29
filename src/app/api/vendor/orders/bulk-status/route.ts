import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

type Body = {
  ids: string[];
  status: string;
};

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { ids, status } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "ids array is required" },
      { status: 400 }
    );
  }

  if (!status || typeof status !== "string") {
    return NextResponse.json(
      { error: "status is required" },
      { status: 400 }
    );
  }

  // Optional: ensure user is signed in and get vendor_id
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // If you have a vendor profile table, you could look it up here.
  // For now we assume orders has vendor_id == user.id OR you derive vendor_id otherwise.

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status })
    .in("id", ids);

  // If you need to scope by vendor_id, do:
  // .eq("vendor_id", user.id)

  if (updateError) {
    console.error(updateError);
    return NextResponse.json(
      { error: "Failed to update orders" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
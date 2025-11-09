import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types"; // <- your generated types

export type VendorStatus =
  | "incomplete_registration"
  | "under_review"
  | "agreement_pending"
  | "active"
  | "inactive"
  | "draft"
  | "suspended";

/**
 * Update vendor status and onboarding flag.
 * `client` is optional and placed LAST to satisfy Sonar S1788.
 */
export async function setVendorStatus(
  status: VendorStatus,
  completed: boolean,
  client?: SupabaseClient<Database>
): Promise<void> {
  // create a component client if none provided
  const supabase = client ?? createClientComponentClient<Database>();

  const {
    data: { user },
    error: uErr,
  } = await supabase.auth.getUser();
  if (uErr || !user) throw new Error("No user");

  const [p1, p2] = await Promise.all([
    supabase
      .from("profiles")
      .update({ status, onboarding_completed: completed })
      .eq("id", user.id),
    supabase
      .from("onboarding")
      .upsert({ user_id: user.id, status, onboarding_completed: completed }),
  ]);

  if (p1.error) throw p1.error;
  if (p2.error) throw p2.error;
}

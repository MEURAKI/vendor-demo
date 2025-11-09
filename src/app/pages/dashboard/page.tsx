"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

type UserStatus = "pending_admin_approval" | "approved" | "active" | "rejected" | "suspended";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Where to route based on current profile
  const redirectPath = useMemo(() => {
    if (!profile) return null;
    if (profile.status === "pending_admin_approval") return "/pages/auth/pending";
    if (profile.status === "approved" && !profile.onboarding_completed) return "/pages/onboarding/start";
    return null; // active (or other) -> stay
  }, [profile]);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      // 1) Ensure we have a logged-in user
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        router.replace("/pages/auth/login");
        return;
      }

      // 2) Load their profile
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, email, status, onboarding_completed, full_name")
        .eq("id", user.id)
        .single();

      if (!error) setProfile(prof as Profile);

      // 3) Realtime subscription to react to admin approval instantly
      const channel = supabase
        .channel(`profiles:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const row = payload.new as Profile;
            setProfile(row);
          }
        )
        .subscribe();

      unsub = () => {
        supabase.removeChannel(channel);
      };

      setLoading(false);
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [router]);

  // 4) If profile says we should be elsewhere, go there
  useEffect(() => {
    if (!loading && redirectPath) {
      router.replace(redirectPath);
    }
  }, [loading, redirectPath, router]);

  if (loading || !profile || redirectPath) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-gray-600">Loading your dashboard…</p>
      </div>
    );
  }

  // 5) ACTIVE -> show dashboard
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-10">
      <h1 className="text-3xl font-bold mb-2">
        Welcome{profile.full_name ? `, ${profile.full_name}` : ""} 👋
      </h1>
      <p className="text-gray-600 mb-8">
        You’re successfully logged in to the Meuraki Vendor Portal.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="font-semibold mb-2">Account</h2>
          <div className="text-sm text-gray-600">
            <div>Email: {profile.email ?? "—"}</div>
            <div>Status: <span className="uppercase">{profile.status}</span></div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="font-semibold mb-2">Getting started</h2>
          <p className="text-sm text-gray-600">
            Explore your vendor tools and manage your listings.
          </p>
        </div>
      </div>

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.replace("/pages/auth/login");
        }}
        className="mt-10 px-6 py-3 bg-black text-white rounded-full hover:bg-gray-900 transition"
      >
        Sign out
      </button>
    </div>
  );
}

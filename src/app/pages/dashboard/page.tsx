"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase/client";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Get the logged-in user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        // If no user, redirect to login
        router.push("/pages/auth/login");
      } else {
        setUser(user);
      }
    });
  }, [router]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-gray-600">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-10">
      <h1 className="text-3xl font-bold mb-4">Welcome, {user.email}</h1>
      <p className="text-gray-600 mb-8">
        You’re successfully logged in to the Meuraki Vendor Portal.
      </p>

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.push("/pages/auth/login");
        }}
        className="px-6 py-3 bg-black text-white rounded-full hover:bg-gray-900 transition"
      >
        Sign out
      </button>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";
import { useToast } from "../../../../components/toast/ToastProvider";

/* -------------------- Types -------------------- */
type UserStatus = "pending_admin_approval" | "approved" | "active" | "rejected" | "suspended";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

/* -------------------- Page -------------------- */
export default function SettingsLoginSecurityPage() {
  const [loading, setLoading] = useState(true);

  // profile / user
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  // password form
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  // linked accounts
  const [googleConnected, setGoogleConnected] = useState<boolean>(false);
  const [linkBusy, setLinkBusy] = useState(false);

  const { successToast, errorToast } = useToast();

  // load current user + profile
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        setLoading(false);
        return;
      }
      setUserEmail(user.email ?? "");

      // identities -> google connected?
      const gConnected = !!user.identities?.some((i) => i.provider === "google");
      setGoogleConnected(gConnected);

      const { data } = await supabase
        .from("profiles")
        .select("id, email, status, onboarding_completed, full_name")
        .eq("id", user.id)
        .maybeSingle();

      setProfile(
        (data as Profile) ?? {
          id: user.id,
          email: user.email ?? "",
          status: "active",
          onboarding_completed: false,
          full_name: user.email ?? "User",
        },
      );

      setLoading(false);
    })();
  }, []);

  /* -------------------- Sidebar config -------------------- */
  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name,
        email: profile?.email,
        role: "Vendor",
        status: "Incomplete Registration",
      }),
    [profile],
  );

  /* -------------------- Password validation -------------------- */
  const rules = {
    lowercase: /[a-z]/.test(newPw),
    uppercase: /[A-Z]/.test(newPw),
    number: /\d/.test(newPw),
    special: /[^A-Za-z0-9]/.test(newPw),
    length: newPw.length >= 8,
  };
  const allValid = Object.values(rules).every(Boolean) && newPw === confirmPw;

  /* -------------------- Handlers -------------------- */
  async function handleChangePassword() {
    if (!userEmail) return;
    if (!allValid) {
      errorToast({ title: "Error", description: "Please ensure all password requirements are met." });
      return;
    }

    setSavingPw(true);

    // (Optional) reauth by checking old password:
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: oldPw,
    });
    if (reauthErr) {
      setSavingPw(false);
      errorToast({ title: "Error", description: "Old password is incorrect." });
      return;
    }

    // Update password
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSavingPw(false);

    if (error) {
      errorToast({ title: "Error", description: `Could not update password: ${error.message}` });
    } else {
      successToast({ title: "Success", description: "Password updated successfully." });
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    }
  }

  async function handleConnectGoogle() {
    setLinkBusy(true);
    try {
      // Supabase has linkIdentity; fall back to standard OAuth if not available
      if (supabase.auth.linkIdentity) {
        await supabase.auth.linkIdentity({ provider: "google" });
      } else {
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { skipBrowserRedirect: false },
        });
      }
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleDisconnectGoogle() {
    setLinkBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const identity = auth.user?.identities?.find((i) => i.provider === "google");

      if (!identity) {
        setGoogleConnected(false);
        setLinkBusy(false);
        return;
      }

      if (supabase.auth.unlinkIdentity) {
        const { error } = await supabase.auth.unlinkIdentity({
            provider: "google",
            identity_id: identity.identity_id,
            id: "",
            user_id: ""
        });
        if (error) throw error;
        setGoogleConnected(false);
      } else {
        errorToast({ title: "Error", description: "Disconnect is not supported in this client version." });
      }
    } catch (e: any) {
      errorToast({ title: "Error", description: e?.message ?? "Failed to disconnect Google." });
    } finally {
      setLinkBusy(false);
    }
  }

  /* -------------------- UI -------------------- */
  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-600">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Collapsed dark app sidebar */}
      <Sidebar config={sidebarConfig} />

      {/* Settings light nav */}
      <SettingsNav />

      {/* Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-5xl p-8">
          <h1 className="text-3xl font-semibold text-gray-900">Account Settings</h1>

          {/* Tabs (visual only) */}
          <div className="mt-6 flex gap-8 border-b border-gray-200">
            <a href="/pages/setting/profile" className="pb-3 text-sm text-gray-500 hover:text-gray-900">
              Profile Information
            </a>
            <span className="pb-3 text-sm font-semibold text-gray-900 border-b-2 border-gray-900">
              Login &amp; Security
            </span>
            <a href="/pages/setting/notifications" className="pb-3 text-sm text-gray-500 hover:text-gray-900">
              Notifications
            </a>
          </div>

          {/* Change Password */}
          <section className="mt-8 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="font-semibold text-gray-900">Change Password</h3>
              <p className="mt-1 text-sm text-gray-500">
                Use a strong password to keep your account secure.
              </p>

              <div className="mt-4 space-y-2 text-sm">
                <Requirement pill label="1 lowercase" ok={rules.lowercase} />
                <Requirement pill label="1 uppercase" ok={rules.uppercase} />
                <Requirement pill label="1 number" ok={rules.number} />
                <Requirement pill label="1 special character" ok={rules.special} />
                <Requirement pill label="Min. 8 characters" ok={rules.length} />
              </div>
            </div>

            <div className="space-y-4">
              <Field
                label="Enter old Password"
                type="password"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
              />
              <Field
                label="Enter new Password"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
              />
              <Field
                label="Confirm new password"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
              />

              <button
                onClick={handleChangePassword}
                disabled={savingPw || !allValid}
                className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-black px-5 py-2.5 text-white hover:bg-gray-900 disabled:opacity-60"
              >
                {savingPw ? "Saving…" : "Save"}
              </button>
            </div>
          </section>

          <hr className="my-8 border-gray-200" />

          {/* Linked Accounts */}
          <section className="mt-4">
            <h3 className="font-semibold text-gray-900">Linked Accounts</h3>
            <p className="mt-1 text-sm text-gray-500">
              Manage the social accounts connected to your profile for easy login.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="inline-flex items-center gap-3 rounded-full bg-gray-50 px-4 py-2 shadow-sm ring-1 ring-gray-200">
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v..." />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66..." />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36..." />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64..." />
                </svg>
                <span className="text-sm text-gray-800">Google</span>
                <span className="text-xs text-gray-500">
                  {googleConnected ? "Connected" : "Not connected"}
                </span>
              </div>

              {googleConnected ? (
                <button
                  onClick={handleDisconnectGoogle}
                  disabled={linkBusy}
                  className="rounded-full bg-black px-5 py-2 text-sm text-white hover:bg-gray-900 disabled:opacity-60"
                >
                  {linkBusy ? "Disconnecting…" : "Disconnect"}
                </button>
              ) : (
                <button
                  onClick={handleConnectGoogle}
                  disabled={linkBusy}
                  className="rounded-full border border-gray-300 bg-white px-5 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
                >
                  {linkBusy ? "Connecting…" : "Connect"}
                </button>
              )}
            </div>
          </section>

          <hr className="my-8 border-gray-200" />

          {/* 2FA */}
          <section className="mt-4">
            <h3 className="font-semibold text-gray-900">Two-Factor Authentication (2FA)</h3>
            <p className="mt-1 text-sm text-gray-500">
              Add an extra layer of security to your account by requiring a code at login.
            </p>

            <div className="mt-4">
              <button
                disabled
                className="w-full cursor-not-allowed rounded-xl bg-gray-100 px-6 py-3 text-sm text-gray-500"
              >
                Coming Soon
              </button>
            </div>
          </section>

          {/* Bottom padding for scroll breathing room */}
          <div className="h-16" />
        </div>
      </main>
    </div>
  );
}

/* -------------------- Small UI helpers -------------------- */

function Field({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: "text" | "password";
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
      />
    </div>
  );
}

function Requirement({ label, ok, pill = false }: { label: string; ok: boolean; pill?: boolean }) {
  return (
    <div
      className={[
        "inline-flex items-center gap-2",
        pill ? "rounded-full px-3 py-1 ring-1" : "",
        ok
          ? pill
            ? "bg-purple-50 text-purple-700 ring-purple-200"
            : "text-purple-700"
          : pill
          ? "bg-gray-100 text-gray-500 ring-gray-200"
          : "text-gray-500",
      ].join(" ")}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4">
        <path
          fill={ok ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          d="M7.5 10.5l2 2 4-4"
        />
      </svg>
      <span className="text-xs">{label}</span>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";
import { useToast } from "../../../../components/toast/ToastProvider";

/* ---------- Types ---------- */
type Prefs = {
  orders: boolean;
  bookings: boolean;
  payouts: boolean;
  verification: boolean;
};

type Recipient = {
  id: string;
  email: string;
  enabled: boolean;
};

const DEFAULT_PREFS: Prefs = {
  orders: true,
  bookings: true,
  payouts: true,
  verification: true,
};

/* ---------- Tiny Toggle ---------- */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition",
        checked
          ? "bg-purple-600 border-purple-600"
          : "bg-gray-300 border-gray-300",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-4 w-4 translate-x-0 rounded-full bg-white shadow ring-0 transition",
          checked ? "translate-x-4" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

/* ---------- Page ---------- */
export default function NotificationsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const { successToast, errorToast } = useToast();

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      setUserId(auth.user.id);

      // For the dark sidebar profile chip
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", auth.user.id)
        .maybeSingle();

      setProfileName(prof?.full_name ?? auth.user.email ?? "User");
      setProfileEmail(prof?.email ?? auth.user.email ?? "");

      // Load prefs (create defaults if empty in UI)
      const { data: p } = await supabase
        .from("notification_prefs")
        .select("orders, bookings, payouts, verification")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (p) setPrefs({ ...DEFAULT_PREFS, ...p });

      // Load recipients
      const { data: r } = await supabase
        .from("notification_recipients")
        .select("id, email, enabled")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: true });

      setRecipients((r ?? []) as Recipient[]);
      setLoading(false);
    })();
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profileName ?? "",
        email: profileEmail ?? "",
        role: "Vendor",
        status: "Incomplete Registration",
      }),
    [profileName, profileEmail]
  );

  async function savePrefs() {
    if (!userId) return;
    setSavingPrefs(true);
    const { error } = await supabase
      .from("notification_prefs")
      .upsert(
        {
          user_id: userId,
          ...prefs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    setSavingPrefs(false);
    if (error) errorToast({ title: "Error", description: error.message });
  }

  async function toggleRecipient(id: string, enabled: boolean) {
    const prev = recipients.slice();
    setRecipients((rs) => rs.map((r) => (r.id === id ? { ...r, enabled } : r)));
    const { error } = await supabase
      .from("notification_recipients")
      .update({ enabled })
      .eq("id", id);
    if (error) {
      errorToast({ title: "Error", description: error.message });
      setRecipients(prev); // rollback on error
    }
  }

  async function addRecipient() {
    if (!userId || !newEmail) return;
    const email = newEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      errorToast({ title: "Error", description: "Please enter a valid email address." });
      return;
    }
    const { data, error } = await supabase
      .from("notification_recipients")
      .insert({
        user_id: userId,
        email,
        enabled: true,
      })
      .select("id, email, enabled")
      .single();

    if (error) {
      errorToast({ title: "Error", description: error.message });
      return;
    }

    setRecipients((rs) => [...rs, data as Recipient]);
    setNewEmail("");
    setModalOpen(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-600">Loading notifications…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar config={sidebarConfig} />
      <SettingsNav />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl p-8">
          <h1 className="text-3xl font-semibold text-gray-900">
            Account Settings
          </h1>

          {/* Tabs header */}
          <div className="mt-6 flex gap-8 border-b border-gray-200">
            <a href="/pages/setting/profile" className="pb-3 text-sm text-gray-500 hover:text-gray-900">Profile Information</a>
            <a href="/pages/setting/security" className="pb-3 text-sm text-gray-500 hover:text-gray-900">Login &amp; Security</a>
            <span className="pb-3 text-sm font-semibold text-gray-900 border-b-2 border-gray-900">
              Notifications
            </span>
          </div>

          {/* Recipients block */}
          <section className="mt-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Email Notification Recipients
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Manage which email addresses receive updates.
                </p>
              </div>

              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-white text-sm hover:bg-gray-900"
              >
                <span className="inline-block h-4 w-4 rounded-full bg-white text-black grid place-items-center">+</span>
                Add Email Recipient
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {/* Header row */}
              <div className="bg-[#EFEDFF] px-4 py-2 text-sm font-medium text-gray-700">
                Email Addresses
              </div>

              {/* Rows */}
              {recipients.length === 0 && (
                <div className="px-4 py-4 text-sm text-gray-500">
                  No extra recipients yet.
                </div>
              )}

              {recipients.map((r, i) => (
                <div
                  key={r.id}
                  className={[
                    "flex items-center justify-between px-4 py-3 text-sm",
                    i !== recipients.length - 1 ? "border-b border-gray-100" : "",
                  ].join(" ")}
                >
                  <div className="text-gray-800">{r.email}</div>
                  <Toggle
                    checked={r.enabled}
                    onChange={(v) => toggleRecipient(r.id, v)}
                    label={`Enable ${r.email}`}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* What to be notified about */}
          <section className="mt-10">
            <h2 className="text-sm font-semibold text-gray-900">
              Email Notification Recipients
            </h2>

            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="bg-[#EFEDFF] px-4 py-2 text-sm font-medium text-gray-700">
                What you want to be notified about
              </div>

              {[
                {
                  key: "orders",
                  title: "Orders",
                  desc: "Get an email when a new order is placed or cancelled.",
                },
                {
                  key: "bookings",
                  title: "Bookings",
                  desc: "Get notified for new bookings or cancellations.",
                },
                {
                  key: "payouts",
                  title: "Payouts & Billing",
                  desc: "Receive payout confirmations and invoice alerts.",
                },
                {
                  key: "verification",
                  title: "Verification & Documents",
                  desc: "Get updates on verification status or document reviews.",
                },
              ].map((row, i) => (
                <div
                  key={row.key}
                  className={[
                    "flex items-center gap-4 px-4 py-4",
                    i !== 3 ? "border-b border-gray-100" : "",
                  ].join(" ")}
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {row.title}
                    </div>
                    <div className="text-xs text-gray-500">{row.desc}</div>
                  </div>

                  <Toggle
                    checked={prefs[row.key as keyof Prefs]}
                    onChange={(v) =>
                      setPrefs((p) => ({ ...p, [row.key]: v } as Prefs))
                    }
                    label={row.title}
                  />
                </div>
              ))}
            </div>

            {/* Save prefs */}
            <div className="sticky bottom-0 -mx-8 mt-8 border-t border-gray-200 bg-white/80 backdrop-blur px-8 py-4">
              <button
                onClick={savePrefs}
                disabled={savingPrefs}
                className="inline-flex items-center rounded-full bg-black px-6 py-3 text-white hover:bg-gray-900 disabled:opacity-60"
              >
                {savingPrefs ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* Add recipient modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-end md:place-items-center bg-black/30 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Add email recipient
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add another email address to receive copies of your vendor
                  notifications.
                </p>
              </div>
              <button
                className="h-8 w-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-900">
                Email Address
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-[#EFEDFF] px-3 text-gray-900 placeholder-gray-500 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                className="rounded-full border border-gray-300 px-5 py-2 text-sm hover:bg-gray-50"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-900"
                onClick={addRecipient}
              >
                Save Recipient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

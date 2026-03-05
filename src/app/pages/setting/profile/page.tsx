// app/pages/setting/account/page.tsx
"use client";

import { useVendorProfile } from "../../../../context/VendorShellContext";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "../../../../lib/supabase/client";
import { useToast } from "../../../../components/toast/ToastProvider";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import SettingsNav from "../../../../components/settings/SettingsNav";
import ClipLoader from "react-spinners/ClipLoader";

/* ------------------- Types ------------------- */

type UserStatus =
  | "pending_admin_approval"
  | "approved"
  | "active"
  | "rejected"
  | "suspended";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  country_code?: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

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

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE_BYTES = 1024 * 1024; // 1MB

type TabKey = "profile" | "security" | "notifications";

/* ---- Completeness-related minimal types ---- */

type DocKind =
  | "vendor_agreement"
  | "uen_acra"
  | "product_certificate"
  | "service_certificate";

type DocRow = {
  id: string;
  vendor_id: string;
  kind: DocKind;
  status: "pending" | "approved" | "rejected";
};

type PayoutLite = {
  vendor_id: string;
  account_number?: string | null;
  account_holder_name?: string | null;
};

type VendorBusinessBits = {
  id: string;
  brand_logo_url: string | null;
  policy_url: string | null;
};

/* ------------------- Small UI helpers ------------------- */

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
      onClick={() => !disabled && onChange(!checked)}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition",
        checked ? "bg-purple-600 border-purple-600" : "bg-gray-300 border-gray-300",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition",
          checked ? "translate-x-4" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

function Requirement({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ring-1",
        ok
          ? "bg-purple-50 text-purple-700 ring-purple-200"
          : "bg-gray-100 text-gray-500 ring-gray-200",
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
      {label}
    </span>
  );
}

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

/* ------------------- INNER PAGE (all hooks here) ------------------- */

function AccountSettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { successToast, errorToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  // security state
  const [userEmail, setUserEmail] = useState("");
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);

  // notifications state
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const [userId, setUserId] = useState<string | null>(null);

  // completeness state (business/docs/payout)
  const [biz, setBiz] = useState<VendorBusinessBits | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [payout, setPayout] = useState<PayoutLite | null>(null);

  /* ------------ Read ?tab= from URL ------------ */

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (
      tabParam === "profile" ||
      tabParam === "security" ||
      tabParam === "notifications"
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  /* ------------ Load everything once ------------ */

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? "");

      // google connected?
      const gConnected = !!user.identities?.some((i) => i.provider === "google");
      setGoogleConnected(gConnected);

      const [
        { data: profData },
        { data: prefsData },
        { data: recipientsData },
        { data: vbRow },
        { data: docsRows },
        { data: payoutRow },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id,email,status,onboarding_completed,role,full_name,first_name,last_name,phone,country_code,avatar_url"
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("notification_prefs")
          .select("orders, bookings, payouts, verification")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("notification_recipients")
          .select("id,email,enabled")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("vendor_business")
          .select("id,brand_logo_url,policy_url")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("vendor_docs")
          .select("id,vendor_id,kind,status")
          .eq("vendor_id", user.id),
        supabase
          .from("vendor_payout")
          .select("vendor_id,account_number,account_holder_name")
          .eq("vendor_id", user.id)
          .maybeSingle(),
      ]);

      // profile
      if (!profData) {
        setProfile({
          id: user.id,
          email: user.email ?? "",
          status: "active",
          onboarding_completed: false,
          full_name: "",
          first_name: "",
          last_name: "",
          phone: "",
          country_code: "+65",
          avatar_url: null,
          role: "Subscriber",
        });
      } else {
        setProfile({
          ...profData,
          full_name: profData.full_name ?? "",
          first_name: profData.first_name ?? "",
          last_name: profData.last_name ?? "",
          phone: profData.phone ?? "",
          country_code: profData.country_code ?? "+65",
          role: profData.role ?? "Subscriber",
        });
      }

      // notification prefs
      if (prefsData) {
        setPrefs({ ...DEFAULT_PREFS, ...prefsData });
      }

      // recipients
      setRecipients((recipientsData ?? []) as Recipient[]);

      // completeness bits
      if (vbRow) {
        setBiz(vbRow as VendorBusinessBits);
      } else {
        setBiz(null);
      }

      setDocs((docsRows ?? []) as DocRow[]);
      setPayout((payoutRow || null) as PayoutLite | null);

      setLoading(false);
    })();
  }, []);

  /* ------------ completeness shared across settings ------------ */

  const completeness = useMemo(() => {
    if (!biz) {
      const missing = {
        logo: true,
        policy: true,
        certificates: true,
        payout: true,
      };
      const overallIncomplete = true;

      const navAlerts: Record<string, boolean> = {
        "/pages/setting/business?tab=business": missing.logo,
        "/pages/setting/business?tab=docs":
          missing.policy || missing.certificates,
        "/pages/setting/business?tab=verification": overallIncomplete,
        "/pages/setting/payouts?tab=payouts": missing.payout,
      };

      return { missing, overallIncomplete, navAlerts };
    }

    const hasLogo = !!biz.brand_logo_url;
    const hasPolicy = !!biz.policy_url;

    const hasAnyCert =
      docs.filter(
        (d) =>
          d.kind === "product_certificate" ||
          d.kind === "service_certificate"
      ).length > 0;

    const hasPayout =
      !!payout?.account_number || !!payout?.account_holder_name;

    const missing = {
      logo: !hasLogo,
      policy: !hasPolicy,
      certificates: !hasAnyCert,
      payout: !hasPayout,
    };

    const overallIncomplete = Object.values(missing).some(Boolean);

    const navAlerts: Record<string, boolean> = {
      "/pages/setting/business?tab=business": missing.logo,
      "/pages/setting/business?tab=docs":
        missing.policy || missing.certificates,
      "/pages/setting/business?tab=verification": overallIncomplete,
      "/pages/setting/payouts?tab=payouts": missing.payout,
    };

    return { missing, overallIncomplete, navAlerts };
  }, [biz, docs, payout]);

  /* ------------ Sidebar config ------------ */
  /* ------------ Avatar upload ------------ */

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  function handleTabChange(next: TabKey) {
    setActiveTab(next);

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const MAX_SIZE = MAX_AVATAR_SIZE_BYTES;
  const BUCKET = AVATAR_BUCKET;

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading same file

    if (!file || !profile) return;

    if (file.size > MAX_SIZE) {
      errorToast({
        title: "Image too large",
        description: "Max image size is 1MB.",
      });
      return;
    }

    const ext = file.name.split(".").pop();
    const path = `${profile.id}/${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError || !uploadData) {
      errorToast({
        title: "Upload failed",
        description: uploadError?.message ?? "Please try again.",
      });
      return;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);
    const publicUrl = urlData.publicUrl;

    setProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (updateError) {
      errorToast({
        title: "Error saving",
        description: updateError.message,
      });
    } else {
      successToast({
        title: "Updated",
        description: "Your profile picture has been updated.",
      });
    }
  }

  /* ------------ Save profile ------------ */

  async function saveProfile() {
    if (!profile) return;
    const {
      id,
      first_name,
      last_name,
      phone,
      country_code,
      full_name,
      email,
      avatar_url,
      role,
    } = profile;

    const { error } = await supabase.from("profiles").upsert(
      {
        id,
        email,
        first_name,
        last_name,
        phone,
        country_code,
        full_name,
        avatar_url,
        role,
        status: "active",
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      errorToast({
        title: "Error",
        description: "Error saving settings: " + error.message,
      });
    } else {
      successToast({
        title: "Success",
        description: "Profile saved successfully!",
      });
    }
  }

  /* ------------ Security (password + google) ------------ */

  const rules = {
    lowercase: /[a-z]/.test(newPw),
    uppercase: /[A-Z]/.test(newPw),
    number: /\d/.test(newPw),
    special: /[^A-Za-z0-9]/.test(newPw),
    length: newPw.length >= 8,
  };
  const allValidPw = Object.values(rules).every(Boolean) && newPw === confirmPw;

  async function handleChangePassword() {
    if (!userEmail) return;
    if (!allValidPw) {
      errorToast({
        title: "Error",
        description: "Please ensure all password requirements are met.",
      });
      return;
    }

    setSavingPw(true);

    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: oldPw,
    });

    if (reauthErr) {
      setSavingPw(false);
      errorToast({
        title: "Error",
        description: "Old password is incorrect.",
      });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSavingPw(false);

    if (error) {
      errorToast({
        title: "Error",
        description: `Could not update password: ${error.message}`,
      });
    } else {
      successToast({
        title: "Success",
        description: "Password updated successfully.",
      });
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    }
  }

  async function handleConnectGoogle() {
    setLinkBusy(true);
    try {
      // @ts-ignore – newer client has linkIdentity
      if (supabase.auth.linkIdentity) {
        // @ts-ignore
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
      const identity = auth.user?.identities?.find(
        (i: any) => i.provider === "google"
      );
      if (!identity) {
        setGoogleConnected(false);
        return;
      }

      // @ts-ignore
      if (supabase.auth.unlinkIdentity) {
        // @ts-ignore
        const { error } = await supabase.auth.unlinkIdentity({
          provider: "google",
          identity_id: identity.identity_id,
        });
        if (error) throw error;
        setGoogleConnected(false);
      } else {
        errorToast({
          title: "Error",
          description: "Disconnect is not supported in this client version.",
        });
      }
    } catch (e: any) {
      errorToast({
        title: "Error",
        description: e?.message ?? "Failed to disconnect Google.",
      });
    } finally {
      setLinkBusy(false);
    }
  }

  /* ------------ Notifications ------------ */

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
    if (error) {
      errorToast({ title: "Error", description: error.message });
    } else {
      successToast({
        title: "Saved",
        description: "Notification preferences updated.",
      });
    }
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
      setRecipients(prev); // rollback
    }
  }

  async function addRecipient() {
    if (!userId || !newEmail) return;
    const email = newEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      errorToast({
        title: "Error",
        description: "Please enter a valid email address.",
      });
      return;
    }
    const { data, error } = await supabase
      .from("notification_recipients")
      .insert({
        user_id: userId,
        email,
        enabled: true,
      })
      .select("id,email,enabled")
      .single();

    if (error) {
      errorToast({ title: "Error", description: error.message });
      return;
    }

    setRecipients((rs) => [...rs, data as Recipient]);
    setNewEmail("");
    setModalOpen(false);
  }

  /* ------------ Layout ------------ */

  if (loading || !profile) {
    return (
      <div className="flex h-full w-full items-center justify-center">
            <ClipLoader size={24} color="gray" />
          </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Dark app sidebar */}
      {/* Left settings nav – 🔴 global completeness alerts */}
      <SettingsNav alerts={completeness.navAlerts} />

      {/* Right content area */}
      <main className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
          Account Settings
        </h1>

        {/* Top tabs */}
        <div className="mt-6 flex gap-8 border-b border-gray-200 text-sm">
          {[
            { key: "profile", label: "Profile Information" },
            { key: "security", label: "Login & Security" },
            { key: "notifications", label: "Notifications" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key as TabKey)}
              className={[
                "pb-3",
                activeTab === tab.key
                  ? "border-b-2 border-gray-900 font-semibold text-gray-900"
                  : "text-gray-500 hover:text-gray-900",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT BY TAB */}
        {activeTab === "profile" && (
          <form
            className="mt-6 space-y-12 pb-20"
            onSubmit={(e) => {
              e.preventDefault();
              saveProfile();
            }}
          >
            {/* Avatar */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-14 w-14 overflow-hidden rounded-full bg-gray-200">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt="Avatar"
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                    No Image
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.svg,image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
                  onClick={handleUploadClick}
                >
                  Upload Picture
                </button>

                <button
                  type="button"
                  className="rounded-full border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  onClick={async () => {
                    if (!profile) return;

                    setProfile({ ...profile, avatar_url: null });
                    const { error } = await supabase
                      .from("profiles")
                      .update({
                        avatar_url: null,
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", profile.id);

                    if (error) {
                      errorToast({
                        title: "Error",
                        description:
                          "Error removing profile picture: " + error.message,
                      });
                    } else {
                      successToast({
                        title: "Removed",
                        description: "Profile picture removed.",
                      });
                    }
                  }}
                >
                  Remove Picture
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Recommended size – 1:1 Square | 500 × 500 px. Max upload size – 1 MB
            </p>

            {/* Name */}
            <section>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Name</div>
                  <p className="mt-1 max-w-xs text-xs text-gray-500">
                    Your name helps us identify your account and contact you regarding your
                    vendor activity.
                  </p>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-gray-500">First Name</label>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      value={profile.first_name || ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          first_name: e.target.value,
                          full_name: `${e.target.value} ${
                            profile.last_name ?? ""
                          }`.trim(),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500">Last Name</label>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      value={profile.last_name || ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          last_name: e.target.value,
                          full_name: `${profile.first_name ?? ""} ${
                            e.target.value
                          }`.trim(),
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-gray-200" />
            </section>

            {/* Email */}
            <section>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Email Address</div>
                  <p className="mt-1 max-w-sm text-xs text-gray-500">
                    Your registered email is used for login and all vendor-related
                    notifications.
                  </p>
                  <p className="mt-2 text-xs text-purple-600">
                    *If you update your email, you’ll need to verify the new address.
                  </p>
                </div>
                <div className="flex items-start">
                  <input
                    disabled
                    className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-gray-900"
                    value={profile.email || ""}
                  />
                </div>
              </div>

              <div className="mt-8 border-t border-gray-200" />
            </section>

            {/* Phone */}
            <section>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Phone Number</div>
                  <p className="mt-1 max-w-sm text-xs text-gray-500">
                    Your contact number helps us reach you for onboarding, verification, and
                    support.
                  </p>
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    className="h-11 w-24 rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="+65"
                    value={profile.country_code || ""}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        country_code: e.target.value,
                      })
                    }
                  />
                  <input
                    className="h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="0000 0000"
                    value={profile.phone || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, phone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="mt-8 border-t border-gray-200" />
            </section>

            {/* Role */}
            <section>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Account Role
                  </div>
                  <p className="mt-1 max-w-sm text-xs text-gray-500">
                    Defines your position or responsibility within your company.
                  </p>
                </div>
                <div className="mt-2">
                  <input
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    value={profile.role || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, role: e.target.value })
                    }
                  />
                </div>
              </div>
            </section>

            {/* Save bar */}
            <div className="sticky bottom-0 -mx-6 mt-6 border-t border-gray-200 bg-white/85 px-6 py-4 backdrop-blur">
              <button
                type="submit"
                className="inline-flex items-center rounded-full bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-900"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}

        {activeTab === "security" && (
          <div className="mt-8 pb-20 space-y-10">
            {/* Change password */}
            <section className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="font-semibold text-gray-900">Change Password</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Use a strong password to keep your account secure.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <Requirement label="1 lowercase" ok={rules.lowercase} />
                  <Requirement label="1 uppercase" ok={rules.uppercase} />
                  <Requirement label="1 number" ok={rules.number} />
                  <Requirement label="1 special character" ok={rules.special} />
                  <Requirement label="Min. 8 characters" ok={rules.length} />
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
                  disabled={savingPw || !allValidPw}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-black px-5 py-2.5 text-white hover:bg-gray-900 disabled:opacity-60"
                >
                  {savingPw ? "Saving…" : "Save"}
                </button>
              </div>
            </section>

            <hr className="border-gray-200" />

            {/* Linked accounts */}
            <section>
              <h3 className="font-semibold text-gray-900">Linked Accounts</h3>
              <p className="mt-1 text-sm text-gray-500">
                Manage the social media accounts connected to your profile for easy login.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <div className="inline-flex items-center gap-3 rounded-full bg-gray-50 px-4 py-2 shadow-sm ring-1 ring-gray-200">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs">
                    G
                  </span>
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

            <hr className="border-gray-200" />

            {/* 2FA */}
            <section>
              <h3 className="font-semibold text-gray-900">
                Two-Factor Authentication (2FA)
              </h3>
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
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="mt-8 pb-20 space-y-10">
            {/* Recipients */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-4">
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
                  className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm text-white hover:bg-gray-900"
                >
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-xs text-black">
                    +
                  </span>
                  Add Email Recipient
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="bg-[#EFEDFF] px-4 py-2 text-sm font-medium text-gray-700">
                  Email Addresses
                </div>

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
            <section>
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
                        setPrefs((p) => ({
                          ...p,
                          [row.key]: v,
                        }))
                      }
                      label={row.title}
                    />
                  </div>
                ))}
              </div>

              <div className="sticky bottom-0 -mx-6 mt-6 border-t border-gray-200 bg-white/80 px-6 py-4 backdrop-blur">
                <button
                  onClick={savePrefs}
                  disabled={savingPrefs}
                  className="inline-flex items-center rounded-full bg-black px-6 py-3 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
                >
                  {savingPrefs ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Add recipient modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
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
                  Add another email address to receive copies of your vendor notifications.
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

/* ------------------- OUTER WRAPPER (no hooks) ------------------- */

export default function AccountSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center">
            <ClipLoader size={24} color="gray" />
          </div>
      }
    >
      <AccountSettingsPageInner />
    </Suspense>
  );
}

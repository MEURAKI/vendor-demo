"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";
import { useToast } from "../../../../components/toast/ToastProvider";

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

/* ------------------- Constants ------------------- */

const AVATAR_BUCKET = "avatars"; // 👈 change if your bucket name is different
const MAX_AVATAR_SIZE_BYTES = 1024 * 1024; // 1 MB

export default function SettingsProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const { successToast, errorToast } = useToast();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load profile
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id,email,status,onboarding_completed,role,full_name,first_name,last_name,phone,country_code,avatar_url"
        )
        .eq("id", auth.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading profile", error);
      }

      if (!data) {
        setProfile({
          id: auth.user.id,
          email: auth.user.email ?? "",
          status: "active",
          onboarding_completed: false,
          full_name: "",
          first_name: "",
          last_name: "",
          phone: "",
          country_code: "+65",
          avatar_url: null,
          role: "Vendor",
        });
      } else {
        setProfile({
          ...data,
          full_name: data.full_name ?? "",
          first_name: data.first_name ?? "",
          last_name: data.last_name ?? "",
          phone: data.phone ?? "",
          country_code: data.country_code ?? "+65",
          role: data.role ?? "Vendor",
        });
      }

      setLoading(false);
    })();
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name,
        email: profile?.email,
        role: "Vendor",
        status: "Incomplete Registration",
      }),
    [profile]
  );

  /* ------------------- Avatar Upload ------------------- */

  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // reset input so re-selecting same file triggers change again
    e.target.value = "";

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      errorToast({
        title: "File too large",
        description: "Max avatar size is 1 MB.",
      });
      return;
    }

    const ext = file.name.split(".").pop();
    const filePath = `${profile.id}/${Date.now()}.${ext || "png"}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError || !uploadData) {
      console.error(uploadError);
      errorToast({
        title: "Upload failed",
        description:
          uploadError?.message || "There was a problem uploading your image.",
      });
      return;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(uploadData.path);

    // Update local state immediately
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            avatar_url: publicUrl,
          }
        : prev
    );

    // Persist avatar_url in DB right away (optional but nice UX)
    const { error: updateError } = await supabase.from("profiles").upsert(
      {
        id: profile.id,
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (updateError) {
      console.error(updateError);
      errorToast({
        title: "Error saving avatar",
        description: updateError.message,
      });
    } else {
      successToast({
        title: "Avatar updated",
        description: "Your profile picture has been updated.",
      });
    }
  };

  async function onSave() {
    if (!profile) return;
    setSaving(true);

    const {
      id,
      first_name,
      last_name,
      phone,
      country_code,
      full_name,
      email,
      avatar_url,
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
        avatar_url, // 👈 make sure avatar URL is persisted with the rest
        status: "active",
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    setSaving(false);
    if (error)
      errorToast({
        title: "Error",
        description: "Error saving settings: " + error.message,
      });
    else
      successToast({
        title: "Success",
        description: "Profile saved successfully!",
      });
  }

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-600">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left rail (dark) */}
      <Sidebar config={sidebarConfig} />

      {/* Settings section nav (light) */}
      <SettingsNav />

      {/* Scrollable content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10 lg:py-12">
          <h1 className="text-3xl font-semibold text-gray-900">
            Account Settings
          </h1>

          {/* Tabs */}
          <div className="mt-6 flex gap-8 border-b border-gray-200">
            <span className="border-b-2 border-gray-900 pb-3 text-sm font-semibold text-gray-900">
              Profile Information
            </span>
            <a
              href="/pages/setting/security"
              className="pb-3 text-sm text-gray-500 hover:text-gray-900"
            >
              Login &amp; Security
            </a>

            <a
              href="/pages/setting/notifications"
              className="pb-3 text-sm text-gray-500 hover:text-gray-900"
            >
              Notifications
            </a>
          </div>

          {/* Avatar row */}
          <div className="mt-6 flex items-center gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-full bg-gray-200">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url ?? ""}
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

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
                onClick={handleUploadButtonClick}
              >
                Upload Picture
              </button>
              <button
                type="button"
                className="rounded-full border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                onClick={async () => {
                  if (!profile) return;
                  setProfile({ ...profile, avatar_url: null });

                  const { error } = await supabase.from("profiles").upsert(
                    {
                      id: profile.id,
                      avatar_url: null,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "id" }
                  );

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

          <p className="mt-3 text-xs text-gray-500">
            Recommended size – 1:1 Square | 500 × 500 px. Max upload size – 1
            MB
          </p>

          {/* Form */}
          <form
            className="mt-8 space-y-12 pb-28" /* pb to leave space behind sticky bar */
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            {/* Name section */}
            <section>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="mb-2">
                    <div className="text-sm font-semibold text-gray-900">
                      Name
                    </div>
                    <p className="mt-1 max-w-[32ch] text-xs text-gray-500">
                      Your name helps us identify your account and contact you
                      regarding your vendor activity.
                    </p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-gray-500">
                      First Name
                    </label>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      value={profile.first_name || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, first_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500">
                      Last Name
                    </label>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      value={profile.last_name || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, last_name: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="mt-8 border-t border-gray-200" />
            </section>

            {/* Email section */}
            <section>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Email Address
                  </div>
                  <p className="mt-1 max-w-[42ch] text-xs text-gray-500">
                    Your registered email is used for login and vendor-related
                    notifications.
                  </p>
                  <p className="mt-2 text-xs text-purple-600">
                    *If you update your email, you’ll need to verify the new
                    address
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

            {/* Phone section */}
            <section>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Phone Number
                  </div>
                  <p className="mt-1 max-w-[42ch] text-xs text-gray-500">
                    Your contact number helps us reach you for onboarding,
                    verification, and support.
                  </p>
                </div>
                <div>
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
              </div>
              <div className="mt-8 border-t border-gray-200" />
            </section>

            {/* Role section */}
            <section>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    Account Role
                  </div>
                  <p className="mt-1 max-w-[42ch] text-xs text-gray-500">
                    Define your account role to manage permissions and access
                    levels within your company.
                  </p>
                </div>
                <div>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      value={profile.role || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, role: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="mt-8 border-t border-gray-200" />
            </section>

            {/* Sticky save bar */}
            <div className="fixed bottom-0 left-0 right-0 z-10 ml-[calc(300px+240px)] mr-0 border-t border-gray-200 bg-white/85 backdrop-blur">
              {/* ml equals dark rail (~300px) + settings rail (~240px); tweak if your widths differ */}
              <div className="mx-auto max-w-5xl px-8 py-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center rounded-full bg-black px-6 py-3 text-white hover:bg-gray-900 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
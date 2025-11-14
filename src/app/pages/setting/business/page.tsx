"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";
import { useToast } from "../../../../components/toast/ToastProvider";

/* ---------- Types ---------- */
type UserStatus = "pending_admin_approval" | "approved" | "active" | "rejected" | "suspended";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

type Business = {
  id: string;                     // auth.users.id
  brand_logo_url: string | null;
  brand_name: string;
  company_name: string;
  uen: string;
  incorporation_year: string;
  instagram: string;
  facebook: string;
  tiktok: string;
};

/* ---------- Page ---------- */
export default function SettingsBusinessPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [biz, setBiz] = useState<Business | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { successToast, errorToast } = useToast();

  // Load profile + business row (both empty-safe)
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return;

      // profile (for left rail name/email)
      const { data: prof } = await supabase
        .from("profiles")
        .select("id,email,status,onboarding_completed,full_name")
        .eq("id", user.id)
        .maybeSingle();

      setProfile(
        (prof as Profile) ?? {
          id: user.id,
          email: user.email ?? "",
          status: "active",
          onboarding_completed: false,
          full_name: user.email ?? "User",
        }
      );

      // business
      const { data: bizRow } = await supabase
        .from("vendor_business")
        .select(
          "id, brand_logo_url, brand_name, company_name, uen, incorporation_year, instagram, facebook, tiktok"
        )
        .eq("id", user.id)
        .maybeSingle();

      setBiz(
        (bizRow as Business) ?? {
          id: user.id,
          brand_logo_url: null,
          brand_name: "",
          company_name: "",
          uen: "",
          incorporation_year: "",
          instagram: "",
          facebook: "",
          tiktok: "",
        }
      );

      setLoading(false);
    })();
  }, []);

  // Sidebar config
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

  /* ---------- Upload brand logo to storage ---------- */
  async function handleUploadLogo(file: File) {
    if (!biz) return;
    const ext = file.name.split(".").pop() || "png";
    const path = `logos/${biz.id}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("brand-assets") // make sure this bucket exists and is public
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (upErr) {
      errorToast({ title: "Error", description: `Upload failed: ${upErr.message}` });
      return;
    }

    const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
    const url = data?.publicUrl ?? null;
    setBiz({ ...biz, brand_logo_url: url });
  }

  /* ---------- Save ---------- */
  async function onSave() {
    if (!biz) return;
    setSaving(true);

    const { error } = await supabase.from("vendor_business").upsert(
      {
        id: biz.id,
        brand_logo_url: biz.brand_logo_url,
        brand_name: biz.brand_name,
        company_name: biz.company_name,
        uen: biz.uen,
        incorporation_year: biz.incorporation_year,
        instagram: biz.instagram,
        facebook: biz.facebook,
        tiktok: biz.tiktok,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    setSaving(false);
    if (error) errorToast({ title: "Error", description: `Error saving: ${error.message}` });
    else successToast({ title: "Success", description: "Business information saved." });
  }

  if (loading || !profile || !biz) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-gray-600">Loading business settings…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left rail (dark) */}
      <Sidebar config={sidebarConfig} />

      {/* Settings section nav (light) */}
      <SettingsNav />

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-10 lg:py-12">
          <h1 className="text-3xl font-semibold text-gray-900">Business Settings</h1>

          {/* Tabs header (visual only here) */}
          <div className="mt-6 flex gap-8 border-b border-gray-200">
            <Link
              href="/pages/setting/business"
              className="pb-3 text-sm font-semibold text-gray-900 border-b-2 border-gray-900"
            >
              Business Information
            </Link>
            <Link href="/pages/setting/brand" className="pb-3 text-sm text-gray-500 hover:text-gray-900">
              Brand Story &amp; Offerings
            </Link>
            <Link href="/pages/setting/docs" className="pb-3 text-sm text-gray-500 hover:text-gray-900">
              Documents &amp; Agreements
            </Link>
            <Link href="/pages/setting/verification" className="pb-3 text-sm text-gray-500 hover:text-gray-900">
              Verification Status
            </Link>
          </div>

          {/* Verification banner */}
          <div className="mt-6 rounded-xl border border-black/10 bg-black text-white px-4 py-3 text-sm shadow-sm">
            <span className="font-medium">You cannot publish products, list services, or receive payouts</span>{" "}
            until your business is verified.
          </div>

          {/* FORM */}
          <form
            className="mt-8 space-y-12 pb-28"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            {/* Brand Logo */}
            <section>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Brand Logo</div>
                  <p className="mt-1 text-xs text-gray-500">Square image, 500×500px recommended.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-gray-100">
                    {biz.brand_logo_url ? (
                      <Image
                        src={biz.brand_logo_url}
                        alt="Brand logo"
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-gray-400">No Logo</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadLogo(f);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
                    >
                      Upload Logo
                    </button>
                    {biz.brand_logo_url && (
                      <button
                        type="button"
                        onClick={() => setBiz({ ...biz, brand_logo_url: null })}
                        className="rounded-full border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-8 border-t border-gray-200" />
            </section>

            {/* Brand / Company names */}
            <section>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Business / Brand Name</div>
                  <p className="mt-1 text-xs text-gray-500">
                    Displayed across the marketplace and on your MEURAKI listings.
                  </p>
                </div>
                <div>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="e.g. Wellness Club Co."
                    value={biz.brand_name}
                    onChange={(e) => setBiz({ ...biz, brand_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Registered Company Name</div>
                  <p className="mt-1 text-xs text-gray-500">
                    Legal name on ACRA or your government registration. Used for verification and payouts.
                  </p>
                </div>
                <div>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="e.g. WellnessClub PTE LTD."
                    value={biz.company_name}
                    onChange={(e) => setBiz({ ...biz, company_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">UEN / Business Registration No.</div>
                  <p className="mt-1 text-xs text-gray-500">Official registration number for your business.</p>
                </div>
                <div>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="e.g. 202302893X"
                    value={biz.uen}
                    onChange={(e) => setBiz({ ...biz, uen: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Year of Incorporation</div>
                </div>
                <div>
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="e.g. 2024"
                    value={biz.incorporation_year}
                    onChange={(e) => setBiz({ ...biz, incorporation_year: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-8 border-t border-gray-200" />
            </section>

            {/* Social Links */}
            <section>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Social Media Links</div>
                  <p className="mt-1 text-xs text-gray-500">Provide links to your business pages.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Instagram</label>
                    <input
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      placeholder="https://www.instagram.com/yourbrand"
                      value={biz.instagram}
                      onChange={(e) => setBiz({ ...biz, instagram: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Facebook</label>
                    <input
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      placeholder="https://www.facebook.com/yourbrand"
                      value={biz.facebook}
                      onChange={(e) => setBiz({ ...biz, facebook: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Tiktok</label>
                    <input
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                      placeholder="https://www.tiktok.com/@yourbrand"
                      value={biz.tiktok}
                      onChange={(e) => setBiz({ ...biz, tiktok: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-gray-200" />
            </section>

            {/* Sticky actions */}
            <div className="fixed bottom-0 left-0 right-0 z-10 ml-[calc(300px+280px)] bg-white/85 backdrop-blur border-t border-gray-200">
              <div className="mx-auto max-w-5xl px-8 py-4 flex items-center gap-3">
                <Link
                  href="/pages/dashboard"
                  className="rounded-full border border-gray-300 px-5 py-2.5 text-sm hover:bg-gray-50"
                >
                  Go back without saving
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="ml-auto inline-flex items-center rounded-full bg-black px-6 py-3 text-white hover:bg-gray-900 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

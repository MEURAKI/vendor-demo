// app/pages/providers/page.tsx
"use client";

import { useVendorProfile } from "../../../../context/VendorShellContext";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";

import { supabase } from "../../../../lib/supabase/client";
import ClipLoader from "react-spinners/ClipLoader";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";

type ProviderStatus = "draft" | "active" | "unavailable";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed: boolean;
};

type ProviderRow = {
  id: string;
  name: string;
  specialisationAreas: string | null;
  whatsappCountryCode: string | null;
  whatsappNumber: string | null;
  wellnessDimensions: string[];
  categories: string[];
  status: ProviderStatus;
  coverImageUrl: string | null;
};

export default function ProvidersPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);


  // -------- load profile for sidebar --------
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (data) setProfile(data as Profile);
    })();
  }, []);
  // -------- load providers --------
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/providers");
        const json = await res.json();
        if (!mounted) return;

        if (!res.ok) {
          console.error(json);
          setRows([]);
          return;
        }

        const mapped: ProviderRow[] = (json.providers ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          specialisationAreas: p.specialisation_areas ?? null,
          whatsappCountryCode: p.whatsapp_country_code ?? null,
          whatsappNumber: p.whatsapp_number ?? null,
          wellnessDimensions: p.wellness_dimensions ?? [],
          categories: p.categories ?? [],
          status: p.status,
          coverImageUrl: p.cover_image_url ?? null,
        }));
        setRows(mapped);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.specialisationAreas ?? "").toLowerCase().includes(q) ||
      r.wellnessDimensions.join(" ").toLowerCase().includes(q)
    );
  });

  function formatStatus(s: ProviderStatus) {
    if (s === "active") return "Active";
    if (s === "unavailable") return "Unavailable";
    return "Draft";
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this provider? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/providers/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        console.error(json);
        alert(json.error || "Error deleting provider");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#1B1529]">
                All Providers
              </h1>
              <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
                {rows.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search provider"
className="
      w-60
      rounded-full
      bg-white
      pl-11
      pr-4
      py-2
      text-xs
      text-gray-700
      shadow-sm
      border border-gray-200
      placeholder:text-gray-400
      focus:border-[#7C3AED]
      focus:ring-2 
      focus:ring-[#E9D8FD] 
      focus:outline-none
      transition-all
    "
  />                

              {/* Add button */}
              <button
                type="button"
                onClick={() =>
                  (window.location.href = "/pages/services/providers/new")
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-lg font-semibold text-white"
              >
                +
              </button>
            </div>
          </div>

          {/* Table area */}
          <div className="flex-1 overflow-auto p-6">
            <div className="min-h-0 overflow-auto rounded-2xl border border-[#ECECFB] bg-white">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-10 bg-[#F6F5FF] text-[11px] font-semibold text-gray-500 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 text-left">Provider</th>
                    <th className="px-4 py-3 text-left">
                      Specialisation Areas
                    </th>
                    <th className="px-4 py-3 text-left">Whatsapp</th>
                    <th className="px-4 py-3 text-left">
                      Wellness Dimensions
                    </th>
                    <th className="px-4 py-3 text-left">Categories</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-xs text-gray-500"
                      >
                                <ClipLoader size={40} color="#6B46C1" cssOverride={{ animationDuration: "3s" }}/>


                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-16 text-center text-xs text-gray-500"
                      >
                        No providers found. Try adjusting your search.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p, idx) => (
                      <tr
                        key={p.id}
                        className={clsx(
                          "border-t border-gray-100",
                          idx % 2 === 1 && "bg-[#FBFBFE]"
                        )}
                      >
                        {/* Provider + avatar */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-gray-200">
                              {p.coverImageUrl && (
                                <Image
                                  src={p.coverImageUrl}
                                  alt={p.name}
                                  fill
                                  className="object-cover"
                                />
                              )}
                            </div>
                            <div className="text-xs font-semibold text-gray-900">
                              {p.name}
                            </div>
                          </div>
                        </td>

                        {/* Specialisation */}
                        <td className="px-4 py-3 text-[11px] text-gray-600">
                          {p.specialisationAreas || "—"}
                        </td>

                        {/* WhatsApp */}
                        <td className="px-4 py-3 text-[11px] text-purple-700">
                          {p.whatsappNumber
                            ? `${p.whatsappCountryCode ?? ""} ${
                                p.whatsappNumber
                              }`
                            : "—"}
                        </td>

                        {/* Wellness */}
                        <td className="px-4 py-3 text-[11px] text-gray-600">
                          {p.wellnessDimensions.length
                            ? p.wellnessDimensions.join(", ")
                            : "—"}
                        </td>

                        {/* Categories */}
                        <td className="px-4 py-3 text-[11px] text-gray-600">
                          {p.categories.length
                            ? p.categories.join(", ")
                            : "—"}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={clsx(
                              "inline-flex h-7 items-center rounded-full px-3 text-[11px] font-semibold",
                              p.status === "active" &&
                                "bg-[#DCFCE7] text-[#166534]",
                              p.status === "unavailable" &&
                                "bg-[#FEE2E2] text-[#B91C1C]",
                              p.status === "draft" &&
                                "bg-gray-200 text-gray-700"
                            )}
                          >
                            {formatStatus(p.status)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className="rounded-full bg-black px-4 py-1.5 text-[11px] font-semibold text-white"
                              onClick={() =>
                                (window.location.href = `/pages/services/providers/${p.id}/edit`)
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === p.id}
                              onClick={() => handleDelete(p.id)}
                              className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-[11px] font-semibold text-gray-700 disabled:opacity-40"
                            >
                              {deletingId === p.id ? "Deleting…" : "Trash"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-[11px] text-gray-500">
              Showing {filtered.length} providers
            </div>
          </div>
        </>
  );
}
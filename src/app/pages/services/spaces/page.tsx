// app/pages/spaces/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import Sidebar from "../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";

type SpaceRow = {
  id: string;
  name: string;
  address: string | null;
  spaceType: "in_person" | "online" | "hybrid";
  whatsappNumber: string | null;
  mapLink: string | null;
  status: "draft" | "active" | "unavailable";
  coverImageUrl: string | null;
};

type SpaceType = "in_person" | "online" | "hybrid";
type UserStatus = "active" | "inactive" | "pending";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

export default function SpacesPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<SpaceRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function init() {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id,email,full_name")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (mounted && prof) setProfile(prof as Profile);
      }

      const res = await fetch("/api/spaces");
      const json = await res.json();
      if (mounted && res.ok) {
        const mapped: SpaceRow[] = (json.spaces ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          address: s.address ?? "",
          spaceType: s.space_type,
          whatsappNumber: s.whatsapp_number,
          mapLink: s.map_link,
          status: s.status,
          coverImageUrl: s.cover_image_url,
        }));
        setRows(mapped);
      }
      if (mounted) setLoading(false);
    }
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? "",
        role: "Vendor",
       status: profile?.status ?? "active"
      }),
    [profile]
  );

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.address ?? "").toLowerCase().includes(q)
    );
  });

  function renderTypeLabel(t: SpaceType) {
    if (t === "online") return "Online";
    if (t === "hybrid") return "Hybrid";
    return "In Person";
  }

  function renderStatusLabel(s: SpaceRow["status"]) {
    if (s === "draft") return "Draft";
    if (s === "active") return "Active";
    return "Unavailable";
  }

  return (
    <div className="flex h-screen w-screen bg-[#050509] overflow-hidden">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* TOP BAR */}
          <div className="flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            {/* Left: title + count */}
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#1B1529]">
                All Spaces
              </h1>
              <span className="inline-flex h-7 items-center rounded-full bg-[#B266FF] px-3 text-xs font-semibold text-white">
                {rows.length}
              </span>
            </div>

            {/* Right: bulk / filter / search / + */}
            <div className="flex items-center gap-3">
              {/* Bulk actions button */}
              {/* <button
                type="button"
                className="hidden md:inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm"
              >
                Bulk Actions
                <span className="text-xs">›</span>
              </button> */}

              {/* Filter by button */}
              {/* <button
                type="button"
                className="hidden md:inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm"
              >
                Filter by
                <span className="text-[10px]">▼</span>
              </button> */}

              {/* Search pill */}
              
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Space"
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

              {/* Add new space button */}
              <button
                type="button"
                onClick={() => router.push("/pages/services/spaces/new")} // adjust route if needed
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-lg text-white shadow-md"
              >
                +
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="flex-1 overflow-auto p-6">
            <div className="min-h-0 overflow-auto rounded-2xl border border-[#ECECFB] bg-white">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 z-20 bg-[#F6F5FF] text-[11px] font-semibold text-gray-500 shadow-sm">
                  <tr>
                    <th className="px-3 py-3 text-left">Service Name</th>
                    <th className="px-3 py-3 text-left">Address</th>
                    <th className="px-3 py-3 text-left">Type</th>
                    <th className="px-3 py-3 text-left">Contact Number</th>
                    <th className="px-3 py-3 text-left">Map / Meeting Link</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-xs text-gray-500"
                      >
                        Loading spaces…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-16 text-center text-xs text-gray-500"
                      >
                        No spaces found. Try adjusting your search.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r, idx) => (
                      <tr
                        key={r.id}
                        className={clsx(
                          "border-t border-gray-100",
                          idx % 2 === 1 && "bg-[#FBFBFE]"
                        )}
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-gray-200">
                              {r.coverImageUrl && (
                                <Image
                                  src={r.coverImageUrl}
                                  alt={r.name}
                                  fill
                                  className="object-cover"
                                />
                              )}
                            </div>
                            <div className="text-xs font-semibold text-gray-900">
                              {r.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[11px] text-gray-600">
                          {r.address}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-gray-600">
                          {renderTypeLabel(r.spaceType)}
                        </td>
                        <td className="px-3 py-3 text-[11px] text-purple-700">
                          {r.whatsappNumber || "—"}
                        </td>
                        <td className="px-3 py-3 text-[11px]">
                          {r.mapLink ? (
                            <a
                              href={r.mapLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-blue-600 underline"
                            >
                              View
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={clsx(
                              "inline-flex h-7 items-center rounded-full px-3 text-[11px] font-semibold",
                              r.status === "active" &&
                                "bg-[#DCFCE7] text-[#166534]",
                              r.status === "unavailable" &&
                                "bg-[#FEE2E2] text-[#B91C1C]",
                              r.status === "draft" &&
                                "bg-gray-200 text-gray-700"
                            )}
                          >
                            {renderStatusLabel(r.status)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            className="rounded-full bg-black px-4 py-1.5 text-[11px] font-semibold text-white"
                            onClick={() =>
                              router.push(`/pages/services/spaces/${r.id}/edit`)
                            }
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-[11px] text-gray-500">
              Showing {filtered.length} spaces
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
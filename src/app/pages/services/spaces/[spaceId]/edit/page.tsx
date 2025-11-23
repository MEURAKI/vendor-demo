// app/pages/services/spaces/[spaceId]/edit/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

import Sidebar from "../../../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../../../lib/supabase/client";
import WellnessCategoryTagsSection, { WellnessOption } from "../../../../../../components/taxonomy/WellnessCategoryTagsSection";
import { useAuthGuard } from "../../../../../../hooks/useAuthGuard";
import ClipLoader from "react-spinners/ClipLoader";

type SpaceType = "in_person" | "online" | "hybrid";
type SpaceStatus = "draft" | "active" | "unavailable";

type UserStatus = "active" | "inactive" | "pending";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

type LoadedSpace = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  postal_code: string | null;
  space_type: SpaceType;
  whatsapp_number: string | null;
  map_link: string | null;
  gbusiness_id: string | null;
  status: SpaceStatus;
  cover_image_url: string | null;
  gallery_image_urls?: string[] | null;
  wellness_dimensions?: string[] | null;
  categories?: string[] | null;
  tags?: string[] | null;
};

const SPACE_BUCKET = "space-images"; // <- change if your bucket has a different name

export default function EditSpacePage({
  params,
}: {
  params: { spaceId: string };
}) {
  const router = useRouter();
  const { spaceId } = params;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  // left column
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [spaceType, setSpaceType] = useState<SpaceType>("in_person");
  const [gmapLink, setGmapLink] = useState("");
  const [gbusinessId, setGbusinessId] = useState("");

  // right column
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [status, setStatus] = useState<SpaceStatus>("draft");

  const [wellness, setWellness] = useState<string[]>([]);


    const [wellnessOptions, setWellnessOptions] = useState<WellnessOption[]>([]);
  const [selectedWellnessIds, setSelectedWellnessIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);


  // ------- profile for sidebar -------
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (prof) setProfile(prof as Profile);

              // wellness dimensions (for UI cards)
              const { data: wellnessData } = await supabase
                .from("wellness_dimensions")
                .select("id,name,slug");
      
              setWellnessOptions((wellnessData ?? []) as WellnessOption[]);
      
    })();
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

  // ------- load existing space -------
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/spaces/${spaceId}`);
        const json = await res.json();

        if (!res.ok) {
          console.error("Failed to load space", json);
          return;
        }

        const s: LoadedSpace = json.space ?? json;
        if (!mounted) return;

        setName(s.name ?? "");
        setDescription(s.description ?? "");
        setAddress(s.address ?? "");
        setPostalCode(s.postal_code ?? "");
        setSpaceType(s.space_type ?? "in_person");
        setWhatsappNumber(s.whatsapp_number ?? "");
        setGmapLink(s.map_link ?? "");
        setGbusinessId(s.gbusiness_id ?? "");
        setStatus(s.status ?? "draft");
        setCoverImageUrl(s.cover_image_url ?? null);
        setGallery(s.gallery_image_urls ?? []);
        setWellness(s.wellness_dimensions ?? []);
        setCategories(s.categories ?? []);
        setTags((s.tags ?? []));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (spaceId) void load();
    return () => {
      mounted = false;
    };
  }, [spaceId]);

  const canSave = name.trim().length > 0;

  // ------- helper: upload to storage & return public URL -------
  async function uploadToSpaceBucket(
    file: File,
    kind: "cover" | "gallery"
  ): Promise<string | null> {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${spaceId}/${kind}-${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(SPACE_BUCKET)
      .upload(path, file, {
        upsert: true,
      });

    if (error || !data) {
      console.error("Upload error", error);
      alert("Error uploading image");
      return null;
    }

    const { data: pub } = supabase.storage
      .from(SPACE_BUCKET)
      .getPublicUrl(data.path);

    return pub.publicUrl ?? null;
  }

  // ------- save -------
  async function handleSave(nextStatus: SpaceStatus) {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const body = {
        name,
        description,
        address,
        postal_code: postalCode || null,
        space_type: spaceType,
        whatsapp_number: whatsappNumber || null,
        map_link: gmapLink || null,
        gbusiness_id: gbusinessId || null,
        status: nextStatus,
        cover_image_url: coverImageUrl,
        gallery_image_urls: gallery,
        wellness_dimensions: wellness,
        categories,
        tags,
      };

      const res = await fetch(`/api/spaces/${spaceId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error(json);
        alert(json.error || "Error updating space");
        return;
      }

      router.push("/pages/services/spaces");
    } finally {
      setSaving(false);
    }
  }

  // ------- image handlers (with upload) -------
  async function handleCoverUpload(file: File | null) {
    if (!file) return;

    // quick local preview
    const localUrl = URL.createObjectURL(file);
    setCoverImageUrl(localUrl);

    setUploadingCover(true);
    const publicUrl = await uploadToSpaceBucket(file, "cover");
    setUploadingCover(false);

    if (publicUrl) {
      setCoverImageUrl(publicUrl);
      setGallery((prev) => {
        // ensure cover is included as first gallery image
        const without = prev.filter((u) => u !== publicUrl);
        return [publicUrl, ...without].slice(0, 5);
      });
    }
  }

  async function handleGalleryUpload(file: File | null) {
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setGallery((g) => [...g, localUrl].slice(0, 5));

    setUploadingGallery(true);
    const publicUrl = await uploadToSpaceBucket(file, "gallery");
    setUploadingGallery(false);

    if (publicUrl) {
      setGallery((prev) => {
        const withoutLocal = prev.filter((u) => u !== localUrl);
        return [...withoutLocal, publicUrl].slice(0, 5);
      });
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050509]">
                <ClipLoader size="md" color="gray" />

      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#050509] overflow-hidden">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* header */}
          <div className="flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <h1 className="text-xl font-semibold text-[#1B1529]">
              Edit space
            </h1>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!canSave || saving}
                onClick={() => handleSave("draft")}
                className="h-10 rounded-full border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={!canSave || saving}
                onClick={() => handleSave("active")}
                className={clsx(
                  "h-10 rounded-full px-6 text-sm font-semibold text-white",
                  canSave && !saving
                    ? "bg-black hover:bg-gray-900"
                    : "cursor-not-allowed bg-gray-300"
                )}
              >
                Update Space
              </button>
            </div>
          </div>

          {/* body */}
          <div className="grid flex-1 gap-6 overflow-auto px-8 py-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            {/* LEFT COLUMN */}
            <div className="space-y-6">
              {/* General info */}
              <section className="rounded-2xl border bg-[#FBFBFE] p-6">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                  General Information
                </h2>
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700">
                      Wellness Space Name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700">
                      Wellness Space Description
                    </label>
                    <textarea
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              </section>

              {/* Space type & location */}
              <section className="rounded-2xl border bg-[#FBFBFE] p-6">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                  Space Type &amp; Location
                </h2>
                <div className="space-y-4 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700">
                      Type
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["in_person", "online", "hybrid"] as SpaceType[]).map(
                        (t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setSpaceType(t)}
                            className={clsx(
                              "rounded-full border px-3 py-1 text-[11px] font-semibold",
                              spaceType === t
                                ? "border-black bg-black text-white"
                                : "border-gray-300 bg-white text-gray-700"
                            )}
                          >
                            {t === "in_person"
                              ? "In Person"
                              : t === "online"
                              ? "Online"
                              : "Hybrid"}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700">
                      Address
                    </label>
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-700">
                        Google Maps Link
                      </label>
                      <input
                        value={gmapLink}
                        onChange={(e) => setGmapLink(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-700">
                        Postal Code
                      </label>
                      <input
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700">
                      Google Business Page ID
                    </label>
                    <input
                      value={gbusinessId}
                      onChange={(e) => setGbusinessId(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
              {/* Images */}
              <section className="rounded-2xl border bg-[#FBFBFE] p-6">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                  Wellness Space Images
                </h2>

                {/* main image */}
                <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-200">
                  {coverImageUrl ? (
                    <img
                      src={coverImageUrl}
                      alt="Space cover"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                      No image yet
                    </div>
                  )}
                </div>

                {/* thumbnails */}
                <div className="mt-3 flex gap-2">
                  {gallery.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative h-14 w-14 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
                    >
                      <img
                        src={src}
                        alt={`Space image ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}

                  {gallery.length < 5 && (
                    <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-xl text-gray-400">
                      {uploadingGallery ? "…" : "+"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          handleGalleryUpload(e.target.files?.[0] ?? null)
                        }
                      />
                    </label>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <p className="text-gray-500">
                    Upload a high-resolution cover image and up to 5 gallery
                    images.
                  </p>
                  <label className="cursor-pointer rounded-full bg-black px-4 py-2 text-[11px] font-semibold text-white">
                    {uploadingCover ? "Uploading…" : "Change Cover"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleCoverUpload(e.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                </div>
              </section>

              {/* Contact */}
              <section className="rounded-2xl border bg-[#FBFBFE] p-6">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-700">
                  Contact Details
                </h2>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700">
                      Whatsapp Number
                    </label>
                    <div className="mt-2 flex gap-2">
                      <span className="inline-flex h-9 items-center rounded-2xl border border-gray-200 bg-white px-3 text-[11px]">
                        +65
                      </span>
                      <input
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        className="h-9 flex-1 rounded-2xl border border-gray-200 bg-white px-3 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Tags */}
            <WellnessCategoryTagsSection
                              title="Wellness Dimension, Category & Tags"
                              wellnessOptions={wellnessOptions}
                              selectedWellnessIds={selectedWellnessIds}
                              onChangeWellness={setSelectedWellnessIds}
                              categories={categories}
                              onChangeCategories={setCategories}
                              tags={tags}
                              onChangeTags={setTags}
                            />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
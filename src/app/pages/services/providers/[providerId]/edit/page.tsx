"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import Sidebar from "../../../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../../../lib/supabase/client";
import { uploadProviderImage } from "../../../../../../lib/uploadProviderImage";
import WellnessCategoryTagsSection, { WellnessOption } from "../../../../../../components/taxonomy/WellnessCategoryTagsSection";
import { useAuthGuard } from "../../../../../../hooks/useAuthGuard";
import ClipLoader from "react-spinners/ClipLoader";

type ProviderStatus = "draft" | "active" | "unavailable";

type UserStatus = "active" | "inactive" | "pending";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

type LoadedImageRow = {
  id: string;
  image_url: string;
  position: number;
};

type Qualification = {
  title: string;
  institute: string;
  year: string;
};

type LoadedProvider = {
  id: string;
  name: string;
  specialisation_areas: string | null;
  description: string | null;
  whatsapp_country_code: string | null;
  whatsapp_number: string | null;
  wellness_dimensions: string[] | null;
  categories: string[] | null;
  tags: string[] | null;
  status: ProviderStatus;
  cover_image_url: string | null;
  images?: LoadedImageRow[];
  qualifications?: Qualification[] | null;
};

export default function EditProviderPage({
  params,
}: {
  params: { providerId: string };
}) {
  const { providerId } = params;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // main fields
  const [name, setName] = useState("");
  const [specialisationAreas, setSpecialisationAreas] = useState("");
  const [description, setDescription] = useState("");

  const [whatsCountry, setWhatsCountry] = useState("+65");
  const [whatsNumber, setWhatsNumber] = useState("");

  const [wellness, setWellness] = useState<string[]>([]);

  // images: first = cover, rest = gallery
  const [images, setImages] = useState<string[]>([]);

  const [status, setStatus] = useState<ProviderStatus>("draft");

  // qualifications
  const [qualificationsOpen, setQualificationsOpen] = useState(true);
  const [qualifications, setQualifications] = useState<Qualification[]>([
    { title: "", institute: "", year: "" },
  ]);


    const [wellnessOptions, setWellnessOptions] = useState<WellnessOption[]>([]);
  const [selectedWellnessIds, setSelectedWellnessIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);


  // ---- Load profile for sidebar ----
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

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? "",
        role: "Vendor",
        status: "Incomplete Registration",
      }),
    [profile]
  );

  // ---- Load existing provider ----
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/providers/${providerId}`);
        const json = await res.json();

        if (!res.ok) {
          console.error("Failed to load provider", json);
          return;
        }

        const p: LoadedProvider = json.provider ?? json;

        if (!mounted) return;

        setName(p.name ?? "");
        setSpecialisationAreas(p.specialisation_areas ?? "");
        setDescription(p.description ?? "");
        setWhatsCountry(p.whatsapp_country_code ?? "+65");
        setWhatsNumber(p.whatsapp_number ?? "");
        setWellness(p.wellness_dimensions ?? []);
        setCategories(p.categories ?? []);
        setTags((p.tags ?? []));
        setStatus(p.status ?? "draft");

                // wellness dimensions (for UI cards)
                const { data: wellnessData } = await supabase
                  .from("wellness_dimensions")
                  .select("id,name,slug");
        
                setWellnessOptions((wellnessData ?? []) as WellnessOption[]);
        
                // images

        // Qualifications
        if (p.qualifications && p.qualifications.length > 0) {
          setQualifications(
            p.qualifications.map((q) => ({
              title: q.title ?? "",
              institute: q.institute ?? "",
              year: q.year ?? "",
            }))
          );
        } else {
          setQualifications([{ title: "", institute: "", year: "" }]);
        }

        // build images array: cover first, then ordered gallery
        const imgArr: string[] = [];
        if (p.cover_image_url) imgArr.push(p.cover_image_url);

        if (p.images && p.images.length) {
          const sorted = [...p.images].sort((a, b) => a.position - b.position);
          for (const row of sorted) {
            if (!imgArr.includes(row.image_url)) {
              imgArr.push(row.image_url);
            }
          }
        }

        setImages(imgArr);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (providerId) void load();

    return () => {
      mounted = false;
    };
  }, [providerId]);

  const canSave =
    name.trim().length > 0 && whatsNumber.trim().length > 0 && !saving;

  // ---- Image handlers ----
  async function handleAddImages(files: FileList | null) {
    if (!files || !files.length) return;
    setSaving(true);
    try {
      const uploads: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadProviderImage(file);
        if (url) uploads.push(url);
      }
      setImages((prev) => {
        const merged = [...prev, ...uploads];
        return merged.slice(0, 6); // 1 cover + 5 gallery
      });
    } finally {
      setSaving(false);
    }
  }

  function handleMakeCover(index: number) {
    if (index === 0) return;
    setImages((prev) => {
      const arr = [...prev];
      const [img] = arr.splice(index, 1);
      arr.unshift(img);
      return arr;
    });
  }

  function handleRemoveImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  // ---- Qualifications handlers ----
  function addQualification(afterIndex?: number) {
    setQualifications((prev) => {
      const next = [...prev];
      const insertIndex =
        afterIndex !== undefined ? afterIndex + 1 : prev.length;
      next.splice(insertIndex, 0, { title: "", institute: "", year: "" });
      return next;
    });
  }

  function removeQualification(index: number) {
    setQualifications((prev) => {
      if (prev.length === 1) {
        // keep at least one block – just clear it
        return [{ title: "", institute: "", year: "" }];
      }
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }

  function updateQualification(
    index: number,
    field: keyof Qualification,
    value: string
  ) {
    setQualifications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  // ---- Save (PUT) ----
  async function handleSave(nextStatus: ProviderStatus) {
    if (!canSave) return;
    setSaving(true);

    try {
      const cleanedQualifications = qualifications.filter(
        (q) =>
          q.title.trim() !== "" ||
          q.institute.trim() !== "" ||
          q.year.trim() !== ""
      );

      const body = {
        name,
        specialisationAreas,
        description,
        status: nextStatus,
        whatsappCountryCode: whatsCountry,
        whatsappNumber: whatsNumber,
        wellnessDimensions: wellness,
        categories,
        tags,
        images,
        qualifications: cleanedQualifications,
      };

      const res = await fetch(`/api/providers/${providerId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        console.error(json);
        alert(json.error || "Error updating provider");
        return;
      }

      window.location.href = "/pages/services/providers";
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#050509]">
        <p className="text-xs text-gray-300">Loading provider…</p>
      </div>
    );
  }

  const cover = images[0] ?? null;
  const gallery = images.slice(1);

  return (
    <div className="flex h-screen w-screen bg-[#050509] overflow-hidden">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <h1 className="text-xl font-semibold text-[#1B1529]">
              Edit provider
            </h1>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!canSave}
                onClick={() => handleSave("draft")}
                className="h-9 rounded-full border border-gray-300 bg.white px-4 text-xs font-medium text-gray-800 disabled:opacity-40"
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={() => handleSave("active")}
                className={clsx(
                  "h-9 rounded-full px-6 text-xs font-semibold text-white",
                  canSave
                    ? "bg-black hover:bg-gray-900"
                    : "cursor-not-allowed bg-gray-300"
                )}
              >
                Update Provider
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(320px,1.1fr)]">
              {/* LEFT column */}
              <div className="space-y-6">
                {/* General info */}
                <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                  <h2 className="mb-4 text-sm font-semibold text-gray-900">
                    General Information
                  </h2>
                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Provider Name
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Specialisation Areas
                      </label>
                      <textarea
                        value={specialisationAreas}
                        onChange={(e) =>
                          setSpecialisationAreas(e.target.value)
                        }
                        rows={3}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Provider Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </section>

                {/* Qualifications */}
                <section className="rounded-3xl border border-[#ECECFB] bg-white">
                  <button
                    type="button"
                    onClick={() =>
                      setQualificationsOpen((prev) => !prev)
                    }
                    className="flex w-full items-center justify-between px-6 py-4 text-sm font-semibold text-gray-900"
                  >
                    <span>Qualifications</span>
                    <span
                      className={clsx(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-gray-50 text-xs transition-transform",
                        qualificationsOpen ? "rotate-180" : "rotate-0"
                      )}
                    >
                      ▾
                    </span>
                  </button>

                  {qualificationsOpen && (
                    <div className="space-y-5 border-t border-[#ECECFB] p-6 pb-5 text-xs">
                      {qualifications.map((q, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-gray-200 bg-[#FBFBFE] p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-purple-600">
                              Qualification {idx + 1}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => removeQualification(idx)}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-700 hover:bg-gray-300"
                                aria-label="Remove qualification"
                              >
                                ✕
                              </button>
                              <button
                                type="button"
                                onClick={() => addQualification(idx)}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs text-white hover:bg-gray-900"
                                aria-label="Add qualification"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="text-[11px] font-semibold text-gray-700">
                                Qualification Title (Displayed on app)
                              </label>
                              <input
                                value={q.title}
                                onChange={(e) =>
                                  updateQualification(
                                    idx,
                                    "title",
                                    e.target.value
                                  )
                                }
                                className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:border-purple-500 focus:outline-none"
                                placeholder="Birth Doula Certification"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-gray-700">
                                Institute (Displayed on app)
                              </label>
                              <input
                                value={q.institute}
                                onChange={(e) =>
                                  updateQualification(
                                    idx,
                                    "institute",
                                    e.target.value
                                  )
                                }
                                className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg.white px-3 text-xs text-gray-900 focus:border-purple-500 focus:outline-none"
                                placeholder="Childbirth International"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-gray-700">
                                Year
                              </label>
                              <input
                                value={q.year}
                                onChange={(e) =>
                                  updateQualification(
                                    idx,
                                    "year",
                                    e.target.value
                                  )
                                }
                                className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:border-purple-500 focus:outline-none"
                                placeholder="2013"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => addQualification()}
                        className="mt-1 inline-flex items-center gap-2 rounded-full border border-dashed border-gray-300 bg-white px-4 py-2 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <span className="flex h-4 w-4 items-center justify.center rounded-full bg-black text-[10px] text-white">
                          +
                        </span>
                        Add another qualification
                      </button>
                    </div>
                  )}
                </section>
              </div>

              {/* RIGHT column */}
              <div className="space-y-6">
                {/* Provider images */}
                <section className="rounded-3xl border border-[#ECECFB] bg-white p-5">
                  <h2 className="mb-3 text-sm font-semibold text-gray-900">
                    Provider Images
                  </h2>

                  <div className="overflow-hidden rounded-3xl bg-gray-200">
                    {cover ? (
                      <img
                        src={cover}
                        alt="Provider cover"
                        className="h-56 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-56 items-center justify-center text-xs text-gray-500">
                        Main provider image
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    {[cover, ...gallery].map((url, idx) => {
                      if (!url) return null;
                      return (
                        <button
                          key={url + idx}
                          type="button"
                          onClick={() => handleMakeCover(idx)}
                          className={clsx(
                            "relative h-14 w-14 overflow-hidden rounded-2xl border bg-gray-100",
                            idx === 0
                              ? "border-black ring-2 ring-black"
                              : "border-gray-200"
                          )}
                        >
                          <img
                            src={url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute left-1 top-1 rounded-full bg-black/70 px-1.5 text-[9px] font-semibold text-white">
                            {idx === 0 ? "Cover" : idx + 1}
                          </span>
                          {idx > 0 && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveImage(idx);
                              }}
                              className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] text-white"
                            >
                              ×
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {images.length < 6 && (
                      <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-[#F5F5F8] text-xl text-gray-500">
                        +
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) =>
                            handleAddImages(e.target.files)
                          }
                        />
                      </label>
                    )}
                  </div>

                  <p className="mt-2 text-[10px] text-gray-500">
                    First image is used as the profile cover. Upload a
                    high-resolution image and up to 5 additional photos.
                  </p>
                </section>

                {/* Contact details */}
                <section className="rounded-3xl border border-[#ECECFB] bg-white p-5">
                  <h2 className="mb-3 text-sm font-semibold text-gray-900">
                    Contact Details
                  </h2>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Whatsapp Number
                      </label>
                      <div className="mt-2 flex gap-2">
                        <input
                          value={whatsCountry}
                          onChange={(e) => setWhatsCountry(e.target.value)}
                          className="h-9 w-20 rounded-2xl border border-gray-200 bg-[#FBFBFE] px-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                        <input
                          value={whatsNumber}
                          onChange={(e) => setWhatsNumber(e.target.value)}
                          className="h-9 flex-1 rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 text-xs focus:border-purple-500 focus:outline-none"
                          placeholder="0000 0000"
                        />
                      </div>
                    </div>
                  </div>
                </section>

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
    </div>
  );
}
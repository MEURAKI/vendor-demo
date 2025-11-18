// app/pages/providers/new/page.tsx
"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import Sidebar from "../../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../../lib/supabase/client";
import { uploadProviderImage } from "../../../../../lib/uploadProviderImage";
import WellnessCategoryTagsSection, { WellnessOption } from "../../../../../components/taxonomy/WellnessCategoryTagsSection";

type ProviderStatus = "draft" | "active" | "unavailable";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed: boolean;
};

type Qualification = {
  title: string;
  institute: string;
  year: string;
};

export default function NewProviderPage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  const [name, setName] = useState("");
  const [specialisationAreas, setSpecialisationAreas] = useState("");
  const [description, setDescription] = useState("");

  const [whatsCountry, setWhatsCountry] = useState("+65");
  const [whatsNumber, setWhatsNumber] = useState("");

  const [wellness, setWellness] = useState<string[]>([])

  // images – first item is the main provider image
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Qualifications
  const [qualificationsOpen, setQualificationsOpen] = useState(true);
  const [qualifications, setQualifications] = useState<Qualification[]>([
    { title: "", institute: "", year: "" },
  ]);

    const [wellnessOptions, setWellnessOptions] = useState<WellnessOption[]>([]);
  const [selectedWellnessIds, setSelectedWellnessIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  // --------- load profile for sidebar ----------
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

  const canSave = name.trim().length > 0 && whatsNumber.trim().length > 0;

  // --------- image handlers ----------

  async function handleAddImages(files: FileList | null) {
    if (!files || !files.length) return;
    const uploads: string[] = [];

    for (const file of Array.from(files)) {
      const url = await uploadProviderImage(file);
      if (url) uploads.push(url);
    }

    setImages((prev) => [...prev, ...uploads].slice(0, 6)); // 1 cover + 5 thumbs
  }

  async function handleChangeCover(file: File | null) {
    if (!file) return;
    const url = await uploadProviderImage(file);
    if (!url) return;

    setImages((prev) => {
      const rest = prev.slice(1);
      return [url, ...rest].slice(0, 6);
    });
  }

  function swapCoverWith(index: number) {
    if (index === 0) return;
    setImages((prev) => {
      const arr = [...prev];
      const tmp = arr[0];
      arr[0] = arr[index];
      arr[index] = tmp;
      return arr;
    });
  }

  // --------- qualifications handlers ----------

  function addQualification(afterIndex?: number) {
    setQualifications((prev) => {
      const next: Qualification[] = [...prev];
      const insertIndex =
        afterIndex !== undefined ? afterIndex + 1 : prev.length;
      next.splice(insertIndex, 0, { title: "", institute: "", year: "" });
      return next;
    });
  }

  function removeQualification(index: number) {
    setQualifications((prev) => {
      if (prev.length === 1) {
        // keep at least one block, just clear it
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

  // --------- save handler ----------

  async function handleSave(status: ProviderStatus) {
    if (!canSave || saving) return;
    setSaving(true);

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
      status,
      whatsappCountryCode: whatsCountry,
      whatsappNumber: whatsNumber,
      wellnessDimensions: wellness,
      categories,
      tags,
      images,
      qualifications: cleanedQualifications,
    };

    const res = await fetch("/api/providers", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      alert(json.error || "Error creating provider");
      return;
    }

    window.location.href = "/pages/services/providers";
  }

  const coverImage = images[0] ?? null;
  const gallery = images.slice(0, 5); // first 5 to show as thumbs (including cover)

  // --------- UI ----------

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050509]">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Top bar */}
          <header className="flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <h1 className="text-xl font-semibold text-[#1B1529]">
              Add new provider
            </h1>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSave("draft")}
                disabled={!canSave || saving}
                className="h-9 rounded-full border border-gray-300 bg-white px-4 text-xs font-medium text-gray-800 disabled:opacity-40"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => handleSave("active")}
                disabled={!canSave || saving}
                className={clsx(
                  "h-9 rounded-full px-6 text-xs font-semibold text-white",
                  canSave && !saving
                    ? "bg-black hover:bg-gray-900"
                    : "cursor-not-allowed bg-gray-300"
                )}
              >
                Add Provider
              </button>
            </div>
          </header>

          {/* Body */}
          <main className="flex-1 overflow-auto px-6 py-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(320px,1.1fr)]">
              {/* LEFT COLUMN */}
              <div className="space-y-6">
                {/* General Information */}
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
                        rows={5}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </section>

                {/* Qualifications */}
                <section className="rounded-3xl border border-[#ECECFB] bg-white">
                  {/* header / accordion toggle */}
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
                                className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:border-purple-500 focus:outline-none"
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
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-black text-[10px] text-white">
                          +
                        </span>
                        Add another qualification
                      </button>
                    </div>
                  )}
                </section>
              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-6">
                {/* Provider Images */}
                <section className="rounded-3xl border border-[#ECECFB] bg-white p-5">
                  <h2 className="mb-3 text-sm font-semibold text-gray-900">
                    Provider Images
                  </h2>

                  {/* main image */}
                  <div className="overflow-hidden rounded-3xl bg-gray-200">
                    {coverImage ? (
                      <img
                        src={coverImage}
                        alt="Provider main"
                        className="h-64 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-64 items-center justify-center text-xs text-gray-500">
                        Main provider portrait
                      </div>
                    )}
                  </div>

                  {/* thumbnails */}
                  <div className="mt-3 flex gap-2">
                    {gallery.map((url, idx) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => swapCoverWith(idx)}
                        className={clsx(
                          "relative h-14 w-14 overflow-hidden rounded-2xl border bg-gray-100",
                          idx === 0
                            ? "border-black"
                            : "border-gray-200 hover:border-gray-400"
                        )}
                      >
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}

                    {images.length < 6 && (
                      <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-[#F5F5F8] text-xl text-gray-500">
                        +
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleAddImages(e.target.files)
                          }
                        />
                      </label>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <p className="text-gray-500">
                      Upload a high-resolution portrait and up to 5 gallery
                      images.
                    </p>
                    <label className="cursor-pointer rounded-full bg-black px-4 py-2 text-[11px] font-semibold text-white">
                      Change Photo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (
                          e: ChangeEvent<HTMLInputElement>
                        ) => {
                          const file = e.target.files?.[0] ?? null;
                          await handleChangeCover(file);
                        }}
                      />
                    </label>
                  </div>
                </section>

                {/* Contact Details */}
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
          </main>
        </div>
      </div>
    </div>
  );
}
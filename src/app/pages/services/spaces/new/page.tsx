// app/pages/spaces/new/page.tsx
"use client";

import {
  useEffect,
  useMemo,
  useState,
  useRef,
  type ChangeEvent,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import Sidebar from "../../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../../lib/supabase/client";

type SpaceStatus = "draft" | "active" | "unavailable";
type SpaceType = "in_person" | "online" | "hybrid";

type UserStatus = "active" | "inactive" | "pending";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};
// ---------- Google Places loader ----------

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

let googlePlacesPromise: Promise<void> | null = null;

function loadGooglePlacesScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  if (window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (googlePlacesPromise) return googlePlacesPromise;

  googlePlacesPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-places="true"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", (e) => reject(e));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.googlePlaces = "true";

    script.onload = () => resolve();
    script.onerror = (e) => reject(e);

    document.head.appendChild(script);
  });

  return googlePlacesPromise;
}

// ---------- Storage helper ----------
async function uploadSpaceImage(file: File, spaceId?: string) {
  const bucket = "space-images";

  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const folder = spaceId ?? "new"; // you can replace with real ID after creation
  const filePath = `spaces/${folder}/${fileName}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Upload error", error);
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return publicUrl;
}

export default function NewSpacePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);

  // main form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [spaceType, setSpaceType] = useState<SpaceType>("in_person");

  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [gmbId, setGmbId] = useState("");

  const [whatsCountry, setWhatsCountry] = useState("+65");
  const [whatsNumber, setWhatsNumber] = useState("");

  const [wellness, setWellness] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState("");

  const [status] = useState<SpaceStatus>("draft");

  // images – index 0 is cover
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [saving, setSaving] = useState(false);

  // Google Places: address input ref
  const addressInputRef = useRef<HTMLInputElement | null>(null);

  // load profile for sidebar + vendor id
  useEffect(() => {
    async function loadProfile() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (data) setProfile(data as Profile);
    }
    void loadProfile();
  }, []);

  // Attach Google Places Autocomplete to Address field
  useEffect(() => {
    let autocomplete: any = null;
    let cancelled = false;

    async function initAutocomplete() {
      try {
        await loadGooglePlacesScript();
        if (cancelled) return;
        if (!addressInputRef.current || !window.google?.maps?.places) return;

        autocomplete = new window.google.maps.places.Autocomplete(
          addressInputRef.current,
          {
            fields: [
              "formatted_address",
              "address_components",
              "geometry",
              "place_id",
              "url",
              "name",
            ],
            types: ["establishment", "geocode"],
          }
        );

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place) return;

          const formattedAddress =
            place.formatted_address || addressInputRef.current?.value || "";

          // Postal code
          let postal = "";
          if (place.address_components) {
            const pcComponent = place.address_components.find((c: any) =>
              c.types.includes("postal_code")
            );
            if (pcComponent) {
              postal = pcComponent.long_name || pcComponent.short_name || "";
            }
          }

          const placeId = place.place_id || "";
          let url = place.url as string | undefined;

          if (!url && placeId) {
            // Fallback if url field isn't populated
            url = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
          }

          setAddress(formattedAddress);
          setPostalCode(postal);
          setGmbId(placeId);
          setMapLink(url || mapLink);
        });
      } catch (err) {
        console.error("Failed to init Google Places", err);
      }
    }

    initAutocomplete();

    return () => {
      cancelled = true;
      if (autocomplete && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      }
    };
    // we intentionally don't add dependencies to avoid re-creating it
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const canSave =
    name.trim().length > 0 &&
    address.trim().length > 0 &&
    whatsNumber.trim().length > 0;

  async function handleSave(nextStatus: SpaceStatus) {
    if (!canSave || saving || uploadingImages) return;
    setSaving(true);

    const body = {
      name,
      description,
      status: nextStatus,
      spaceType,
      address,
      postalCode,
      mapLink,
      googleBusinessPlaceId: gmbId,
      whatsappCountryCode: whatsCountry,
      whatsappNumber: whatsNumber,
      wellnessDimensions: wellness,
      categories,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      images, // array of public URLs
    };

    const res = await fetch("/api/spaces", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      alert(json.error || "Error creating space");
      return;
    }
    router.push("/pages/services/spaces");
  }

  // ---------- IMAGE HANDLER (upload to Supabase) ----------
  async function handleAddImages(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length) return;

    try {
      setUploadingImages(true);

      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadSpaceImage(file);
        uploaded.push(url);
      }

      setImages((prev) => {
        const merged = [...prev, ...uploaded];
        return merged.slice(0, 6); // 1 main + up to 5 thumbs
      });
    } catch (err) {
      console.error(err);
      alert("Failed to upload image(s). Please try again.");
    } finally {
      setUploadingImages(false);
      // allow re-uploading same file name
      e.target.value = "";
    }
  }

  return (
    <div className="flex h-screen w-screen bg-[#050509] overflow-hidden">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* top bar */}
          <div className="flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <h1 className="text-xl font-semibold text-[#1B1529]">
              Add new space
            </h1>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSave("draft")}
                disabled={!canSave || saving || uploadingImages}
                className="h-9 rounded-full border border-gray-300 bg-white px-4 text-xs font-medium disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={() => handleSave("active")}
                disabled={!canSave || saving || uploadingImages}
                className={clsx(
                  "h-9 rounded-full px-6 text-xs font-semibold text-white",
                  canSave && !saving && !uploadingImages
                    ? "bg-black hover:bg-gray-900"
                    : "cursor-not-allowed bg-gray-300"
                )}
              >
                {saving ? "Saving…" : "Add Space"}
              </button>
            </div>
          </div>

          {/* body */}
          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2.2fr)_minmax(320px,1.1fr)]">
              {/* LEFT column */}
              <div className="space-y-6">
                {/* General information */}
                <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                  <h2 className="mb-4 text-sm font-semibold text-gray-900">
                    General Information
                  </h2>
                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Wellness Space Name
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Wellness Space Description
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

                {/* Space Type & Location */}
                <section className="rounded-3xl border border-[#ECECFB] bg.white p-6">
                  <h2 className="mb-4 text-sm font-semibold text-gray-900">
                    Space Type &amp; Location
                  </h2>
                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Space Type
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[
                          { value: "in_person", label: "In Person" },
                          { value: "online", label: "Online" },
                          { value: "hybrid", label: "Hybrid" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setSpaceType(opt.value as SpaceType)
                            }
                            className={clsx(
                              "rounded-full border px-3 py-1 text-[11px]",
                              spaceType === opt.value
                                ? "border-black bg-black text-white"
                                : "border-gray-300 bg-[#FBFBFE] text-gray-700"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1fr)]">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-800">
                          Address
                        </label>
                        <input
                          ref={addressInputRef}
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                          placeholder="Start typing and choose from suggestions"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-800">
                          Postal Code
                        </label>
                        <input
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Google Maps Link
                      </label>
                      <input
                        value={mapLink}
                        onChange={(e) => setMapLink(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Google Business Page ID
                      </label>
                      <input
                        value={gmbId}
                        onChange={(e) => setGmbId(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                        placeholder="Filled automatically from Google, or paste manually"
                      />
                    </div>
                  </div>
                </section>
              </div>

              {/* RIGHT column */}
              <div className="space-y-6">
                {/* Space images */}
                <section className="rounded-3xl border border-[#ECECFB] bg-white p-5">
                  <h2 className="mb-3 text-sm font-semibold text-gray-900">
                    Wellness Space Images
                  </h2>

                  <div className="overflow-hidden rounded-3xl bg-gray-200">
                    {images[0] ? (
                      <img
                        src={images[0]}
                        alt="Space main"
                        className="h-56 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-56 items-center justify-center text-xs text-gray-500">
                        Main space image
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    {images.slice(0, 5).map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          // swap with main
                          setImages((prev) => {
                            const arr = [...prev];
                            const main = arr[0];
                            arr[0] = arr[idx];
                            arr[idx] = main;
                            return arr;
                          });
                        }}
                        className="relative h-14 w-14 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
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
                        {uploadingImages ? "…" : "+"}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleAddImages}
                        />
                      </label>
                    )}
                  </div>

                  <p className="mt-2 text-[10px] text-gray-500">
                    First image is used as cover. Upload a high-resolution
                    cover image and up to 5 gallery images.
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

                {/* Wellness / categories / tags */}
                <section className="rounded-3xl border border-[#ECECFB] bg-white p-5">
                  <h2 className="mb-3 text-sm font-semibold text-gray-900">
                    Wellness Dimension, Category &amp; Tags
                  </h2>
                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="font-semibold text-gray-800">
                        Wellness Dimension
                      </label>
                      <input
                        placeholder="Choose 1 or more dimensions"
                        value={wellness.join(", ")}
                        onChange={(e) =>
                          setWellness(
                            e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean)
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-gray-800">
                        Categories
                      </label>
                      <input
                        placeholder="Choose 1 or more categories"
                        value={categories.join(", ")}
                        onChange={(e) =>
                          setCategories(
                            e.target.value
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean)
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-gray-800">
                        Tags
                      </label>
                      <input
                        placeholder="Use ',' to add more tags"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
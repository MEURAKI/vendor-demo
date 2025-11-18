"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Sidebar from "../../../../components/sidebar/Sidebar";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { supabase } from "../../../../lib/supabase/client";
import { uploadProviderImage } from "../../../../lib/uploadProviderImage";
import MultiSelect from "../../../../components/inputs/MultiSelect";

type DiscountType = "fixed" | "percent" | null;
type LocationType = "online" | "in_person";
type ServiceStatus = "draft" | "active" | "unavailable";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: "active" | "inactive" | "pending";
  onboarding_completed: boolean;
};

type DescriptionTab = {
  id: string;
  title: string;
  body: string;
};

type TimeSlot = {
  id: string;
  start: string;
  end: string;
};

type SessionOption = {
  id: string;
  label: string;
  sessionsCount: number;
  price: number;
};

type WellnessDimension = {
  id: string;
  name: string;
  slug: string;
};

type LocationSettingsState = {
  id: string;
  locationType: LocationType;
  sku: string;
  maxParticipants?: number;
  price?: number;
  discountType: DiscountType;
  discountValue?: number;
  discountCap?: number;
  hasFixedSchedule: boolean;
  expiryType: "anytime" | "duration";
  expiryDurationUnit?: "days" | "weeks" | "months";
  expiryDurationValue?: number;
  timeSlots: TimeSlot[];
  sessionOptions: SessionOption[];
};

function uuid() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function ChipsInput({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");

  function commitValue() {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!items.includes(trimmed)) {
      onChange([...items, trimmed]);
    }
    setValue("");
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white px-2 py-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded-full bg-[#EFEDFF] px-3 py-1 text-xs font-medium text-gray-800"
        >
          {item}
          <button
            type="button"
            className="ml-1 text-[10px] text-gray-500 hover:text-gray-800"
            onClick={() => onChange(items.filter((x) => x !== item))}
          >
            ✕
          </button>
        </span>
      ))}

      <input
        className="min-w-[120px] flex-1 border-none bg-transparent px-2 py-1 text-xs focus:outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitValue();
          } else if (e.key === "Backspace" && !value && items.length > 0) {
            onChange(items.slice(0, -1));
          }
        }}
        onBlur={commitValue}
      />
    </div>
  );
}

export default function NewServicePage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  // general
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // taxonomy
  const [serviceTypes, setServiceTypes] = useState<string[]>([]); // 1-1, group, etc.
  const [locationTypes, setLocationTypes] = useState<LocationType[]>(["in_person"]);
  const [wellness, setWellness] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // description tabs
  const [tabs, setTabs] = useState<DescriptionTab[]>([
    { id: uuid(), title: "Section 1", body: "" },
  ]);

  // images
  const [images, setImages] = useState<string[]>([]);
  const coverImageUrl = images[0] ?? null;

  // providers / spaces (IDs)
  const [providerIds, setProviderIds] = useState<string[]>([]);
  const [spaceIds, setSpaceIds] = useState<string[]>([]);

  // fake option lists – replace with real fetch from /api/providers & /api/spaces
  const [allProviders, setAllProviders] = useState<{ id: string; name: string }[]>([]);
  const [allSpaces, setAllSpaces] = useState<{ id: string; name: string }[]>([]);

  // taxonomy

  // wellness like product (IDs from DB)
  const [wellnessOptions, setWellnessOptions] = useState<WellnessDimension[]>([]);
  const [selectedWellnessIds, setSelectedWellnessIds] = useState<string[]>([]);


  // per-location settings
  const [locationSettings, setLocationSettings] = useState<LocationSettingsState[]>([
    {
      id: uuid(),
      locationType: "in_person",
      sku: "",
      maxParticipants: 1000,
      price: 0,
      discountType: null,
      discountValue: undefined,
      discountCap: undefined,
      hasFixedSchedule: false,
      expiryType: "anytime",
      expiryDurationUnit: undefined,
      expiryDurationValue: undefined,
      timeSlots: [],
      sessionOptions: [],
    },
  ]);
  const [activeLocationTab, setActiveLocationTab] = useState<LocationType>("in_person");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
  let mounted = true;

  async function loadWellnessDimensions() {
    const { data, error } = await supabase
      .from("wellness_dimensions")
      .select("id,name,slug")
      .order("id", { ascending: true });

    if (error) {
      console.error("Error loading wellness dimensions", error);
      return;
    }

    if (mounted && data) {
      setWellnessOptions(data as WellnessDimension[]);
    }
  }

  void loadWellnessDimensions();
  return () => {
    mounted = false;
  };
}, []);

  // load profile (for sidebar)
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

  // TODO: replace with real fetches from your providers/spaces APIs
useEffect(() => {
  let mounted = true;

  async function loadProvidersAndSpaces() {
    // Get logged-in vendor
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth.user) {
      console.error("No auth user", authErr);
      if (mounted) {
        setAllProviders([]);
        setAllSpaces([]);
      }
      return;
    }

    const vendorId = auth.user.id;

    const [providersRes, spacesRes] = await Promise.all([
      supabase
        .from("providers")
        .select("id,name")
        .eq("vendor_id", vendorId)
        .neq("status", "unavailable") // optional filter
        .order("name", { ascending: true }),

      supabase
        .from("spaces")
        .select("id,name")
        .eq("vendor_id", vendorId)
        .neq("status", "unavailable") // optional filter
        .order("name", { ascending: true }),
    ]);

    if (!mounted) return;

    if (providersRes.error) {
      console.error("Error loading providers", providersRes.error);
    } else if (providersRes.data) {
      setAllProviders(
        providersRes.data.map((p) => ({
          id: p.id,
          name: p.name,
        }))
      );
    }

    if (spacesRes.error) {
      console.error("Error loading spaces", spacesRes.error);
    } else if (spacesRes.data) {
      setAllSpaces(
        spacesRes.data.map((s) => ({
          id: s.id,
          name: s.name,
        }))
      );
    }
  }

  void loadProvidersAndSpaces();

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

  const canSave = name.trim().length > 0;

  // helper – toggle arrays
  function toggleValue<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  // Whenever locationTypes changes, ensure locationSettings match
  useEffect(() => {
    setLocationSettings((prev) => {
      const mapped: LocationSettingsState[] = [];

      locationTypes.forEach((locType) => {
        const existing = prev.find((p) => p.locationType === locType);
        if (existing) {
          mapped.push(existing);
        } else {
          mapped.push({
            id: uuid(),
            locationType: locType,
            sku: "",
            maxParticipants: 1000,
            price: 0,
            discountType: null,
            discountValue: undefined,
            discountCap: undefined,
            hasFixedSchedule: false,
            expiryType: "anytime",
            expiryDurationUnit: undefined,
            expiryDurationValue: undefined,
            timeSlots: [],
            sessionOptions: [],
          });
        }
      });

      // default active tab
      if (!locationTypes.includes(activeLocationTab)) {
        setActiveLocationTab(locationTypes[0] ?? "in_person");
      }

      return mapped;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationTypes.length]);

  async function handleImageUpload(files: FileList | null) {
    if (!files || !files.length) return;
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const url = await uploadProviderImage(file);
      if (url) newUrls.push(url);
    }
    setImages((prev) => [...prev, ...newUrls].slice(0, 6));
  }

  function updateLocation(locType: LocationType, patch: Partial<LocationSettingsState>) {
    setLocationSettings((prev) =>
      prev.map((loc) =>
        loc.locationType === locType ? { ...loc, ...patch } : loc
      )
    );
  }

  async function handleSave(status: ServiceStatus) {
    if (!canSave || saving) return;
    setSaving(true);

    const payload = {
  sku: sku || null,
  name,
  description,
  status,
  serviceTypes,
  locationTypes,
  wellnessDimensions: selectedWellnessIds,
  categories,          // array of strings
  tags,                // array of strings
  coverImageUrl,
  images,
  descriptionTabs: tabs.map((t, idx) => ({
    title: t.title,
    body: t.body,
    position: idx,
  })),
  providerIds,
  spaceIds,
  locationSettings: locationSettings.map((loc) => ({
    locationType: loc.locationType,
    sku: loc.sku,
    maxParticipants: loc.maxParticipants,
    price: loc.price,
    discountType: loc.discountType,
    discountValue: loc.discountValue,
    discountCap: loc.discountCap,
    hasFixedSchedule: loc.hasFixedSchedule,
    expiryType: loc.expiryType,
    expiryDurationUnit: loc.expiryDurationUnit,
    expiryDurationValue: loc.expiryDurationValue,
    timeSlots: loc.timeSlots.map((s) => ({
      start: s.start,
      end: s.end,
    })),
    sessionOptions: loc.sessionOptions.map((p) => ({
      label: p.label,
      sessionsCount: p.sessionsCount,
      price: p.price,
    })),
  })),
};

    try {
      const res = await fetch("/api/services", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error(json);
        alert(json.error || "Error saving service");
        return;
      }
      window.location.href = "/pages/services";
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
  if (!name) return;

  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const randomPart = Math.floor(100000 + Math.random() * 900000); // 6-digit

  setSku(`SRV-${slug}`);
}, [name])

  // --- render helpers ---
  const activeLoc = locationSettings.find(
    (l) => l.locationType === activeLocationTab
  );

  return (
    <div className="flex h-screen w-screen bg-[#050509] overflow-hidden">
      <Sidebar config={sidebarConfig} />

      <div className="flex flex-1 items-stretch justify-center px-6 py-4">
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[32px] border-[3px] border-black bg-[#F6F6FC] shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <h1 className="text-xl font-semibold text-[#1B1529]">
              Add new service
            </h1>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleSave("draft")}
                disabled={!canSave || saving}
                className="h-9 rounded-full border border-gray-300 bg-white px-4 text-xs font-medium disabled:opacity-40"
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
                Add Service
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2.4fr)_minmax(320px,1fr)]">
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
                        SKU
                      </label>
                      <input
                      readOnly
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Service Name
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Service Description
                      </label>
                      <textarea
                        rows={5}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </section>

                {/* Description Tabs */}
                <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-900">
                      Description Tabs
                    </h2>
                    <button
                      type="button"
                      onClick={() =>
                        setTabs((prev) => [
                          ...prev,
                          {
                            id: uuid(),
                            title: `Section ${prev.length + 1}`,
                            body: "",
                          },
                        ])
                      }
                      disabled={tabs.length >= 5}
                      className="rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                    >
                      + Add Section
                    </button>
                  </div>

                  <div className="space-y-4 text-xs">
                    {tabs.map((tab, idx) => (
                      <div
                        key={tab.id}
                        className="rounded-2xl border border-gray-200 bg-[#FBFBFE] p-4"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-purple-700">
                            {`Section ${idx + 1}`}
                          </span>
                          {tabs.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setTabs((prev) =>
                                  prev.filter((t) => t.id !== tab.id)
                                )
                              }
                              className="text-xs text-gray-400 hover:text-black"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label className="text-[11px] font-semibold text-gray-800">
                              Section Title (Displayed on app)
                            </label>
                            <input
                              value={tab.title}
                              onChange={(e) =>
                                setTabs((prev) =>
                                  prev.map((t) =>
                                    t.id === tab.id
                                      ? { ...t, title: e.target.value }
                                      : t
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-gray-800">
                              Section Description
                            </label>
                            <textarea
                              rows={3}
                              value={tab.body}
                              onChange={(e) =>
                                setTabs((prev) =>
                                  prev.map((t) =>
                                    t.id === tab.id
                                      ? { ...t, body: e.target.value }
                                      : t
                                  )
                                )
                              }
                              className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Service Type, Providers, Spaces, Location types */}
                <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                  <h2 className="mb-4 text-sm font-semibold text-gray-900">
                    Service Type, Location Type, Providers &amp; Spaces
                  </h2>

                  <div className="space-y-4 text-xs">
                    {/* Providers */}
                    <div className="space-y-4 text-xs">

                        <MultiSelect
                          label="Choose Providers"
                          options={allProviders}
                          selected={providerIds}
                          onChange={setProviderIds}
                        />

                        <MultiSelect
                          label="Choose Wellness Spaces"
                          options={allSpaces}
                          selected={spaceIds}
                          onChange={setSpaceIds}
                        />

                      </div>

                    {/* Service Types chips (1-1, group class, etc.) */}
                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Service Type (choose 1)
                      </label>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {["1-1", "Group Class", "Private (At Home)", "Private (Wellness Space)"].map(
                          (label) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setServiceTypes([label])} // ONLY ONE SELECTED
                              className={clsx(
                                "rounded-full border px-3 py-1 text-[11px]",
                                serviceTypes.includes(label)
                                  ? "border-black bg-black text-white"
                                  : "border-gray-300 bg-[#FBFBFE] text-gray-700"
                              )}
                            >
                              {label}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Location Types chips with tabs */}
                    <div>
                      <label className="text-[11px] font-semibold text-gray-800">
                        Location Type
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(["online", "in_person"] as LocationType[]).map(
                          (loc) => (
                            <button
                              key={loc}
                              type="button"
                              onClick={() =>
                                setLocationTypes((prev) =>
                                  prev.includes(loc)
                                    ? (prev.length === 1 ? prev : prev.filter((x) => x !== loc))
                                    : [...prev, loc]
                                )
                              }
                              className={clsx(
                                "rounded-full border px-3 py-1 text-[11px]",
                                locationTypes.includes(loc)
                                  ? "border-black bg-black text-white"
                                  : "border-gray-300 bg-[#FBFBFE] text-gray-700"
                              )}
                            >
                              {loc === "online" ? "Online" : "In-person"}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* SERVICE SETTINGS — MULTIPLE LOCATION CARDS */}
{locationTypes.length > 0 && (
  <section className="space-y-6">
    {locationSettings.map((loc) => (
      <div
        key={loc.locationType}
        className="rounded-3xl border border-[#ECECFB] bg-white p-6"
      >
        {/* Title */}
        <h3 className="mb-4 text-sm font-semibold text-gray-900">
          {loc.locationType === "online"
            ? "Online Service Settings"
            : "In-Person Service Settings"}
        </h3>

        {/* SETTINGS GRID */}
        <div className="grid gap-3 text-xs md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          {/* SKU */}
          <div>
            <label className="text-[11px] font-semibold text-gray-800">
              SKU
            </label>
            <input
              value={loc.sku}
              onChange={(e) =>
                updateLocation(loc.locationType, { sku: e.target.value })
              }
              className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Max Participants */}
          <div>
            <label className="text-[11px] font-semibold text-gray-800">
              Max Participants
            </label>
            <div className="mt-2 flex items-center gap-1">
              <span className="inline-flex h-9 items-center rounded-2xl border border-gray-200 bg-white px-3 text-[11px] text-gray-500">
                QTY
              </span>
              <input
                type="number"
                min={1}
                value={loc.maxParticipants ?? ""}
                onChange={(e) =>
                  updateLocation(loc.locationType, {
                    maxParticipants:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className="h-9 flex-1 rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 text-xs focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="text-[11px] font-semibold text-gray-800">
              Price
            </label>
            <div className="mt-2 flex items-center gap-1">
              <span className="inline-flex h-9 items-center rounded-2xl border border-gray-200 bg-white px-3 text-[11px] text-gray-500">
                SGD
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={loc.price ?? ""}
                onChange={(e) =>
                  updateLocation(loc.locationType, {
                    price:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className="h-9 flex-1 rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 text-xs focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Discount */}
          <div>
            <label className="text-[11px] font-semibold text-gray-800">
              Discount
            </label>
            <div className="mt-2 flex items-center gap-1">
              <div className="flex rounded-2xl border border-gray-200 bg-white text-[11px]">
                <button
                  type="button"
                  onClick={() =>
                    updateLocation(loc.locationType, {
                      discountType: loc.discountType === "fixed" ? null : "fixed",
                    })
                  }
                  className={clsx(
                    "px-3 py-1.5 rounded-l-2xl",
                    loc.discountType === "fixed"
                      ? "bg-[#F5EBFF] text-purple-700"
                      : "text-gray-600"
                  )}
                >
                  SGD
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateLocation(loc.locationType, {
                      discountType:
                        loc.discountType === "percent" ? null : "percent",
                    })
                  }
                  className={clsx(
                    "px-3 py-1.5 rounded-r-2xl",
                    loc.discountType === "percent"
                      ? "bg-[#F5EBFF] text-purple-700"
                      : "text-gray-600"
                  )}
                >
                  %
                </button>
              </div>
              <input
                type="number"
                min={0}
                step="0.01"
                value={loc.discountValue ?? ""}
                onChange={(e) =>
                  updateLocation(loc.locationType, {
                    discountValue:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                className="h-9 flex-1 rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 text-xs focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* AVAILABILITY CARD */}
        <div className="mt-6 rounded-2xl bg-[#FBFBFE] p-4 text-xs">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">
                Service Availability
              </h4>
              <p className="text-[11px] text-gray-500">
                Does this service have fixed date & time slots?
              </p>
            </div>

            <label className="flex items-center gap-2 text-[11px] text-gray-700">
              <input
                type="checkbox"
                checked={loc.hasFixedSchedule}
                onChange={(e) =>
                  updateLocation(loc.locationType, {
                    hasFixedSchedule: e.target.checked,
                  })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <span>Yes, I have selected dates</span>
            </label>
          </div>

          {/* FIXED SCHEDULE MODE */}
          {loc.hasFixedSchedule ? (
            <>
              <div className="mt-3 space-y-3">
                <h5 className="text-[11px] font-semibold text-gray-800">
                  Date & Time Slots
                </h5>

                {loc.timeSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    {/* Start */}
                    <div>
                      <label className="text-[10px] text-gray-600">
                        Start Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={slot.start}
                        onChange={(e) =>
                          updateLocation(loc.locationType, {
                            timeSlots: loc.timeSlots.map((s) =>
                              s.id === slot.id
                                ? { ...s, start: e.target.value }
                                : s
                            ),
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs"
                      />
                    </div>

                    {/* End */}
                    <div>
                      <label className="text-[10px] text-gray-600">
                        End Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={slot.end}
                        onChange={(e) =>
                          updateLocation(loc.locationType, {
                            timeSlots: loc.timeSlots.map((s) =>
                              s.id === slot.id ? { ...s, end: e.target.value } : s
                            ),
                          })
                        }
                        className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs"
                      />
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() =>
                        updateLocation(loc.locationType, {
                          timeSlots: loc.timeSlots.filter(
                            (s) => s.id !== slot.id
                          ),
                        })
                      }
                      className="mt-6 h-9 rounded-full border border-gray-300 px-3 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    updateLocation(loc.locationType, {
                      timeSlots: [
                        ...loc.timeSlots,
                        { id: uuid(), start: "", end: "" },
                      ],
                    })
                  }
                  className="mt-2 inline-flex items-center rounded-full bg-black px-4 py-2 text-[11px] font-semibold text-white"
                >
                  + Add Time Slot
                </button>
              </div>
            </>
          ) : (
            /* ANYTIME MODE */
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {/* Expiry Type */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-800">
                    Expiry Type
                  </label>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateLocation(loc.locationType, { expiryType: "anytime" })
                      }
                      className={clsx(
                        "flex-1 rounded-2xl border px-3 py-2 text-[11px]",
                        loc.expiryType === "anytime"
                          ? "border-black bg-black text-white"
                          : "border-gray-300 bg-white text-gray-700"
                      )}
                    >
                      Use Anytime
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateLocation(loc.locationType, { expiryType: "duration" })
                      }
                      className={clsx(
                        "flex-1 rounded-2xl border px-3 py-2 text-[11px]",
                        loc.expiryType === "duration"
                          ? "border-black bg-black text-white"
                          : "border-gray-300 bg-white text-gray-700"
                      )}
                    >
                      Duration
                    </button>
                  </div>
                </div>

                {/* Duration */}
                {loc.expiryType === "duration" && (
                  <div>
                    <label className="text-[11px] font-semibold text-gray-800">
                      Expiry Duration
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={loc.expiryDurationValue ?? ""}
                        onChange={(e) =>
                          updateLocation(loc.locationType, {
                            expiryDurationValue:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                        className="h-9 w-20 rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                      />
                      <select
                        value={loc.expiryDurationUnit ?? "days"}
                        onChange={(e) =>
                          updateLocation(loc.locationType, {
                            expiryDurationUnit: e.target.value as any,
                          })
                        }
                        className="h-9 flex-1 rounded-2xl border border-gray-200 bg-white px-3 text-xs"
                      >
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* SESSION OPTIONS */}
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <h5 className="text-sm font-semibold text-gray-900">
                    Service Options
                  </h5>
                  <span className="rounded-full bg-[#F3E8FF] px-3 py-1 text-[10px] font-semibold text-purple-700">
                    Only available for anytime expiry
                  </span>
                </div>

                <div className="space-y-3">
                  {loc.sessionOptions.map((opt, i) => (
                    <div
                      key={opt.id}
                      className="grid items-end gap-3 md:grid-cols-[1.2fr_1fr_auto]"
                    >
                      {/* Label */}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-800">
                          {`Option ${i + 1}`}
                        </label>
                        <input
                          value={opt.label}
                          onChange={(e) =>
                            updateLocation(loc.locationType, {
                              sessionOptions: loc.sessionOptions.map((s) =>
                                s.id === opt.id
                                  ? { ...s, label: e.target.value }
                                  : s
                              ),
                            })
                          }
                          className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs"
                        />
                      </div>

                      {/* Price */}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-800">
                          Price
                        </label>
                        <div className="mt-2 flex items-center gap-1">
                          <span className="inline-flex h-9 items-center rounded-2xl border border-gray-200 bg-white px-3 text-[11px] text-gray-500">
                            SGD
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={opt.price}
                            onChange={(e) =>
                              updateLocation(loc.locationType, {
                                sessionOptions: loc.sessionOptions.map((s) =>
                                  s.id === opt.id
                                    ? { ...s, price: Number(e.target.value) }
                                    : s
                                ),
                              })
                            }
                            className="h-9 flex-1 rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 text-xs"
                          />
                        </div>
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() =>
                          updateLocation(loc.locationType, {
                            sessionOptions: loc.sessionOptions.filter(
                              (s) => s.id !== opt.id
                            ),
                          })
                        }
                        className="h-9 rounded-full border border-gray-300 px-3 text-xs text-gray-500"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Session */}
                <button
                  type="button"
                  onClick={() =>
                    updateLocation(loc.locationType, {
                      sessionOptions: [
                        ...loc.sessionOptions,
                        {
                          id: uuid(),
                          label: `Option ${loc.sessionOptions.length + 1}`,
                          sessionsCount: loc.sessionOptions.length + 1,
                          price: 0,
                        },
                      ],
                    })
                  }
                  className="mt-3 inline-flex items-center rounded-full bg-black px-4 py-2 text-[11px] font-semibold text-white"
                >
                  + Add Option
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    ))}
  </section>
)}
              </div>

              {/* RIGHT COLUMN – images + taxonomy */}
              <div className="space-y-6">
                {/* Service Images */}
                <section className="rounded-3xl border border-[#ECECFB] bg-white p-5">
                  <h2 className="mb-3 text-sm font-semibold text-gray-900">
                    Service Images
                  </h2>

                  <div className="overflow-hidden rounded-3xl bg-gray-200">
                    {coverImageUrl ? (
                      <img
                        src={coverImageUrl}
                        alt="Service cover"
                        className="h-56 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-56 items-center justify-center text-xs text-gray-500">
                        Upload a main service image
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2">
                    {images.slice(0, 5).map((url, idx) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => {
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
                        +
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleImageUpload(e.target.files)}
                        />
                      </label>
                    )}
                  </div>

                  <p className="mt-2 text-[10px] text-gray-500">
                    Upload a high-resolution cover image and up to 5 gallery
                    images.
                  </p>
                </section>

                {/* Wellness / Categories / Tags */}
                <section className="rounded-3xl border border-[#ECECFB] bg-white p-5">
                <h2 className="mb-3 text-sm font-semibold text-gray-900">
                  Wellness Dimension, Category &amp; Tags
                </h2>
                <div className="space-y-4 text-xs">
                  {/* Wellness dimensions – chips from DB, like products */}
                  <div>
                    <label className="font-semibold text-gray-800">
                      Wellness Dimensions
                    </label>
                    <p className="mt-1 text-[11px] text-gray-500">
                      Choose one or more wellness dimensions for this service.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {wellnessOptions.map((w) => {
                        const active = selectedWellnessIds.includes(w.id);
                        const iconSrc = `/images/wellness/${w.slug}`;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              setSelectedWellnessIds((prev) =>
                                prev.includes(w.id)
                                  ? prev.filter((id) => id !== w.id)
                                  : [...prev, w.id]
                              );
                            }}
                            className={clsx(
                              "flex items-center gap-2 rounded-2xl border px-2 py-2 text-left text-[11px] transition",
                              active
                                ? "border-[#5B33FF] bg-[#EFEDFF] text-[#1B1529]"
                                : "border-gray-200 bg-[#FBFBFE] text-gray-700 hover:border-[#C4B5FF]"
                            )}
                          >
                            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#F5F3FF]">
                              <img
                                src={iconSrc}
                                alt={w.name}
                                className="h-full w-full object-contain"
                              />
                            </div>
                            <span className="line-clamp-2">{w.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Categories as chips */}
                  <div>
                    <label className="font-semibold text-gray-800">
                      Menu Categories
                    </label>
                    <p className="mt-1 text-[11px] text-gray-500">
                      Type a category and press Enter to add.
                    </p>
                    <ChipsInput
                      items={categories}
                      onChange={setCategories}
                      placeholder="e.g. Bodywork, Breathwork"
                    />
                  </div>

                  {/* Tags as chips */}
                  <div>
                    <label className="font-semibold text-gray-800">
                      Tags
                    </label>
                    <p className="mt-1 text.[11px] text-gray-500">
                      Use tags to help customers find this service. Press Enter to add each tag.
                    </p>
                    <ChipsInput
                      items={tags}
                      onChange={setTags}
                      placeholder="e.g. Beginners, Evening, Women-led"
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
// app/pages/services/[serviceId]/edit/page.tsx
"use client";

import { useVendorProfile } from "../../../../../context/VendorShellContext";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

import { supabase } from "../../../../../lib/supabase/client";
import { uploadProviderImage } from "../../../../../lib/uploadProviderImage";
import MultiSelect from "../../../../../components/inputs/MultiSelect";

import WellnessCategoryTagsSection, {
  WellnessOption,
} from "../../../../../components/taxonomy/WellnessCategoryTagsSection";
import ClipLoader from "react-spinners/ClipLoader";
import AppModal from "../../../../../components/common/AppModal";
import { useAuthGuard } from "../../../../../hooks/useAuthGuard";

type DiscountType = "fixed" | "percent" | null;
type LocationType = "online" | "in_person";
type ServiceStatus = "draft" | "active" | "unavailable";

type UserStatus = "active" | "inactive" | "pending";

type Profile = {
  id: string;
  email: string | null;
  status: UserStatus;
  onboarding_completed: boolean;
  full_name: string | null;
};

type DescriptionTab = {
  id: string;
  title: string;
  body: string;
  position?: number;
};

type TimeSlot = {
  id: string;
  start: string;
  end: string;
  price?: number;
  discountType: DiscountType;
  discountValue?: number;
  discountCap?: number;
};

type SessionOption = {
  id: string;
  label: string;
  sessionsCount: number;
  price: number;
};

type RecurringRule = {
  id: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate?: string;
  providerId?: string;
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
  recurringRules: RecurringRule[];
};

type WellnessDimension = {
  id: string | number;
  name: string;
  slug: string;
};

type LoadedService = {
  id: string;
  sku: string | null;
  name: string;
  description: string;
  status: ServiceStatus;
  serviceTypes: string[];
  locationTypes: LocationType[];
  wellnessDimensions: (string | number)[];
  categories: string[];
  tags: string[];
  coverImageUrl: string | null;
  images: string[];
  descriptionTabs: { title: string; body: string; position: number }[];
  providerIds: string[];
  spaceIds: string[];
  locationSettings: Array<{
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
    timeSlots: {
      start: string;
      end: string;
      price?: number;
      discountType?: DiscountType;
      discountValue?: number;
      discountCap?: number;
    }[];
    sessionOptions: { label: string; sessionsCount: number; price: number }[];
    recurringRules?: {
      daysOfWeek: number[];
      startTime: string;
      endTime: string;
      startDate: string;
      endDate?: string;
      providerId?: string;
    }[];
  }>;
};

function toLocalDateTimeString(isoString: string): string {
  if (!isoString) return "";
  // Remove timezone info for datetime-local input
  return isoString.slice(0, 16); // Gets "2026-01-24T16:10"
}

function toISOString(localDateTime: string): string {
  if (!localDateTime) return "";
  // Add seconds and timezone
  return localDateTime + ":00+00:00";
}

function uuid() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function validateDescriptionTabs(tabs: DescriptionTab[]) {
  return tabs.every((t) => t.title.trim().length > 0);
}

export default function EditServicePage() {
  const params = useParams<{ serviceId: string }>();
  const router = useRouter();
  const serviceId = params.serviceId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // general
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ServiceStatus>("draft");

  // taxonomy
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [locationTypes, setLocationTypes] = useState<LocationType[]>([
    "in_person",
  ]);

  // description tabs
  const [tabs, setTabs] = useState<DescriptionTab[]>([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showDescriptionErrorModal, setShowDescriptionErrorModal] =
    useState(false);
  const descriptionSectionRef = useRef<HTMLDivElement | null>(null);
  const descriptionHasError =
    submitAttempted && !validateDescriptionTabs(tabs);

  // images (URLs only)
  const [images, setImages] = useState<string[]>([]);
  const coverImageUrl = images[0] ?? null;

  // providers / spaces
  const [providerIds, setProviderIds] = useState<string[]>([]);
  const [spaceIds, setSpaceIds] = useState<string[]>([]);
  const [allProviders, setAllProviders] = useState<
    { id: string; name: string }[]
  >([]);
  const [allSpaces, setAllSpaces] = useState<{ id: string; name: string }[]>(
    []
  );

  // per-location settings
  const [locationSettings, setLocationSettings] = useState<
    LocationSettingsState[]
  >([]);
  const [activeLocationTab, setActiveLocationTab] =
    useState<LocationType>("in_person");

  // wellness / categories / tags (array-based, same as create page)
  const [wellnessOptions, setWellnessOptions] = useState<WellnessOption[]>([]);
  const [selectedWellnessIds, setSelectedWellnessIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // category error UI
  const [showCategoryErrorModal, setShowCategoryErrorModal] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const categorySectionRef = useRef<HTMLDivElement | null>(null);

  // sidebar profile
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("id,email,full_name,status")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (data) setProfile(data as Profile);
    })();
  }, []);
  // wellness dimension options
  useEffect(() => {
    let mounted = true;
    async function loadWellness() {
      const { data, error } = await supabase
        .from("wellness_dimensions")
        .select("id,name,slug")
        .order("id", { ascending: true });

      if (!mounted) return;
      if (error) {
        console.error("Error loading wellness dimensions", error);
        return;
      }
      if (data) setWellnessOptions(data as WellnessOption[]);
    }
    void loadWellness();
    return () => {
      mounted = false;
    };
  }, []);

  // providers & spaces
  useEffect(() => {
    let mounted = true;

    async function loadProvidersAndSpaces() {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr || !auth?.user) return;
      const vendorId = auth.user.id;

      const [providersRes, spacesRes] = await Promise.all([
        supabase
          .from("providers")
          .select("id,name")
          .eq("vendor_id", vendorId)
          .neq("status", "unavailable")
          .order("name", { ascending: true }),
        supabase
          .from("spaces")
          .select("id,name")
          .eq("vendor_id", vendorId)
          .neq("status", "unavailable")
          .order("name", { ascending: true }),
      ]);

      if (!mounted) return;

      if (!providersRes.error && providersRes.data) {
        setAllProviders(
          providersRes.data.map((p) => ({ id: p.id, name: p.name }))
        );
      }
      if (!spacesRes.error && spacesRes.data) {
        setAllSpaces(
          spacesRes.data.map((s) => ({ id: s.id, name: s.name }))
        );
      }
    }

    void loadProvidersAndSpaces();
    return () => {
      mounted = false;
    };
  }, []);

  // load existing service
  useEffect(() => {
    let mounted = true;

    async function loadService() {
      try {
        setLoading(true);
        const res = await fetch(`/api/services/${serviceId}`);
        const data: LoadedService = await res.json();
        if (!res.ok) {
          console.error("Error loading service", data);
          return;
        }
        if (!mounted) return;

        setSku(data.sku ?? "");
        setName(data.name ?? "");
        setDescription(data.description ?? "");
        setStatus(data.status ?? "draft");

        setServiceTypes(data.serviceTypes ?? []);
        setLocationTypes(
          (data.locationTypes as LocationType[]) ?? ["in_person"]
        );
        setSelectedWellnessIds((data.wellnessDimensions ?? []).map(String));

        setCategories(data.categories ?? []);
        setTags(data.tags ?? []);

        setImages(data.images ?? []);
        setProviderIds(data.providerIds ?? []);
        setSpaceIds(data.spaceIds ?? []);

        const mappedTabs: DescriptionTab[] =
          (data.descriptionTabs ?? []).map((t, idx) => ({
            id: uuid(),
            title: t.title,
            body: t.body,
            position: t.position ?? idx,
          })) || [];
        mappedTabs.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        setTabs(
          mappedTabs.length
            ? mappedTabs
            : [{ id: uuid(), title: "Section 1", body: "" }]
        );

        console.log("Loaded location settings:", data.locationSettings);
        const locs: LocationSettingsState[] = (data.locationSettings ?? []).map(
          (loc) => ({
            id: uuid(),
            locationType: loc.locationType,
            sku: loc.sku ?? "",
            maxParticipants: loc.maxParticipants,
            price: loc.price,
            discountType: loc.discountType ?? null,
            discountValue: loc.discountValue,
            discountCap: loc.discountCap,
            hasFixedSchedule: !!loc.hasFixedSchedule,

            recurringRules: (loc.recurringRules ?? []).map((r) => ({
              id: uuid(),
              daysOfWeek: r.daysOfWeek ?? [],
              startTime: r.startTime ?? "09:00",
              endTime: r.endTime ?? "10:00",
              startDate: r.startDate ?? new Date().toISOString().split("T")[0],
              endDate: r.endDate ?? undefined,
              providerId: r.providerId ?? undefined,
            })),

            expiryType: loc.expiryType ?? "anytime",
            expiryDurationUnit: loc.expiryDurationUnit,
            expiryDurationValue: loc.expiryDurationValue,

            timeSlots: (loc.timeSlots ?? []).map((s) => ({
              id: uuid(),
              start: s.start ?? "",
              end: s.end ?? "",
              price: s.price,
              discountType: s.discountType ?? null,
              discountValue: s.discountValue,
              discountCap: s.discountCap,
            })),

            sessionOptions: (loc.sessionOptions ?? []).map((o, idx) => ({
              id: uuid(),
              label: o.label ?? `Option ${idx + 1}`,
              sessionsCount: o.sessionsCount ?? idx + 1,
              price: o.price ?? 0,
            })),
          })
        );

        setLocationSettings(
          locs.length
            ? locs
            : [
                {
                  id: uuid(),
                  locationType: "in_person",
                  sku: "",
                  maxParticipants: 0,
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
                  recurringRules: [],
                },
              ]
        );

        setActiveLocationTab(
          (locs[0]?.locationType as LocationType) ?? "in_person"
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (serviceId) {
      void loadService();
    }

    return () => {
      mounted = false;
    };
  }, [serviceId]);

  // keep locationSettings in sync with locationTypes
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
            maxParticipants: 0,
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
            recurringRules: [],
          });
        }
      });

      if (!locationTypes.includes(activeLocationTab)) {
        setActiveLocationTab(locationTypes[0] ?? "in_person");
      }

      return mapped;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationTypes.length]);

  const canSave = name.trim().length > 0;

  async function handleImageUpload(files: FileList | null) {
    if (!files || !files.length) return;
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const url = await uploadProviderImage(file);
      if (url) newUrls.push(url);
    }
    setImages((prev) => [...prev, ...newUrls].slice(0, 6));
  }

  function updateLocation(
    locType: LocationType,
    patch: Partial<LocationSettingsState>
  ) {
    setLocationSettings((prev) =>
      prev.map((loc) =>
        loc.locationType === locType ? { ...loc, ...patch } : loc
      )
    );
  }

  async function handleSave(nextStatus: ServiceStatus) {
    if (saving) return;
    setSubmitAttempted(true);

    // 1) validate description tabs
    if (!validateDescriptionTabs(tabs)) {
      setShowDescriptionErrorModal(true);
      return;
    }

    // 2) validate categories only when publishing active
    if (nextStatus === "active" && categories.length === 0) {
      setCategoryError("Please add at least one category.");
      setShowCategoryErrorModal(true);
      return;
    } else {
      setCategoryError(null);
    }

    if (!canSave) return;
    setSaving(true);

    const payload = {
      sku: sku || null,
      name,
      description,
      status: nextStatus,
      serviceTypes,
      locationTypes,
      wellnessDimensions: selectedWellnessIds,
      categories,
      tags,
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
        sku: loc.sku || null,
        maxParticipants: loc.maxParticipants ?? null,
        price: loc.price ?? null,
        discountType: loc.discountType ?? null,
        discountValue: loc.discountValue ?? null,
        discountCap: loc.discountCap ?? null,
        hasFixedSchedule: loc.hasFixedSchedule,
        expiryType: loc.expiryType,
        expiryDurationUnit: loc.expiryDurationUnit ?? null,
        expiryDurationValue: loc.expiryDurationValue ?? null,
        timeSlots: (loc.timeSlots ?? []).map((s) => ({
          start: s.start,
          end: s.end,
          price: s.price ?? null,
          discountType: s.discountType ?? null,
          discountValue: s.discountValue ?? null,
          discountCap: s.discountCap ?? null,
        })),
        sessionOptions: (loc.sessionOptions ?? []).map((p) => ({
          label: p.label,
          sessionsCount: p.sessionsCount,
          price: p.price,
        })),
        recurringRules: (loc.recurringRules ?? []).map((r) => ({
          daysOfWeek: r.daysOfWeek ?? [],
          startTime: r.startTime,
          endTime: r.endTime,
          startDate: r.startDate,
          endDate: r.endDate ?? null,
          providerId: r.providerId ?? null,
        })),
      })),
    };

    try {
      const res = await fetch(`/api/services/${serviceId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error(json);
        alert(json.error || "Error updating service");
        return;
      }
      router.push("/pages/services");
    } finally {
      setSaving(false);
    }
  }

  const activeLoc = locationSettings.find(
    (l) => l.locationType === activeLocationTab
  );

  return (
    <>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E5E0FF] bg-gradient-to-r from-[#F6F0FF] to-[#FDFBFF] px-8 py-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-[#1B1529]">
                Edit service
              </h1>
              <span
                className={clsx(
                  "inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold",
                  status === "active"
                    ? "bg-[#DCFCE7] text-[#166534]"
                    : status === "unavailable"
                    ? "bg-gray-300 text-gray-700"
                    : "bg-gray-200 text-gray-700"
                )}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
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
                Update Service
              </button>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-xs text-gray-500">
              <ClipLoader
                size={40}
                color="#6B46C1"
                cssOverride={{ animationDuration: "3s" }}
              />
            </div>
          ) : (
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
                          value={sku}
                          onChange={(e) => setSku(e.target.value)}
                          readOnly
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
                  <section
                    ref={descriptionSectionRef}
                    className="rounded-3xl border border-[#ECECFB] bg-white p-6"
                  >
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
                        className="inline-flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Image
                          src="/images/common/plus-button.svg"
                          alt="Add Section"
                          width={14}
                          height={14}
                        />
                        <span>Add Section</span>
                      </button>
                    </div>

                    <div className="space-y-4 text-xs">
                      {tabs.map((tab, idx) => {
                        const titleHasError =
                          descriptionHasError && tab.title.trim().length === 0;

                        return (
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
                                  className="p-1 hover:opacity-80 transition"
                                >
                                  <Image
                                    src="/images/common/close-button.svg"
                                    alt="Remove section"
                                    width={16}
                                    height={16}
                                  />
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
                                  className={clsx(
                                    "mt-1 w-full rounded-2xl bg-white px-3 py-2 text-xs focus:border-purple-500 focus:outline-none border",
                                    titleHasError
                                      ? "border-red-500"
                                      : "border-gray-200"
                                  )}
                                />
                                {titleHasError && (
                                  <p className="mt-1 text-[10px] text-red-600">
                                    Section title is required.
                                  </p>
                                )}
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
                        );
                      })}
                    </div>

                    {descriptionHasError && (
                      <p className="mt-2 text-[11px] text-red-600">
                        Please fill in all section titles before saving the
                        service.
                      </p>
                    )}
                  </section>

                  {/* Service Type, Providers, Spaces, Location types */}
                  <section className="rounded-3xl border border-[#ECECFB] bg-white p-6">
                    <h2 className="mb-4 text-sm font-semibold text-gray-900">
                      Service Type, Location Type, Providers &amp; Spaces
                    </h2>

                    <div className="space-y-4 text-xs">
                      {/* Providers & Spaces */}
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

                      {/* Service Types chips */}
                      <div>
                        <label className="text-[11px] font-semibold text-gray-800">
                          Service Type (choose 1)
                        </label>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {[
                            "1-1",
                            "Group Class",
                            "Private (At Home)",
                            "Private (Wellness Space)",
                          ].map((label) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setServiceTypes([label])}
                              className={clsx(
                                "rounded-full border px-3 py-1 text-[11px]",
                                serviceTypes.includes(label)
                                  ? "border-black bg-black text-white"
                                  : "border-gray-300 bg-[#FBFBFE] text-gray-700"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Location Types chips */}
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
                                      ? prev.length === 1
                                        ? prev
                                        : prev.filter((x) => x !== loc)
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
                          <h3 className="mb-4 text-sm font-semibold text-gray-900">
                            {loc.locationType === "online"
                              ? "Online Service Settings"
                              : "In-Person Service Settings"}
                          </h3>

                          {/* 2 rows → each row has exactly 2 columns */}
                          <div className="grid gap-4 text-xs md:grid-cols-2">
                            {/* ROW 1 — SKU */}
                            <div>
                              <label className="text-[11px] font-semibold text-gray-800">
                                SKU
                              </label>
                              <input
                                value={loc.sku}
                                onChange={(e) =>
                                  updateLocation(loc.locationType, {
                                    sku: e.target.value,
                                  })
                                }
                                className="mt-2 w-full rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
                              />
                            </div>

                            {/* ROW 1 — Max Participants */}
                            <div>
                              <label className="text-[11px] font-semibold text-gray-800">
                                Max Participants
                              </label>
                              <div className="mt-2 flex items-center gap-1">
                                <span className="inline-flex h-9 items-center rounded-2xl border border-gray-200 bg-white px-3 text-[11px] text-gray-500 shrink-0">
                                  QTY
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  value={loc.maxParticipants ?? ""}
                                  onChange={(e) =>
                                    updateLocation(loc.locationType, {
                                      maxParticipants:
                                        e.target.value === ""
                                          ? undefined
                                          : Number(e.target.value),
                                    })
                                  }
                                  className="h-9 flex-1 rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 text-xs focus:border-purple-500 focus:outline-none"
                                />
                              </div>
                            </div>

                            {/* Only show base price/discount if NO fixed schedule */}
                            {!loc.hasFixedSchedule && (
                              <>
                                {/* ROW 2 — Price */}
                                <div>
                                  <label className="text-[11px] font-semibold text-gray-800">
                                    Price
                                  </label>
                                  <div className="mt-2 flex items-center gap-1">
                                    <span className="inline-flex h-9 items-center rounded-2xl border border-gray-200 bg-white px-3 text-[11px] text-gray-500 shrink-0">
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
                                            e.target.value === ""
                                              ? undefined
                                              : Number(e.target.value),
                                        })
                                      }
                                      className="h-9 flex-1 rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 text-xs focus:border-purple-500 focus:outline-none"
                                    />
                                  </div>
                                </div>

                                {/* ROW 2 — Discount */}
                                <div>
                                  <label className="text-[11px] font-semibold text-gray-800">
                                    Discount
                                  </label>
                                  <div className="mt-2 flex flex-wrap items-center gap-1">
                                    <div className="flex rounded-2xl border border-gray-200 bg-white text-[11px] shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateLocation(loc.locationType, {
                                            discountType:
                                              loc.discountType === "fixed"
                                                ? null
                                                : "fixed",
                                          })
                                        }
                                        className={clsx(
                                          "px-3 py-1.5 rounded-l-2xl transition-colors",
                                          loc.discountType === "fixed"
                                            ? "bg-purple-600 text-white"
                                            : "text-gray-600 hover:bg-gray-50"
                                        )}
                                      >
                                        SGD
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateLocation(loc.locationType, {
                                            discountType:
                                              loc.discountType === "percent"
                                                ? null
                                                : "percent",
                                          })
                                        }
                                        className={clsx(
                                          "px-3 py-1.5 rounded-r-2xl transition-colors",
                                          loc.discountType === "percent"
                                            ? "bg-purple-600 text-white"
                                            : "text-gray-600 hover:bg-gray-50"
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
                                            e.target.value === ""
                                              ? undefined
                                              : Number(e.target.value),
                                        })
                                      }
                                      className="h-9 flex-1 rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 text-xs focus:border-purple-500 focus:outline-none"
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Availability Card */}
                          <div className="mt-6 rounded-2xl bg-[#FBFBFE] p-4 text-xs">
                            <div className="mb-3 flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900">
                                  Service Availability
                                </h4>
                                <p className="text-[11px] text-gray-500">
                                  Does this service have fixed date &amp; time
                                  slots?
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

                            {loc.hasFixedSchedule ? (
                              <>
                                {/* RECURRING RULES SECTION */}
                                <div className="mb-6 rounded-2xl border border-purple-200 bg-purple-50 p-4">
                                  <div className="mb-3 flex items-center justify-between">
                                    <h5 className="text-sm font-semibold text-purple-900">
                                      Recurring Schedule Rules
                                    </h5>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateLocation(loc.locationType, {
                                          recurringRules: [
                                            ...(loc.recurringRules ?? []),
                                            {
                                              id: uuid(),
                                              daysOfWeek: [],
                                              startTime: "09:00",
                                              endTime: "10:00",
                                              startDate: new Date()
                                                .toISOString()
                                                .split("T")[0],
                                              endDate: undefined,
                                              providerId: undefined,
                                            },
                                          ],
                                        })
                                      }
                                      className="rounded-full bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-purple-700"
                                    >
                                      + Add Rule
                                    </button>
                                  </div>

                                  <p className="mb-3 text-[10px] text-purple-700">
                                    Set up recurring time slots (e.g., every
                                    Monday & Wednesday at 9am). These will block
                                    dates when creating individual sessions
                                    below.
                                  </p>

                                  <div className="space-y-3">
                                    {(loc.recurringRules ?? []).map((rule) => (
                                      <div
                                        key={rule.id}
                                        className="rounded-xl border border-purple-200 bg-white p-3"
                                      >
                                        <div className="grid gap-3 md:grid-cols-2">
                                          {/* Days of week */}
                                          <div className="md:col-span-2">
                                            <label className="text-[10px] font-semibold text-gray-700">
                                              Days of Week
                                            </label>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                              {[
                                                "Sun",
                                                "Mon",
                                                "Tue",
                                                "Wed",
                                                "Thu",
                                                "Fri",
                                                "Sat",
                                              ].map((day, idx) => (
                                                <button
                                                  key={day}
                                                  type="button"
                                                  onClick={() => {
                                                    const newDays = (
                                                      rule.daysOfWeek ?? []
                                                    ).includes(idx)
                                                      ? (
                                                          rule.daysOfWeek ?? []
                                                        ).filter(
                                                          (d) => d !== idx
                                                        )
                                                      : [
                                                          ...(rule.daysOfWeek ??
                                                            []),
                                                          idx,
                                                        ].sort((a, b) => a - b);
                                                    updateLocation(
                                                      loc.locationType,
                                                      {
                                                        recurringRules: (
                                                          loc.recurringRules ??
                                                          []
                                                        ).map((r) =>
                                                          r.id === rule.id
                                                            ? {
                                                                ...r,
                                                                daysOfWeek:
                                                                  newDays,
                                                              }
                                                            : r
                                                        ),
                                                      }
                                                    );
                                                  }}
                                                  className={clsx(
                                                    "rounded-lg px-2 py-1 text-[10px] font-medium transition-colors",
                                                    (
                                                      rule.daysOfWeek ?? []
                                                    ).includes(idx)
                                                      ? "bg-purple-600 text-white"
                                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                  )}
                                                >
                                                  {day}
                                                </button>
                                              ))}
                                            </div>
                                          </div>

                                          {/* Start time */}
                                          <div>
                                            <label className="text-[10px] font-semibold text-gray-700">
                                              Start Time
                                            </label>
                                            <input
                                              type="time"
                                              value={rule.startTime}
                                              onChange={(e) =>
                                                updateLocation(
                                                  loc.locationType,
                                                  {
                                                    recurringRules: (
                                                      loc.recurringRules ?? []
                                                    ).map((r) =>
                                                      r.id === rule.id
                                                        ? {
                                                            ...r,
                                                            startTime:
                                                              e.target.value,
                                                          }
                                                        : r
                                                    ),
                                                  }
                                                )
                                              }
                                              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-xs"
                                            />
                                          </div>

                                          {/* End time */}
                                          <div>
                                            <label className="text-[10px] font-semibold text-gray-700">
                                              End Time
                                            </label>
                                            <input
                                              type="time"
                                              value={rule.endTime}
                                              onChange={(e) =>
                                                updateLocation(
                                                  loc.locationType,
                                                  {
                                                    recurringRules: (
                                                      loc.recurringRules ?? []
                                                    ).map((r) =>
                                                      r.id === rule.id
                                                        ? {
                                                            ...r,
                                                            endTime:
                                                              e.target.value,
                                                          }
                                                        : r
                                                    ),
                                                  }
                                                )
                                              }
                                              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-xs"
                                            />
                                          </div>

                                          {/* Start date */}
                                          <div>
                                            <label className="text-[10px] font-semibold text-gray-700">
                                              Start Date
                                            </label>
                                            <input
                                              type="date"
                                              value={rule.startDate}
                                              onChange={(e) =>
                                                updateLocation(
                                                  loc.locationType,
                                                  {
                                                    recurringRules: (
                                                      loc.recurringRules ?? []
                                                    ).map((r) =>
                                                      r.id === rule.id
                                                        ? {
                                                            ...r,
                                                            startDate:
                                                              e.target.value,
                                                          }
                                                        : r
                                                    ),
                                                  }
                                                )
                                              }
                                              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-xs"
                                            />
                                          </div>

                                          {/* End date (optional) */}
                                          <div>
                                            <label className="text-[10px] font-semibold text-gray-700">
                                              End Date (Optional)
                                            </label>
                                            <input
                                              type="date"
                                              value={rule.endDate ?? ""}
                                              onChange={(e) =>
                                                updateLocation(
                                                  loc.locationType,
                                                  {
                                                    recurringRules: (
                                                      loc.recurringRules ?? []
                                                    ).map((r) =>
                                                      r.id === rule.id
                                                        ? {
                                                            ...r,
                                                            endDate:
                                                              e.target.value ||
                                                              undefined,
                                                          }
                                                        : r
                                                    ),
                                                  }
                                                )
                                              }
                                              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-xs"
                                            />
                                          </div>

                                          {/* Provider (optional) */}
                                          <div className="md:col-span-2">
                                            <label className="text-[10px] font-semibold text-gray-700">
                                              Provider (Optional)
                                            </label>
                                            <select
                                              value={rule.providerId ?? ""}
                                              onChange={(e) =>
                                                updateLocation(
                                                  loc.locationType,
                                                  {
                                                    recurringRules: (
                                                      loc.recurringRules ?? []
                                                    ).map((r) =>
                                                      r.id === rule.id
                                                        ? {
                                                            ...r,
                                                            providerId:
                                                              e.target.value ||
                                                              undefined,
                                                          }
                                                        : r
                                                    ),
                                                  }
                                                )
                                              }
                                              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-xs"
                                            >
                                              <option value="">
                                                Any Provider
                                              </option>
                                              {allProviders.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                  {p.name}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateLocation(loc.locationType, {
                                              recurringRules: (
                                                loc.recurringRules ?? []
                                              ).filter((r) => r.id !== rule.id),
                                            })
                                          }
                                          className="mt-2 text-[10px] text-red-600 hover:text-red-700"
                                        >
                                          Remove Rule
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* INDIVIDUAL TIME SLOTS */}
                                <div className="mt-3 space-y-3">
                                  <h5 className="text-[11px] font-semibold text-gray-800">
                                    Individual Sessions (with per-session
                                    pricing & discounts)
                                  </h5>

                                  {(loc.timeSlots ?? []).map((slot, slotIdx) => (
                                    <div
                                      key={slot.id}
                                      className="rounded-2xl border border-gray-200 bg-white p-4"
                                    >
                                      <div className="mb-2 flex items-center justify-between">
                                        <span className="text-[11px] font-semibold text-purple-700">
                                          Session {slotIdx + 1}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateLocation(loc.locationType, {
                                              timeSlots: (
                                                loc.timeSlots ?? []
                                              ).filter((s) => s.id !== slot.id),
                                            })
                                          }
                                          className="text-xs text-red-600 hover:text-red-700"
                                        >
                                          Remove
                                        </button>
                                      </div>

                                      <div className="grid gap-3 md:grid-cols-2">
                                        {/* Start Date & Time */}
                                        <div>
                                          <label className="text-[10px] text-gray-600">
                                            Start Date & Time
                                          </label>
                                          <input
                                            type="datetime-local"
                                            value={toLocalDateTimeString(
                                              slot.start
                                            )}
                                            onChange={(e) =>
                                              updateLocation(loc.locationType, {
                                                timeSlots: (
                                                  loc.timeSlots ?? []
                                                ).map((s) =>
                                                  s.id === slot.id
                                                    ? {
                                                        ...s,
                                                        start: toISOString(
                                                          e.target.value
                                                        ),
                                                      }
                                                    : s
                                                ),
                                              })
                                            }
                                            className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs"
                                          />
                                        </div>

                                        {/* End Date & Time */}
                                        <div>
                                          <label className="text-[10px] text-gray-600">
                                            End Date & Time
                                          </label>
                                          <input
                                            type="datetime-local"
                                            value={toLocalDateTimeString(
                                              slot.end
                                            )}
                                            onChange={(e) =>
                                              updateLocation(loc.locationType, {
                                                timeSlots: (
                                                  loc.timeSlots ?? []
                                                ).map((s) =>
                                                  s.id === slot.id
                                                    ? {
                                                        ...s,
                                                        end: toISOString(
                                                          e.target.value
                                                        ),
                                                      }
                                                    : s
                                                ),
                                              })
                                            }
                                            className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs"
                                          />
                                        </div>

                                        {/* Price for this slot */}
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-700">
                                            Session Price
                                          </label>
                                          <div className="mt-1 flex items-center gap-1">
                                            <span className="inline-flex h-9 items-center rounded-2xl border border-gray-200 bg-white px-3 text-[11px] text-gray-500 shrink-0">
                                              SGD
                                            </span>
                                            <input
                                              type="number"
                                              min={0}
                                              step="0.01"
                                              value={slot.price ?? ""}
                                              onChange={(e) =>
                                                updateLocation(
                                                  loc.locationType,
                                                  {
                                                    timeSlots: (
                                                      loc.timeSlots ?? []
                                                    ).map((s) =>
                                                      s.id === slot.id
                                                        ? {
                                                            ...s,
                                                            price:
                                                              e.target.value ===
                                                              ""
                                                                ? undefined
                                                                : Number(
                                                                    e.target
                                                                      .value
                                                                  ),
                                                          }
                                                        : s
                                                    ),
                                                  }
                                                )
                                              }
                                              className="h-9 flex-1 rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 text-xs focus:border-purple-500 focus:outline-none"
                                            />
                                          </div>
                                        </div>

                                        {/* Discount for this slot */}
                                        <div>
                                          <label className="text-[10px] font-semibold text-gray-700">
                                            Session Discount
                                          </label>
                                          <div className="mt-1 flex flex-wrap items-center gap-1">
                                            <div className="flex rounded-2xl border border-gray-200 bg-white text-[11px] shrink-0">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  updateLocation(
                                                    loc.locationType,
                                                    {
                                                      timeSlots: (
                                                        loc.timeSlots ?? []
                                                      ).map((s) =>
                                                        s.id === slot.id
                                                          ? {
                                                              ...s,
                                                              discountType:
                                                                s.discountType ===
                                                                "fixed"
                                                                  ? null
                                                                  : "fixed",
                                                            }
                                                          : s
                                                      ),
                                                    }
                                                  )
                                                }
                                                className={clsx(
                                                  "px-3 py-1.5 rounded-l-2xl transition-colors",
                                                  slot.discountType === "fixed"
                                                    ? "bg-purple-600 text-white"
                                                    : "text-gray-600 hover:bg-gray-50"
                                                )}
                                              >
                                                SGD
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  updateLocation(
                                                    loc.locationType,
                                                    {
                                                      timeSlots: (
                                                        loc.timeSlots ?? []
                                                      ).map((s) =>
                                                        s.id === slot.id
                                                          ? {
                                                              ...s,
                                                              discountType:
                                                                s.discountType ===
                                                                "percent"
                                                                  ? null
                                                                  : "percent",
                                                            }
                                                          : s
                                                      ),
                                                    }
                                                  )
                                                }
                                                className={clsx(
                                                  "px-3 py-1.5 rounded-r-2xl transition-colors",
                                                  slot.discountType ===
                                                    "percent"
                                                    ? "bg-purple-600 text-white"
                                                    : "text-gray-600 hover:bg-gray-50"
                                                )}
                                              >
                                                %
                                              </button>
                                            </div>

                                            <input
                                              type="number"
                                              min={0}
                                              step="0.01"
                                              value={slot.discountValue ?? ""}
                                              onChange={(e) =>
                                                updateLocation(
                                                  loc.locationType,
                                                  {
                                                    timeSlots: (
                                                      loc.timeSlots ?? []
                                                    ).map((s) =>
                                                      s.id === slot.id
                                                        ? {
                                                            ...s,
                                                            discountValue:
                                                              e.target.value ===
                                                              ""
                                                                ? undefined
                                                                : Number(
                                                                    e.target
                                                                      .value
                                                                  ),
                                                          }
                                                        : s
                                                    ),
                                                  }
                                                )
                                              }
                                              className="h-9 flex-1 rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 text-xs focus:border-purple-500 focus:outline-none"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateLocation(loc.locationType, {
                                        timeSlots: [
                                          ...(loc.timeSlots ?? []),
                                          {
                                            id: uuid(),
                                            start: "",
                                            end: "",
                                            price: undefined,
                                            discountType: null,
                                            discountValue: undefined,
                                            discountCap: undefined,
                                          },
                                        ],
                                      })
                                    }
                                    className="mt-2 inline-flex items-center rounded-full bg-black px-4 py-2 text-[11px] font-semibold text-white"
                                  >
                                    + Add Session
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                  <div>
                                    <label className="text-[11px] font-semibold text-gray-800">
                                      Expiry Type
                                    </label>
                                    <div className="mt-2 flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateLocation(loc.locationType, {
                                            expiryType: "anytime",
                                          })
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
                                          updateLocation(loc.locationType, {
                                            expiryType: "duration",
                                          })
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
                                          value={
                                            loc.expiryDurationUnit ?? "days"
                                          }
                                          onChange={(e) =>
                                            updateLocation(loc.locationType, {
                                              expiryDurationUnit: e.target
                                                .value as
                                                | "days"
                                                | "weeks"
                                                | "months",
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

                                {/* Session Options */}
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
                                    {(loc.sessionOptions ?? []).map((opt, i) => (
                                      <div
                                        key={opt.id}
                                        className="grid items-end gap-3 md:grid-cols-[1.2fr_1fr_auto]"
                                      >
                                        <div>
                                          <label className="text-[11px] font-semibold text-gray-800">
                                            {`Option ${i + 1}`}
                                          </label>
                                          <input
                                            value={opt.label}
                                            onChange={(e) =>
                                              updateLocation(loc.locationType, {
                                                sessionOptions: (
                                                  loc.sessionOptions ?? []
                                                ).map((s) =>
                                                  s.id === opt.id
                                                    ? {
                                                        ...s,
                                                        label: e.target.value,
                                                      }
                                                    : s
                                                ),
                                              })
                                            }
                                            className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs"
                                          />
                                        </div>

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
                                                updateLocation(
                                                  loc.locationType,
                                                  {
                                                    sessionOptions: (
                                                      loc.sessionOptions ?? []
                                                    ).map((s) =>
                                                      s.id === opt.id
                                                        ? {
                                                            ...s,
                                                            price: Number(
                                                              e.target.value
                                                            ),
                                                          }
                                                        : s
                                                    ),
                                                  }
                                                )
                                              }
                                              className="h-9 flex-1 rounded-2xl border border-gray-200 bg-[#FBFBFE] px-3 text-xs"
                                            />
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateLocation(loc.locationType, {
                                              sessionOptions: (
                                                loc.sessionOptions ?? []
                                              ).filter((s) => s.id !== opt.id),
                                            })
                                          }
                                          className="h-9 rounded-full border border-gray-300 px-3 text-xs text-gray-500"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateLocation(loc.locationType, {
                                        sessionOptions: [
                                          ...(loc.sessionOptions ?? []),
                                          {
                                            id: uuid(),
                                            label: `Option ${
                                              (loc.sessionOptions ?? [])
                                                .length + 1
                                            }`,
                                            sessionsCount:
                                              (loc.sessionOptions ?? [])
                                                .length + 1,
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

                    {/* Main (cover) image */}
                    <div className="overflow-hidden rounded-3xl bg-gray-200 relative">
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

                    {/* Image thumbnails */}
                    <div className="mt-3 flex gap-2">
                      {images.slice(0, 5).map((url, idx) => (
                        <div
                          key={url}
                          className="relative h-14 w-14 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
                        >
                          <img
                            src={url}
                            alt=""
                            className="h-full w-full object-cover"
                          />

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => {
                              setImages((prev) =>
                                prev.filter((img) => img !== url)
                              );
                            }}
                            className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white shadow-md hover:bg-red-700"
                            aria-label="Remove image"
                          >
                            ✕
                          </button>
                        </div>
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
                  <div ref={categorySectionRef}>
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
                    {categoryError && (
                      <p className="mt-2 text-[11px] text-red-600">
                        {categoryError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

      {/* Description error modal */}
      <AppModal
        open={showDescriptionErrorModal}
        title="Section Title Required"
        message={
          <>
            One or more{" "}
            <span className="font-medium text-[#5B33FF]">
              description tabs
            </span>{" "}
            have an empty title. Please fill in all section titles before
            saving the service.
          </>
        }
        primaryLabel="Go to Description"
        onPrimaryClick={() => {
          setShowDescriptionErrorModal(false);
          descriptionSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
        onClose={() => setShowDescriptionErrorModal(false)}
      />

      {/* Category error modal */}
      <AppModal
        open={showCategoryErrorModal}
        title="Category Required"
        message={
          <>
            To publish this service, please add at least one category in the{" "}
            <span className="font-medium text-[#5B33FF]">
              Wellness Dimension, Category &amp; Tags
            </span>{" "}
            section.
          </>
        }
        primaryLabel="Go to Category"
        onPrimaryClick={() => {
          setShowCategoryErrorModal(false);
          categorySectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
        onClose={() => setShowCategoryErrorModal(false)}
      />
    </>
  );
}
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../../lib/supabase/client";
import Sidebar from "../../../../components/sidebar/Sidebar";
import SettingsNav from "../../../../components/settings/SettingsNav";
import { buildSidebarConfig } from "../../../../components/sidebar/sidebar.config";
import { useToast } from "../../../../components/toast/ToastProvider";
import ClipLoader from "react-spinners/ClipLoader";
import { useAuthGuard } from "../../../../hooks/useAuthGuard";

/* ---------------- Types ---------------- */
type DocKind =
  | "vendor_agreement"
  | "uen_acra"
  | "product_certificate"
  | "service_certificate";

type DocRow = {
  id: string;
  vendor_id: string;
  kind: DocKind;
  file_name: string;
  storage_key: string;      // full storage path
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  uploaded_at: string;
};

type UserStatus = "active" | "inactive" | "pending";

type ProfileLite = { id: string; email: string | null; status: UserStatus; onboarding_completed: boolean; full_name: string | null };

/* --------------- Constants -------------- */
const BUCKET = "vendor-docs";
const TEMPLATE_URL = "/docs/vendor-agreement-template.pdf";

/* --------------- Page ------------------- */
export default function DocumentsAgreementsPage() {
  const [me, setMe] = useState<ProfileLite | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [policyUrl, setPolicyUrl] = useState("");
  const [savingUrl, setSavingUrl] = useState(false);
  const [uploading, setUploading] = useState<DocKind | null>(null);
  const [loading, setLoading] = useState(true);
  const { successToast, errorToast } = useToast();

  const sidebarConfig = useMemo(
    () =>
      buildSidebarConfig({
        fullName: me?.full_name || me?.email || "User",
        email: me?.email || "",
        role: "Vendor",
       status: me?.status ?? "active"
      }),
    [me]
  );

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      // profile
      const { data: p } = await supabase
        .from("profiles")
        .select("id,email,full_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      setMe(p as ProfileLite);

      // docs
      const { data: d } = await supabase
        .from("vendor_docs")
        .select("*")
        .eq("vendor_id", auth.user.id)
        .order("uploaded_at", { ascending: false });
      setDocs((d || []) as DocRow[]);

      // policy
      const { data: pol } = await supabase
        .from("vendor_business")
        .select("policy_url")
        .eq("id", auth.user.id)
        .maybeSingle();
      setPolicyUrl(pol?.policy_url ?? "");

      setLoading(false);
    })();
  }, []);

  const listFor = (k: DocKind) => docs.filter(d => d.kind === k);

  async function upload(kind: DocKind, file: File) {
    if (!me) return;
    setUploading(kind);
    try {
      const objectPath = `${me.id}/${kind}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, file, { cacheControl: "0", upsert: false });
      if (upErr) throw upErr;

      const { data: inserted, error: insErr } = await supabase
        .from("vendor_docs")
        .insert({
          vendor_id: me.id,
          kind,
          file_name: file.name,
          storage_key: `${BUCKET}/${objectPath}`,
          status: "pending",
          rejection_reason: null,
        })
        .select("*")
        .single();
      if (insErr) throw insErr;

      setDocs(prev => [inserted as DocRow, ...prev]);
    } catch (e: any) {
      errorToast({ title: "Error", description: `Upload failed: ${e.message}` });
    } finally {
      setUploading(null);
    }
  }

  async function removeDoc(row: DocRow) {
    // Only allow delete for **pending** per your latest rule
    if (row.status !== "pending") return;
    if (!confirm("Delete this pending file?")) return;

    const objectPath = row.storage_key.replace(`${BUCKET}/`, "");
    const { error: stErr } = await supabase.storage.from(BUCKET).remove([objectPath]);
    if (stErr) return errorToast({ title: "Error", description: stErr.message });

    const { error: dbErr } = await supabase.from("vendor_docs").delete().eq("id", row.id);
    if (dbErr) return errorToast({ title: "Error", description: dbErr.message });

    setDocs(xs => xs.filter(d => d.id !== row.id));
  }

  async function openSigned(storage_key: string) {
    const path = storage_key.replace(`${BUCKET}/`, "");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
    if (error) return errorToast({ title: "Error", description: error.message });
    window.open(data.signedUrl, "_blank");
  }

  async function savePolicyUrl() {
    if (!me) return;
    setSavingUrl(true);
    const { error } = await supabase
        .from("vendor_business")
        .update({ policy_url: policyUrl, updated_at: new Date().toISOString() })
        .eq("id", me.id);
          setSavingUrl(false);
          if (error) errorToast({ title: "Error", description: error.message });
        }

  /* ---------- Small UI bits ---------- */
  const StatusBadge = ({ s }: { s: DocRow["status"] }) => {
    const map = {
      pending: "bg-amber-50 text-amber-700 ring-amber-200",
      approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      rejected: "bg-rose-50 text-rose-700 ring-rose-200",
    } as const;
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${map[s]}`}>
        {s}
      </span>
    );
  };

  const FileChip = ({ row }: { row: DocRow }) => {
    const deletable = row.status === "pending";
    return (
      <div className="group flex w-full items-center gap-2 rounded-xl bg-[#EFEAFE]/60 px-3 py-2 ring-1 ring-[#D9D0FF] hover:bg-[#EFEAFE]">
        <button
          type="button"
          onClick={() => openSigned(row.storage_key)}
        >
          <span
            className="max-w-[22ch] truncate text-[13px] font-medium text-[#4C3AD8] underline-offset-2 hover:underline"
            title="Open file"
          >
            {row.file_name}
          </span>
        </button>

        <StatusBadge s={row.status} />

        {row.status === "rejected" && row.rejection_reason && (
          <span className="truncate text-xs text-rose-600" title={row.rejection_reason}>
            Reason: {row.rejection_reason}
          </span>
        )}

        <span className="ml-auto whitespace-nowrap text-[11px] text-gray-400">
          {new Date(row.uploaded_at).toLocaleString()}
        </span>

        <button
          type="button"
          onClick={() => (deletable ? removeDoc(row) : undefined)}
          className={`ml-1 inline-grid h-6 w-6 place-items-center rounded-full border transition
            ${deletable
              ? "border-gray-300 text-gray-700 hover:bg-gray-50"
              : "cursor-not-allowed border-gray-200 text-gray-300"
            }`}
          title={deletable ? "Delete file" : "Cannot delete (not pending)"}
          disabled={!deletable}
        >
          ×
        </button>
      </div>
    );
  };

  const FilesList = ({ kind }: { kind: DocKind }) => {
    const items = listFor(kind);
    if (!items.length) {
      return (
        <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
          No file uploaded yet.
        </div>
      );
    }
    return (
      <ul className="space-y-2">
        {items.map(r => (
          <li key={r.id} className="flex">
            <FileChip row={r} />
          </li>
        ))}
      </ul>
    );
  };

  function Section({
    title,
    hint,
    kind,
    accept = ".pdf",
    templateUrl,
    multi = false, // only true for product/service certs
  }: {
    title: string;
    hint: string;
    kind: DocKind;
    accept?: string;
    templateUrl?: string;
    multi?: boolean;
  }) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [picked, setPicked] = useState("No file chosen");
    const pick = () => inputRef.current?.click();

    async function onPicked(files: FileList | null) {
      if (!files || !files.length) return;
      setPicked(files.length === 1 ? files[0].name : `${files.length} files selected`);
      for (const f of Array.from(files)) await upload(kind, f);
      if (inputRef.current) inputRef.current.value = "";
    }

    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        {/* header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
            <p className="text-[13px] text-gray-500">{hint}</p>
          </div>

          {templateUrl && (
            <a
              href={templateUrl}
              target="_blank"
              className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              Download &amp; Sign
            </a>
          )}
        </div>

        {/* body: left meta / right files */}
        <div className="mt-4 grid gap-4 sm:grid-cols-12">
          <div className="sm:col-span-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-[12px] text-gray-600">
              Allowed: PDF/JPG/PNG (max ~10MB). Files appear on the right with their review status.
            </div>
          </div>

          <div className="sm:col-span-8">
            <FilesList kind={kind} />

            {/* Single upload row – never duplicates */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={accept}
                multiple={!!multi}
                onChange={(e) => onPicked(e.target.files)}
              />

              <button
                type="button"
                onClick={pick}
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
              >
                {uploading === kind ? "Uploading…" : "Upload File"}
              </button>

              <span className="text-sm text-gray-500">{picked}</span>

              {multi && (
                <button
                  type="button"
                  onClick={pick}
                  className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  title="Add more files"
                >
                  +
                </button>
              )}
            </div>

            <p className="mt-2 text-[12px] text-gray-500">
              {multi
                ? "Upload PDF/JPG/PNG’s — you can add multiple certificates."
                : "Upload a single PDF/JPG/PNG file."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
               <ClipLoader size="md" color="gray" />

      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F7F7FB]">
      {/* left rails */}
      <Sidebar config={sidebarConfig} />
      <SettingsNav />

      {/* main */}
      <main className="flex-1 overflow-y-auto pb-28 md:pb-24">
  <div className="mx-auto max-w-6xl px-6 py-8 md:px-8 md:py-10">
              <h1 className="text-[28px] font-semibold text-gray-900">Business Settings</h1>

          {/* tabs */}
          <div className="mt-6 flex flex-wrap gap-8 border-b border-gray-200 text-sm">
            <a href="/pages/setting/business" className="pb-3 text-gray-600 hover:text-gray-900">
              Business Information
            </a>
            <a href="/pages/setting/brand" className="pb-3 text-gray-600 hover:text-gray-900">
              Brand Story &amp; Offerings
            </a>
            <span className="border-b-2 border-gray-900 pb-3 font-semibold text-gray-900">
              Documents &amp; Agreements
            </span>
            <a href="/pages/setting/verification" className="pb-3 text-gray-600 hover:text-gray-900">
              Verification Status
            </a>
          </div>

          {/* sections */}
          <div className="mt-8 space-y-8">
            <Section
              title="Vendor Agreement (Download → Sign → Upload)"
              hint="Upload the signed PDF of the vendor agreement."
              kind="vendor_agreement"
              accept=".pdf"
              templateUrl={TEMPLATE_URL}
            />

            <Section
              title="Business Registration (UEN / ACRA)"
              hint="Upload the official document showing your UEN / business registration."
              kind="uen_acra"
              accept=".pdf,.jpg,.jpeg,.png"
            />

            <Section
              title="Upload Product Certificates"
              hint="Upload any licenses, safety/compliance docs, or qualifications relevant to your listings."
              kind="product_certificate"
              accept=".pdf,.jpg,.jpeg,.png"
              multi
            />

            <Section
              title="Upload Service Certificates"
              hint="Upload any licenses, safety/compliance docs, or qualifications relevant to your services."
              kind="service_certificate"
              accept=".pdf,.jpg,.jpeg,.png"
              multi
            />

            {/* Policy URL */}
            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="text-[15px] font-semibold text-gray-900">
                Rescheduling / Cancellation / Returns / Refund Policy
              </h3>
              <p className="mt-1 text-[13px] text-gray-500">
                Add a link to your business policy page (e.g., https://brand.com/policy).
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="url"
                  placeholder="https://yourbrand.com/policy"
                  className="h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-gray-900 focus:border-purple-500 focus:ring-purple-500"
                  value={policyUrl}
                  onChange={(e) => setPolicyUrl(e.target.value)}
                />
                <button
                  onClick={savePolicyUrl}
                  disabled={savingUrl}
                  className="h-11 rounded-full bg-black px-6 text-white hover:bg-gray-900 disabled:opacity-60"
                >
                  {savingUrl ? "Saving…" : "Save"}
                </button>
              </div>
            </section>
          </div>

          {/* sticky actions */}
          <footer
              role="contentinfo"
              className="fixed bottom-0 left-0 right-0 z-30"
            >
              <div className="mx-auto max-w-6xl px-6 md:px-8">
                {/* safe-area friendly bottom margin */}
                <div className="mb-[max(env(safe-area-inset-bottom),16px)] rounded-full border border-gray-200 bg-white shadow-lg backdrop-blur px-3 py-2.5 flex items-center justify-end gap-3">
                  <a
                    href="/pages/setting/business"
                    className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Go back without saving
                  </a>
                  <button
                    onClick={savePolicyUrl}
                    disabled={savingUrl}
                    className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
                  >
                    {savingUrl ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </footer>
        </div>
      </main>
    </div>
  );
}
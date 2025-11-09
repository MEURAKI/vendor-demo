function FileRowUpload({
  title,
  helper,
  note,
  accept,
  file,
  onChange,
}: {
  title: string;
  helper?: string;
  note?: string;
  accept?: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const inputId = `${title.replace(/\s+/g, "-").toLowerCase()}-input`;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {helper && <p className="text-xs text-gray-500">{helper}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className="cursor-pointer bg-black text-white rounded-full px-5 py-2 text-sm font-medium hover:bg-gray-900"
        >
          Choose File
        </label>

        <span className="inline-flex items-center rounded-xl bg-gray-100 text-gray-600 text-sm px-4 py-2 min-h-[40px]">
          {file ? file.name : "No File Chosen"}
        </span>

        <input
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => onChange(e.target.files ? e.target.files[0] : null)}
        />
      </div>

      {note && <p className="text-xs text-gray-500">{note}</p>}
    </section>
  );
}


export default FileRowUpload;
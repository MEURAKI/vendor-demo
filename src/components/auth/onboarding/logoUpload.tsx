function LogoUpload({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <section className="space-y-3">
      <label className="block text-sm font-semibold text-gray-800">
        Company Logo *
      </label>
      <p className="text-xs text-gray-500">
        This logo will be displayed on the app. Click to upload. Size file max upload 300kb.
      </p>

      <div className="flex items-center gap-4">
        {/* Small icon on the left */}
        <div className="h-12 w-12 rounded-xl bg-purple-50 ring-1 ring-purple-200 flex items-center justify-center">
          {/* inline icon so we don't rely on a missing /images/upload-icon.svg */}
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-6 w-6 text-purple-500"
            fill="currentColor"
          >
            <path d="M4 5a2 2 0 0 1 2-2h2.172a2 2 0 0 1 1.414.586l1.828 1.828H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm6 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
          </svg>
        </div>

        {/* Right side: Choose button + filename */}
        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="logo"
            className="cursor-pointer bg-black text-white rounded-full px-5 py-2 text-sm font-medium hover:bg-gray-900"
          >
            Choose File
          </label>
          <span className="text-sm text-gray-600">
            {file ? file.name : "No File Chosen"}
          </span>
        </div>
      </div>

      <input
        id="logo"
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onChange(e.target.files ? e.target.files[0] : null)}
      />
    </section>
  );
}
export default LogoUpload;
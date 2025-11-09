function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-800 mb-1" style={{ letterSpacing: 0 }}>
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl bg-purple-50/60 border border-transparent focus:border-purple-300 focus:ring-2 focus:ring-purple-400 px-4 py-3 text-gray-800 placeholder-gray-400 outline-none transition"
        required={label.includes("*")}
      />
    </div>
  );
}

export default Field;
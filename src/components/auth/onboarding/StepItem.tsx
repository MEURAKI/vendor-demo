function StepItem({
  num,
  label,
  active,
  dim,
}: {
  num: number;
  label: string;
  active?: boolean;
  dim?: boolean;
}) {
  const circle = active
    ? "bg-black text-white border-black"
    : "bg-gray-100 text-gray-500 border-gray-300";
  const text = active ? "text-black" : dim ? "text-gray-400" : "text-gray-600";

  return (
    <span className={`inline-flex items-center gap-2 ${text}`}>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${circle}`}
        aria-hidden
      >
        {num}
      </span>
      <span className="truncate max-w-[9rem] sm:max-w-[14rem]">{label}</span>
    </span>
  );
}
export default StepItem;
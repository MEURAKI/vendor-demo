import { ExperienceDate } from "../../types/experience.types";

export function DatesManager({
  dates,
  onChange,
}: {
  dates: ExperienceDate[];
  onChange: (dates: ExperienceDate[]) => void;
}) {
  return (
    <div className="space-y-4">
      {dates.map((d, i) => (
        <div key={d.id} className="rounded-xl border p-4">
          <h4 className="text-sm font-semibold">
            Session {i + 1}
          </h4>

          <input
            type="date"
            value={d.date}
            onChange={e =>
              onChange(
                dates.map(x =>
                  x.id === d.id ? { ...x, date: e.target.value } : x
                )
              )
            }
          />

          <input type="time" value={d.startTime} />
          <input type="time" value={d.endTime} />

          <input
            type="number"
            placeholder="Capacity"
            value={d.capacity}
          />
        </div>
      ))}

      <button
        onClick={() =>
          onChange([
            ...dates,
            {
              id: crypto.randomUUID(),
              date: "",
              startTime: "",
              endTime: "",
              timezone: "Asia/Singapore",
              capacity: 0,
              cutoffHours: 0,
              status: "draft",
            },
          ])
        }
        className="rounded-full bg-black px-4 py-2 text-xs text-white"
      >
        + Add Date
      </button>
    </div>
  );
}
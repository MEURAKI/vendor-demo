import { ExperienceTicket } from "../../types/experience.types";

export function TicketsManager({
  tickets,
  onChange,
}: {
  tickets: ExperienceTicket[];
  onChange: (tickets: ExperienceTicket[]) => void;
}) {
  return (
    <div className="space-y-4">
      {tickets.map((t, i) => (
        <div key={t.id} className="rounded-xl border p-4">
          <h4 className="text-sm font-semibold">
            Ticket {i + 1}
          </h4>

          <input
            value={t.name}
            placeholder="Ticket name"
          />

          <input
            type="number"
            value={t.price}
            placeholder="Price"
          />

          <label>
            <input type="checkbox" checked={t.allowXp} />
            Allow XP
          </label>

          <label>
            <input type="checkbox" checked={t.allowCorporate} />
            Corporate seats
          </label>

          <label>
            <input type="checkbox" checked={t.allowPromocodes} />
            Promo codes
          </label>
        </div>
      ))}

      <button
        onClick={() =>
          onChange([
            ...tickets,
            {
              id: crypto.randomUUID(),
              name: "General",
              price: 0,
              maxPerUser: 4,
              allowXp: false,
              allowCorporate: false,
              allowPromocodes: false,
            },
          ])
        }
        className="rounded-full bg-black px-4 py-2 text-xs text-white"
      >
        + Add Ticket Type
      </button>
    </div>
  );
}
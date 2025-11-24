// app/vendor/orders/[id]/items/page.tsx
import Link from "next/link";

type ItemRow = {
  id: string;
  name: string;
  options: string;
  qty: number;
  unitPrice: string;
  lineTotal: string;
  fulfilment: "packed" | "processing";
};

const MOCK_ITEMS: ItemRow[] = [
  {
    id: "1",
    name: "PUNE yoga bag",
    options: "Color: Dusty rose · Size: Standard",
    qty: 1,
    unitPrice: "$50.00",
    lineTotal: "$50.00",
    fulfilment: "packed",
  },
  {
    id: "2",
    name: "Organic Yoga Mat Spray",
    options: "Lavender · 250ml",
    qty: 1,
    unitPrice: "$20.00",
    lineTotal: "$20.00",
    fulfilment: "processing",
  },
];

const fulfilmentBadge = (f: ItemRow["fulfilment"]) => {
  if (f === "packed") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
};

export default function OrderItemsPage() {
  const orderCode = "#4828";

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 text-sm text-slate-500">
          <Link href="/pages/vendor/orders" className="hover:underline">
            Back to orders
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Items for Order {orderCode}
            </h1>
            <p className="text-sm text-slate-500">
              Daniel Chan · Placed on Aug 21, 2025 · 10 items
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white">
              Total: $99.20 · Your earnings: $94.40
            </div>
            <button className="rounded-full bg-white px-4 py-2 text-sm shadow-sm">
              Print packing slip
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 text-sm text-slate-600">
            <span>All items in this order</span>
            <div className="flex items-center gap-4 text-xs">
              <span>10 items</span>
              <button className="text-slate-500 underline-offset-4 hover:underline">
                Collapse to 3 items
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3">Item</th>
                  <th className="px-6 py-3">Options</th>
                  <th className="px-6 py-3">Qty</th>
                  <th className="px-6 py-3">Unit price</th>
                  <th className="px-6 py-3">Line total</th>
                  <th className="px-6 py-3">Fulfilment</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_ITEMS.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-4 text-slate-900">{item.name}</td>
                    <td className="px-6 py-4 text-slate-600">{item.options}</td>
                    <td className="px-6 py-4">{item.qty}</td>
                    <td className="px-6 py-4">{item.unitPrice}</td>
                    <td className="px-6 py-4">{item.lineTotal}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${fulfilmentBadge(
                          item.fulfilment
                        )}`}
                      >
                        {item.fulfilment === "packed" ? "Packed" : "Processing"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
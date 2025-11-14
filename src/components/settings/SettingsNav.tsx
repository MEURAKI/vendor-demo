// components/settings/SettingsNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Alerts = Record<string, boolean | number | undefined>;

const groups = [
  {
    label: "Account Settings",
    items: [
      { href: "/pages/setting/profile", label: "Profile Information" },
      { href: "/pages/setting/security", label: "Login & Security" },
      { href: "/pages/setting/notifications", label: "Notifications" },
    ],
  },
  {
    label: "Business Settings",
    items: [
      { href: "/pages/setting/business", label: "Business Information" },
      { href: "/pages/setting/brand", label: "Brand Story & Offerings" },
      { href: "/pages/setting/docs", label: "Documents & Agreements" },
      { href: "/pages/setting/verification", label: "Verification Status" },
    ],
  },
  {
    label: "Shop Settings",
    items: [
      { href: "/pages/setting/shop", label: "General" },
      { href: "/pages/setting/shop/fulfilment", label: "Fulfilment & Delivery" },
    ],
  },
  {
    label: "Billing & Payment Settings",
    items: [
      { href: "/pages/setting/payouts", label: "Payout Details" },
      { href: "/pages/setting/plan", label: "Plan & Subscription" },
      { href: "/pages/setting/invoices", label: "Invoices & Statements" },
    ],
  },
];

export default function SettingsNav({ alerts = {} as Alerts }: { alerts?: Alerts }) {
  const pathname = usePathname();
  return (
    <aside className="w-[280px] shrink-0 border-r border-gray-200 bg-white">
      <div className="p-6">
        <div className="mb-4 text-sm font-semibold text-gray-500">Account Settings</div>
        <nav className="space-y-8">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {g.label}
              </div>
              <ul className="space-y-1">
                {g.items.map((i) => {
                  const active = pathname === i.href;
                  const showDot = Boolean(alerts[i.href]);
                  return (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        className={[
                          "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                          active
                            ? "bg-gray-100 text-gray-900"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                        ].join(" ")}
                      >
                        <span>{i.label}</span>
                        {showDot && (
                          <span
                            className="ml-3 inline-block h-2 w-2 flex-none rounded-full bg-rose-500"
                            aria-label="Requires attention"
                            title="Requires attention"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
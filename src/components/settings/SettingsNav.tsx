"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Alerts = Record<string, boolean | number | undefined>;

type NavItem = {
  href: string;
  label: string;
  tabKey?: string; // for routes that have internal tabs
};

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Account Settings",
    items: [
      { href: "/pages/setting/profile", label: "Profile Information", tabKey: "profile" },
      { href: "/pages/setting/profile", label: "Login & Security", tabKey: "security" },
      { href: "/pages/setting/profile", label: "Notifications", tabKey: "notifications" },
    ],
  },
  {
    label: "Business Settings",
    items: [
      { href: "/pages/setting/business", label: "Business Information", tabKey: "business" },
      { href: "/pages/setting/business", label: "Brand Story & Offerings", tabKey: "brand" },
      { href: "/pages/setting/business", label: "Documents & Agreements", tabKey: "docs" },
      { href: "/pages/setting/business", label: "Verification Status", tabKey: "verification" },
    ],
  },
  {
    label: "Shop Settings",
    items: [
      { href: "/pages/setting/shop", label: "General", tabKey: "general" },
      { href: "/pages/setting/shop", label: "Fulfilment & Delivery", tabKey: "fulfilment" },
      { href: "/pages/setting/shop", label: "Promo Code", tabKey: "promos" },
      { href: "/pages/setting/shop", label: "Session Hours", tabKey: "sessions" },
    ],
  },
  {
    label: "Billing & Payment Settings",
    items: [
      { href: "/pages/setting/payouts", label: "Payout Details", tabKey: "payouts" },
      { href: "/pages/setting/payouts", label: "Plan & Subscription", tabKey: "plan" },
      { href: "/pages/setting/payouts", label: "Invoices & Statements", tabKey: "invoices" },
    ],
  },
];

export default function SettingsNav({ alerts = {} as Alerts }: { alerts?: Alerts }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  // default tab when there is no ?tab= in URL
  const defaultTabByRoute: Record<string, string | undefined> = {
    "/pages/setting/business": "business",
    "/pages/setting/shop": "general",
    "/pages/setting/payouts": "payouts",
  };

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
                  const baseMatch = pathname === i.href;

                  const effectiveTab =
                    currentTab || defaultTabByRoute[i.href] || undefined;

                  const tabMatch = i.tabKey ? i.tabKey === effectiveTab : true;

                  const active = baseMatch && tabMatch;

                  // allow alerts to be per-tab OR per-route
                  const keyForAlert = i.tabKey
                    ? `${i.href}?tab=${i.tabKey}`
                    : i.href;

                  const alertVal = alerts[keyForAlert] ?? alerts[i.href];

                  let showDot = false;
                  let isMissing = false;

                  if (typeof alertVal === "boolean") {
                    showDot = true;
                    isMissing = alertVal; // true => missing, false => complete
                  } else if (typeof alertVal === "number") {
                    showDot = true;
                    isMissing = alertVal > 0; // e.g. count of missing items
                  }

                  return (
                    <li key={`${i.href}-${i.tabKey || "root"}`}>
                      <Link
                        href={i.tabKey ? `${i.href}?tab=${i.tabKey}` : i.href}
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
                            className={[
                              "ml-3 inline-block h-2 w-2 flex-none rounded-full",
                              isMissing ? "bg-rose-500" : "bg-emerald-500",
                            ].join(" ")}
                            aria-label={isMissing ? "Requires attention" : "Completed"}
                            title={isMissing ? "Requires attention" : "Completed"}
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

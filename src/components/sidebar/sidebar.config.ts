"use client";

import {
  BarChart3,
  CalendarDays,
  Package,
  Airplay,
  ShoppingBasket,
  Users,
  PiggyBank,
  Boxes,
  TrendingUp,
  Gift,
  ClipboardList,
  House,
} from "lucide-react";

/* -------------------------------------------------- */
/* ICON MAP                                           */
/* -------------------------------------------------- */

export const ICONS = {
  BarChart3,
  CalendarDays,
  Package,
  Airplay,
  ShoppingBasket,
  Users,
  PiggyBank,
  Boxes,
  TrendingUp,
  Gift,
  ClipboardList,
  House,
};

export type IconName = keyof typeof ICONS;

export type SidebarItem = {
  id: string;
  label: string;
  href: string;
  badge?: number;
};

export type SidebarGroup = {
  id: string;
  label: string;
  icon: IconName;
  items: SidebarItem[];
};

export type SidebarSection = {
  id: string;
  label: string;
  groups: SidebarGroup[];
};

export type SidebarConfig = {
  profile: {
    initials: string;
    name: string;
    role: string;
    status: string;
  };
  sections: SidebarSection[];
};

/* -------------------------------------------------- */
/* HELPER – Initials                                  */
/* -------------------------------------------------- */

function getInitials(nameOrEmail?: string | null) {
  if (!nameOrEmail) return "U";
  const name = nameOrEmail.includes("@")
    ? nameOrEmail.split("@")[0]
    : nameOrEmail;

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* -------------------------------------------------- */
/* MAIN CONFIG BUILDER                                */
/* -------------------------------------------------- */

export function buildSidebarConfig({
  fullName,
  email,
  role,
  status,
}: {
  fullName?: string | null;
  email?: string | null;
  role?: string;
  status?: string;
}): SidebarConfig {
  const displayName = fullName || email || "User";

  return {
    profile: {
      initials: getInitials(fullName || email),
      name: displayName,
      role: role || "Subscriber",
      status: status || "Active",
    },

    sections: [
      /* ---------------------------------------------- */
      /* 1) Overview                                    */
      /* ---------------------------------------------- */
      {
        id: "overview",
        label: "Overview",
        groups: [
          {
            id: "home",
            label: "Home",
            icon: "House",
            items: [
              { id: "home-splash", label: "Home", href: "/pages/home" },
            ],
          },
          {
            id: "dashboard",
            label: "Dashboard",
            icon: "BarChart3",
            items: [
              { id: "dash-home", label: "Dashboard", href: "/pages/dashboard" },
            ],
          },
          {
            id: "analytics",
            label: "Analytics",
            icon: "TrendingUp",
            items: [
              { id: "a-overview", label: "Analytics", href: "/pages/vendor/analytics" },
            ],
          },
        ],
      },

      /* ---------------------------------------------- */
      /* 2) Shop Listings                               */
      /* ---------------------------------------------- */
      {
        id: "listings",
        label: "Shop Listings",
        groups: [
          {
            id: "products",
            label: "Products",
            icon: "Package",
            items: [
              { id: "p-all", label: "All Products", href: "/pages/products" },
              { id: "p-add", label: "Add Product", href: "/pages/products/new" },
              {
                id: "p-inv",
                label: "Inventory",
                href: "/pages/products/inventory",
              },
              {
                id: "p-bundles",
                label: "Bundles",
                href: "/pages/products/bundles",
              },
            ],
          },

          {
            id: "services",
            label: "Services",
            icon: "ShoppingBasket",
            items: [
              { id: "s-all", label: "All Services", href: "/pages/services" },
              { id: "s-add", label: "Add Service", href: "/pages/services/new" },
              {
                id: "s-providers",
                label: "Wellness Providers",
                href: "/pages/services/providers",
              },
              {
                id: "s-spaces",
                label: "Wellness Spaces",
                href: "/pages/services/spaces",
              },
            ],
          },
          {
            id: "experiences",
            label: "Experiences",
            icon: "Airplay",
            items: [
              { id: "e-all", label: "All Experiences", href: "/pages/experiences" },
              { id: "e-add", label: "Add Experience", href: "/pages/experiences/new" },
              { id: "e-providers", label: "Wellness Providers", href: "/pages/experiences/providers" },
              { id: "e-spaces", label: "Wellness Spaces", href: "/pages/experiences/spaces" },
            ],
          }
        ],
      },

      /* ---------------------------------------------- */
      /* 3) Rewards                                     */
      /* ---------------------------------------------- */
      {
        id: "rewards",
        label: "Rewards",
        groups: [
          {
            id: "reward-calendar",
            label: "Rewards Calendar",
            icon: "Gift",
            items: [
              {
                id: "r-submissions",
                label: "Rewards Calendar",
                href: "/pages/rewards/submissions",
              },
            ],
          },
        ],
      },

      /* ---------------------------------------------- */
      /* 4) Quests                                      */
      /* ---------------------------------------------- */
      {
        id: "quests",
        label: "Quests",
        groups: [
          {
            id: "quest-hub",
            label: "Questionnaires",
            icon: "ClipboardList",
            items: [
              { id: "q-all", label: "My Quests", href: "/pages/quests" },
              { id: "q-new", label: "Create Quest", href: "/pages/quests/builder" },
              { id: "q-linking", label: "Product Linking", href: "/pages/quests/linking" },
              { id: "q-analytics", label: "Quest Analytics", href: "/pages/quests/analytics" },
            ],
          },
        ],
      },

      /* ---------------------------------------------- */
      /* 5) Orders & Bookings                           */
      /* ---------------------------------------------- */
      {
        id: "orders-bookings",
        label: "Orders & Bookings",
        groups: [
          {
            id: "orders",
            label: "Orders",
            icon: "Boxes",
            items: [
              { id: "o-all", label: "All Orders", href: "/pages/vendor/orders" },
            ],
          },
          {
            id: "bookings",
            label: "Bookings",
            icon: "CalendarDays",
            items: [
              { id: "b-all", label: "All Bookings", href: "/pages/vendor/bookings" },
            ],
          },
          {
            id: "customers",
            label: "Customers",
            icon: "Users",
            items: [
              { id: "c-all", label: "Customers", href: "/pages/vendor/customers" },
            ],
          },
        ],
      },

      /* ---------------------------------------------- */
      /* 4) Finance                                      */
      /* ---------------------------------------------- */
      {
        id: "finance",
        label: "Finance",
        groups: [
          {
            id: "payouts",
            label: "Earnings",
            icon: "PiggyBank",
            items: [
              {
                id: "f-overview",
                label: "Finance Overview",
                href: "/pages/vendor/finance",
              },
            ],
          },
        ],
      },
    ],
  };
}
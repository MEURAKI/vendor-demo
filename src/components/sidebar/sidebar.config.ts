import {
  BarChart3,
  CalendarDays,
  Package,
  Tag,
  ShoppingBasket,
  Users,
  PiggyBank,
  Boxes,
} from "lucide-react";

export const ICONS = {
  BarChart3,
  CalendarDays,
  Package,
  Tag,
  ShoppingBasket,
  Users,
  PiggyBank,
  Boxes,
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

/* Helper to get initials */
function getInitials(nameOrEmail?: string | null) {
  if (!nameOrEmail) return "U";
  const name = nameOrEmail.includes("@") ? nameOrEmail.split("@")[0] : nameOrEmail;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * ✅ buildSidebarConfig
 * Central builder for your sidebar data.
 * You can import this in any page to get the same sidebar sections.
 */
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
      role: role || "Vendor",
      status: status || "Active",
    },
    sections: [
      {
        id: "overview",
        label: "Overview",
        groups: [
          {
            id: "dashboard",
            label: "Dashboard",
            icon: "BarChart3",
            items: [{ id: "dash-home", label: "Home", href: "/pages/dashboard" }],
          },
          {
            id: "calendar",
            label: "Calendar",
            icon: "CalendarDays",
            items: [{ id: "cal-home", label: "View Calendar", href: "/pages/calendar" }],
          },
        ],
      },
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
              { id: "p-inv", label: "Inventory", href: "/pages/products/inventory" },
              { id: "p-bundles", label: "Bundles", href: "/pages/products/bundles" },
              { id: "p-cats", label: "Categories", href: "/pages/products/categories" },
            ],
          },
          {
            id: "services",
            label: "Services",
            icon: "ShoppingBasket",
            items: [
              { id: "s-all", label: "All Services", href: "/pages/services" },
              { id: "s-add", label: "Add Service", href: "/pages/services/new" },
              { id: "s-providers", label: "Wellness Providers", href: "/pages/services/providers" },
              { id: "s-spaces", label: "Wellness Spaces", href: "/pages/services/spaces" },
            ],
          },
          {
            id: "discounts",
            label: "Discounts",
            icon: "Tag",
            items: [
              { id: "d-store", label: "Store Discounts", href: "/pages/discounts/store" },
              { id: "d-item", label: "Item Discounts", href: "/pages/discounts/item" },
            ],
          },
        ],
      },
      {
        id: "orders-bookings",
        label: "Orders & Bookings",
        groups: [
          {
            id: "orders",
            label: "Orders",
            icon: "Boxes",
            items: [
              { id: "o-all", label: "All Orders", href: "/pages/orders" },
              { id: "o-pending", label: "Pending", href: "/pages/orders/pending" },
              { id: "o-delivery", label: "Delivery Orders", href: "/pages/orders/delivery" },
              { id: "o-pickup", label: "Pickup Orders", href: "/pages/orders/pickup" },
            ],
          },
          {
            id: "bookings",
            label: "Bookings",
            icon: "CalendarDays",
            items: [
              { id: "b-all", label: "All Bookings", href: "/pages/bookings" },
              { id: "b-upcoming", label: "Upcoming", href: "/pages/bookings/upcoming" },
              { id: "b-reschedules", label: "Reschedules", href: "/pages/bookings/reschedules" },
              { id: "b-cancelled", label: "Cancelled", href: "/pages/bookings/cancelled" },
            ],
          },
          {
            id: "customers",
            label: "Customers",
            icon: "Users",
            items: [{ id: "c-all", label: "Customers", href: "/pages/customers" }],
          },
        ],
      },
      {
        id: "finance",
        label: "Finance",
        groups: [
          {
            id: "income",
            label: "Income",
            icon: "PiggyBank",
            items: [
              { id: "i-trans", label: "Transactions", href: "/pages/income/transactions" },
              { id: "i-payouts", label: "Payouts", href: "/pages/income/payouts" },
              { id: "i-reports", label: "Reports", href: "/pages/income/reports" },
            ],
          },
        ],
      },
    ],
  };
}

// components/sidebar/sidebar-types.ts
import type { LucideIcon } from "lucide-react";

export type VendorStatus =
  | "incomplete_registration"
  | "under_review"
  | "agreement_pending"
  | "active"
  | "inactive"
  | "draft"
  | "suspended";

export type SidebarItem = {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  countBadge?: number | string;
  target?: "_blank";
};

export type SidebarSection = {
  id: string;
  label: string;
  items: SidebarItem[];
  /** Whether the section can expand/collapse to show its children */
  collapsible?: boolean;
  /** If undefined, uses persisted preference; otherwise forces the state */
  defaultOpen?: boolean;
};

export type SidebarConfig = {
  profile: {
    initials: string;
    name: string;
    role?: string;
    status?: VendorStatus;
  };
  sections: SidebarSection[];
};

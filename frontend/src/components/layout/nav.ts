import {
  History as ActivityIcon,
  LayoutDashboard,
  Radar,
  ScanSearch,
  Settings,
  Siren,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Mobile bottom nav is limited to Incidents, Investigate, Activity as specified in Section 9 */
  mobile: boolean;
  end?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Command Center", icon: LayoutDashboard, mobile: false, end: true },
  { to: "/incidents", label: "Incidents", icon: Siren, mobile: true },
  { to: "/investigate", label: "Investigate", icon: Radar, mobile: true },
  { to: "/activity", label: "Activity", icon: ActivityIcon, mobile: true },
  { to: "/settings", label: "Settings", icon: Settings, mobile: false },
  { to: "/inspector", label: "Codebase Scan", icon: ScanSearch, mobile: false },
];

export const MOBILE_NAV = NAV_ITEMS.filter((i) => i.mobile);

import {
  Activity,
  Radio,
  Radar,
  Server,
  Settings,
  Siren,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  mobile: boolean;
  end?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Live Command", icon: Radio, mobile: true, end: true },
  { to: "/incidents", label: "Incidents", icon: Siren, mobile: true },
  { to: "/investigate", label: "Investigate", icon: Radar, mobile: false },
  { to: "/services", label: "Services", icon: Server, mobile: true },
  { to: "/activity", label: "Activity", icon: Activity, mobile: true },
  { to: "/settings", label: "Settings", icon: Settings, mobile: false },
];

export const MOBILE_NAV: NavItem[] = [
  { to: "/incidents", label: "Incidents", icon: Siren, mobile: true },
  { to: "/", label: "Live", icon: Radio, mobile: true, end: true },
  { to: "/services", label: "Services", icon: Server, mobile: true },
  { to: "/activity", label: "Activity", icon: Activity, mobile: true },
];

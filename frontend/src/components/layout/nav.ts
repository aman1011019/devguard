import {
  Activity,
  Home,
  LayoutDashboard,
  Search,
  Layers,
  Settings,
  Bell,
  FolderGit2,
  FileText,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  mobile: boolean;
  end?: boolean;
  badge?: string | number;
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: Home, mobile: true, end: true },
  { to: "/dashboard", label: "Command Center", icon: LayoutDashboard, mobile: true },
  { to: "/incidents", label: "Incidents", icon: Bell, mobile: true, badge: 3 },
  { to: "/investigate", label: "Investigate", icon: Search, mobile: false },
  { to: "/services", label: "Services", icon: Layers, mobile: true },
  { to: "/repositories", label: "Repositories", icon: FolderGit2, mobile: false },
  { to: "/activity", label: "Activity", icon: Activity, mobile: true },
  { to: "/reports", label: "Reports", icon: FileText, mobile: false },
  { to: "/settings", label: "Settings", icon: Settings, mobile: false },
];

export const MOBILE_NAV: NavItem[] = [
  { to: "/", label: "Home", icon: Home, mobile: true, end: true },
  { to: "/dashboard", label: "Command", icon: LayoutDashboard, mobile: true },
  { to: "/incidents", label: "Incidents", icon: Bell, mobile: true, badge: 3 },
  { to: "/services", label: "Services", icon: Layers, mobile: true },
];

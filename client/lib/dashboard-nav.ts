import type { LucideIcon } from "lucide-react";
import { FolderGit2, Settings } from "lucide-react";

type DashboardNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

type DashboardNavGroup = {
  label: string;
  items: DashboardNavItem[];
};

export const dashboardNavGroups: DashboardNavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        title: "Repositories",
        href: "/dashboard",
        icon: FolderGit2,
        exact: true,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        title: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
      },
    ],
  },
];

export function isDashboardNavActive(
  pathname: string,
  href: string,
  exact = false,
) {
  return exact ? pathname === href : pathname.startsWith(href);
}

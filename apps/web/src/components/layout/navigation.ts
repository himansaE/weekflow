import { FolderKanban, LayoutDashboard, FileText, History, Users, UserRound } from 'lucide-react';
import { Role } from '@weekflow/shared';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Role-aware navigation (§9.1).
 *
 * This decides what is *shown*, never what is *allowed*. Every one of these
 * routes is enforced server-side; hiding a link is a convenience, and typing the
 * URL directly still meets the same guard.
 */
const MEMBER_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reports/current', label: 'My Weekly Report', icon: FileText },
  { href: '/reports/history', label: 'Report History', icon: History },
  { href: '/profile', label: 'My Profile', icon: UserRound },
];

const MANAGER_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/manager/reports', label: 'Reports', icon: FileText },
  { href: '/manager/projects', label: 'Projects', icon: FolderKanban },
  { href: '/manager/users', label: 'Users', icon: Users },
  { href: '/profile', label: 'My Profile', icon: UserRound },
];

export function navigationFor(role: Role): NavItem[] {
  return role === Role.MANAGER ? MANAGER_NAV : MEMBER_NAV;
}

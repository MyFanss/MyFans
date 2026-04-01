/**
 * Single source of truth for all app navigation.
 *
 * Role-specific items are clearly separated so creator and fan
 * paths never bleed into each other.
 */

export type NavRole = 'creator' | 'fan' | 'guest';

export interface NavItem {
  href: string;
  label: string;
  /** Lucide icon name — resolved in components to avoid bundle bloat */
  icon: string;
  /** Exact match only (default false = prefix match) */
  exact?: boolean;
  /** Roles that can see this item. Omit = visible to all. */
  roles?: NavRole[];
}

export interface NavGroup {
  label?: string; // section heading (sidebar only)
  items: NavItem[];
}

// ── Primary nav (shown to all authenticated users) ─────────────────────────

export const PRIMARY_NAV: NavItem[] = [
  { href: '/',             label: 'Home',          icon: 'Home',         exact: true },
  { href: '/discover',     label: 'Discover',      icon: 'Compass' },
  { href: '/subscriptions',label: 'Subscriptions', icon: 'Star',         roles: ['fan'] },
  { href: '/dashboard',    label: 'Dashboard',     icon: 'LayoutDashboard', roles: ['creator'] },
  { href: '/notifications',label: 'Notifications', icon: 'Bell' },
];

// ── Secondary nav (sidebar footer / overflow menu) ─────────────────────────

export const SECONDARY_NAV: NavItem[] = [
  { href: '/settings',     label: 'Settings',      icon: 'Settings' },
  { href: '/profile',      label: 'Profile',       icon: 'User' },
];

// ── Bottom nav (mobile — max 5 items) ─────────────────────────────────────
// Fan view

export const BOTTOM_NAV_FAN: NavItem[] = [
  { href: '/',             label: 'Home',          icon: 'Home',         exact: true },
  { href: '/discover',     label: 'Discover',      icon: 'Compass' },
  { href: '/subscriptions',label: 'My Plans',      icon: 'Star' },
  { href: '/notifications',label: 'Alerts',        icon: 'Bell' },
  { href: '/settings',     label: 'Settings',      icon: 'Settings' },
];

// Creator view
export const BOTTOM_NAV_CREATOR: NavItem[] = [
  { href: '/',             label: 'Home',          icon: 'Home',         exact: true },
  { href: '/dashboard',    label: 'Dashboard',     icon: 'LayoutDashboard' },
  { href: '/discover',     label: 'Discover',      icon: 'Compass' },
  { href: '/notifications',label: 'Alerts',        icon: 'Bell' },
  { href: '/settings',     label: 'Settings',      icon: 'Settings' },
];

// Guest / unauthenticated
export const BOTTOM_NAV_GUEST: NavItem[] = [
  { href: '/',             label: 'Home',          icon: 'Home',         exact: true },
  { href: '/discover',     label: 'Discover',      icon: 'Compass' },
  { href: '/notifications',label: 'Alerts',        icon: 'Bell' },
  { href: '/settings',     label: 'Settings',      icon: 'Settings' },
];

/** Resolve the correct bottom nav for a given role */
export function getBottomNav(role: NavRole): NavItem[] {
  if (role === 'creator') return BOTTOM_NAV_CREATOR;
  if (role === 'fan') return BOTTOM_NAV_FAN;
  return BOTTOM_NAV_GUEST;
}

/** Filter primary nav items by role */
export function getPrimaryNav(role: NavRole): NavItem[] {
  return PRIMARY_NAV.filter((item) => !item.roles || item.roles.includes(role));
}

/** Check if a pathname matches a nav item */
export function isNavActive(href: string, pathname: string, exact = false): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

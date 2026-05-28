/**
 * Unit tests for navigation config helpers.
 */

import {
  getPrimaryNav,
  getBottomNav,
  isNavActive,
  PRIMARY_NAV,
  SECONDARY_NAV,
  BOTTOM_NAV_FAN,
  BOTTOM_NAV_CREATOR,
  BOTTOM_NAV_GUEST,
  type NavRole,
} from '@/components/navigation/nav-config';

// ── isNavActive ────────────────────────────────────────────────────────────

describe('isNavActive', () => {
  it('exact match returns true when pathname equals href', () => {
    expect(isNavActive('/', '/', true)).toBe(true);
  });

  it('exact match returns false when pathname is a sub-path', () => {
    expect(isNavActive('/', '/dashboard', true)).toBe(false);
  });

  it('prefix match returns true for exact path', () => {
    expect(isNavActive('/dashboard', '/dashboard')).toBe(true);
  });

  it('prefix match returns true for sub-path', () => {
    expect(isNavActive('/dashboard', '/dashboard/earnings')).toBe(true);
  });

  it('prefix match returns false for unrelated path', () => {
    expect(isNavActive('/dashboard', '/settings')).toBe(false);
  });

  it('prefix match does not false-positive on partial segment', () => {
    // /dash should not match /dashboard
    expect(isNavActive('/dash', '/dashboard')).toBe(false);
  });
});

// ── getPrimaryNav ──────────────────────────────────────────────────────────

describe('getPrimaryNav', () => {
  it('returns items with no role restriction for all roles', () => {
    const roles: NavRole[] = ['creator', 'fan', 'guest'];
    for (const role of roles) {
      const items = getPrimaryNav(role);
      const homeItem = items.find((i) => i.href === '/');
      expect(homeItem).toBeDefined();
    }
  });

  it('includes dashboard for creator', () => {
    const items = getPrimaryNav('creator');
    expect(items.some((i) => i.href === '/dashboard')).toBe(true);
  });

  it('excludes dashboard for fan', () => {
    const items = getPrimaryNav('fan');
    expect(items.some((i) => i.href === '/dashboard')).toBe(false);
  });

  it('excludes dashboard for guest', () => {
    const items = getPrimaryNav('guest');
    expect(items.some((i) => i.href === '/dashboard')).toBe(false);
  });

  it('includes subscriptions for fan', () => {
    const items = getPrimaryNav('fan');
    expect(items.some((i) => i.href === '/subscriptions')).toBe(true);
  });

  it('excludes subscriptions for creator', () => {
    const items = getPrimaryNav('creator');
    expect(items.some((i) => i.href === '/subscriptions')).toBe(false);
  });

  it('includes notifications for all roles', () => {
    const roles: NavRole[] = ['creator', 'fan', 'guest'];
    for (const role of roles) {
      const items = getPrimaryNav(role);
      expect(items.some((i) => i.href === '/notifications')).toBe(true);
    }
  });
});

// ── getBottomNav ───────────────────────────────────────────────────────────

describe('getBottomNav', () => {
  it('returns fan bottom nav for fan role', () => {
    expect(getBottomNav('fan')).toBe(BOTTOM_NAV_FAN);
  });

  it('returns creator bottom nav for creator role', () => {
    expect(getBottomNav('creator')).toBe(BOTTOM_NAV_CREATOR);
  });

  it('returns guest bottom nav for guest role', () => {
    expect(getBottomNav('guest')).toBe(BOTTOM_NAV_GUEST);
  });

  it('fan bottom nav has 5 items or fewer (mobile constraint)', () => {
    expect(BOTTOM_NAV_FAN.length).toBeLessThanOrEqual(5);
  });

  it('creator bottom nav has 5 items or fewer', () => {
    expect(BOTTOM_NAV_CREATOR.length).toBeLessThanOrEqual(5);
  });

  it('all bottom nav items have href, label, and icon', () => {
    const allNavs = [BOTTOM_NAV_FAN, BOTTOM_NAV_CREATOR, BOTTOM_NAV_GUEST];
    for (const nav of allNavs) {
      for (const item of nav) {
        expect(item.href).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.icon).toBeTruthy();
      }
    }
  });
});

// ── PRIMARY_NAV structure ──────────────────────────────────────────────────

describe('PRIMARY_NAV', () => {
  it('has no duplicate hrefs', () => {
    const hrefs = PRIMARY_NAV.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('home item has exact=true', () => {
    const home = PRIMARY_NAV.find((i) => i.href === '/');
    expect(home?.exact).toBe(true);
  });

  it('all items have icon defined', () => {
    for (const item of PRIMARY_NAV) {
      expect(item.icon).toBeTruthy();
    }
  });
});

// ── SECONDARY_NAV structure ────────────────────────────────────────────────

describe('SECONDARY_NAV', () => {
  it('includes settings', () => {
    expect(SECONDARY_NAV.some((i) => i.href === '/settings')).toBe(true);
  });

  it('includes profile', () => {
    expect(SECONDARY_NAV.some((i) => i.href === '/profile')).toBe(true);
  });

  it('has no duplicate hrefs', () => {
    const hrefs = SECONDARY_NAV.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

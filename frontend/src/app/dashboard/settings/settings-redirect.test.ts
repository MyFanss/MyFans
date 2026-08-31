import { describe, it, expect, vi } from 'vitest';
import { redirect } from 'next/navigation';
import DashboardSettingsPage from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('DashboardSettingsPage', () => {
  it('redirects to /settings as the single source for settings', () => {
    DashboardSettingsPage();
    expect(redirect).toHaveBeenCalledWith('/settings');
  });
});

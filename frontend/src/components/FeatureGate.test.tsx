import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureGate } from '@/components/FeatureGate';
import { FeatureFlagsProvider } from '@/contexts/FeatureFlagsContext';
import { FeatureFlag, resetFeatureFlagsForTests } from '@/lib/feature-flags';

function renderWithFlags(ui: React.ReactNode) {
  return render(<FeatureFlagsProvider>{ui}</FeatureFlagsProvider>);
}

describe('FeatureGate', () => {
  beforeEach(() => {
    resetFeatureFlagsForTests();
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders children when the flag is enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_FLAG_BOOKMARKS', 'true');

    renderWithFlags(
      <FeatureGate flag={FeatureFlag.BOOKMARKS}>
        <span>Bookmarks enabled</span>
      </FeatureGate>,
    );

    await waitFor(() => {
      expect(screen.getByText('Bookmarks enabled')).toBeInTheDocument();
    });
  });

  it('renders nothing when the flag is disabled', async () => {
    renderWithFlags(
      <FeatureGate flag={FeatureFlag.BOOKMARKS}>
        <span>Bookmarks enabled</span>
      </FeatureGate>,
    );

    await waitFor(() => {
      expect(screen.queryByText('Bookmarks enabled')).not.toBeInTheDocument();
    });
  });

  it('renders the fallback when the flag is disabled and a fallback is provided', async () => {
    renderWithFlags(
      <FeatureGate flag={FeatureFlag.BOOKMARKS} fallback={<span>Bookmarks unavailable</span>}>
        <span>Bookmarks enabled</span>
      </FeatureGate>,
    );

    await waitFor(() => {
      expect(screen.getByText('Bookmarks unavailable')).toBeInTheDocument();
    });
  });
});

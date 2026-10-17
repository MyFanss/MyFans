import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';

const DEMO_PATHS = [
  '/wallet-demo',
  '/error-test',
  '/ui',
  '/subscribe-example',
  '/settings-demo',
  '/pending',
];

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

async function expectNotFound() {
  await waitFor(() => {
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });
}

describe('App demo/pending route gating', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('omits demo routes in production without VITE_ENABLE_DEMOS', async () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_ENABLE_DEMOS', '');

    for (const path of DEMO_PATHS) {
      const { unmount } = renderAt(path);
      await expectNotFound();
      unmount();
    }
  });

  it('renders the NotFound route for /wallet-demo in production', async () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_ENABLE_DEMOS', '');

    renderAt('/wallet-demo');
    await expectNotFound();
  });

  it('renders the NotFound route for /pending in production', async () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_ENABLE_DEMOS', '');

    renderAt('/pending');
    await expectNotFound();
  });

  it('renders demo routes in non-production mode', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITE_ENABLE_DEMOS', '');

    for (const path of DEMO_PATHS) {
      const { unmount } = renderAt(path);
      await waitFor(() => {
        expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
      });
      unmount();
    }
  });

  it('re-enables demo routes in production when VITE_ENABLE_DEMOS=true', async () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_ENABLE_DEMOS', 'true');

    for (const path of DEMO_PATHS) {
      const { unmount } = renderAt(path);
      await waitFor(() => {
        expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
      });
      unmount();
    }
  });
});

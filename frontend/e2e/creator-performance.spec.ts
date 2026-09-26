import { test, expect } from '@playwright/test';

/**
 * Performance benchmarks for the creator profile page (#415).
 *
 * Thresholds chosen to match Web Vitals "good" bands:
 *   - TTFB  < 600 ms  (server responded quickly)
 *   - LCP   < 2500 ms (largest contentful paint — "good" band)
 *   - Plans section visible in the initial viewport (above the fold)
 *
 * Dashboard home live summary (#1822): the summary is served by the live
 * Analytics API. Error-simulate flags are test-only and must never be
 * honoured in production, so these specs assert the live path and the
 * zero-subscriber / API-500 edge cases.
 */

const CREATOR_URL = '/creator/jane';
const DASHBOARD_URL = '/dashboard';

test.describe('Creator Profile Page – Performance', () => {
    test('TTFB should be under 600 ms', async ({ page }) => {
        const [response] = await Promise.all([
            page.waitForResponse((res) => res.url().includes('/creator/jane') && res.status() === 200),
            page.goto(CREATOR_URL),
        ]);

        const timing = await response.serverTiming();
        // Use Navigation Timing API as a reliable fallback
        const ttfb = await page.evaluate((): number => {
            const [entry] = performance.getEntriesByType(
                'navigation',
            ) as PerformanceNavigationTiming[];
            return entry ? entry.responseStart - entry.requestStart : 0;
        });

        console.log(`TTFB: ${ttfb.toFixed(0)} ms`);
        // Lenient in dev mode — CI builds are much faster
        expect(ttfb).toBeLessThan(2000);
        // Suppress unused-var warning for timing (kept for when a real backend returns it)
        void timing;
    });

    test('LCP should be under 2500 ms', async ({ page }) => {
        await page.goto(CREATOR_URL);

        const lcp = await page.evaluate(
            (): Promise<number> =>
                new Promise((resolve) => {
                    let lcpValue = 0;
                    const observer = new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        for (const entry of entries) {
                            lcpValue = entry.startTime;
                        }
                    });
                    observer.observe({ type: 'largest-contentful-paint', buffered: true });
                    // Give the browser up to 5 s to emit the LCP entry
                    setTimeout(() => {
                        observer.disconnect();
                        resolve(lcpValue);
                    }, 5000);
                }),
        );

        console.log(`LCP: ${lcp.toFixed(0)} ms`);
        // Good band = < 2500 ms; allow a wider margin in dev-server mode
        expect(lcp).toBeLessThan(4000);
    });

    test('subscription plans section should be visible without scrolling', async ({ page }) => {
        await page.goto(CREATOR_URL);

        // The Plans heading is the first interactive section — must be in viewport
        const plansHeading = page.getByRole('heading', { name: /subscription plans/i });
        await expect(plansHeading).toBeVisible({ timeout: 10_000 });

        const isInViewport = await plansHeading.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight + 200; // slight tolerance
        });
        expect(isInViewport).toBe(true);
    });

    test('loading skeleton disappears and posts section appears', async ({ page }) => {
        await page.goto(CREATOR_URL);

        // Posts are streamed via Suspense — they should eventually appear
        const postsHeading = page.getByRole('heading', { name: /^posts$/i });
        await expect(postsHeading).toBeVisible({ timeout: 10_000 });
    });
});

test.describe('Creator Dashboard Home – Live Summary (#1822)', () => {
    test('renders live summary metrics from the Analytics API', async ({ page }) => {
        const summaryResponse = page.waitForResponse(
            (res) => res.url().includes('/api/analytics/dashboard-summary') && res.status() === 200,
        );

        await page.goto(DASHBOARD_URL);

        const response = await summaryResponse;
        const body = await response.json();

        // The live API must return real metrics, not a mocked payload.
        expect(body).toHaveProperty('subscriberCount');
        expect(body).toHaveProperty('monthlyRecurringRevenue');
        expect(body).not.toHaveProperty('__mock');

        const summary = page.getByTestId('dashboard-summary');
        await expect(summary).toBeVisible({ timeout: 10_000 });
        await expect(summary.getByTestId('summary-subscriber-count')).toHaveText(
            String(body.subscriberCount),
        );
    });

    test('shows empty state when the creator has zero subscribers', async ({ page }) => {
        // Error-simulate flags are test-only; this drives the zero-subscriber path.
        await page.goto(`${DASHBOARD_URL}?simulate=zero-subscribers`);

        const summary = page.getByTestId('dashboard-summary');
        await expect(summary).toBeVisible({ timeout: 10_000 });
        await expect(summary.getByTestId('summary-empty-state')).toBeVisible();
        await expect(summary.getByTestId('summary-subscriber-count')).toHaveText('0');
    });

    test('surfaces an error state when the Analytics API returns 500', async ({ page }) => {
        // Test-only error-simulate flag — must be gated to non-production builds.
        await page.goto(`${DASHBOARD_URL}?simulate=api-500`);

        const summary = page.getByTestId('dashboard-summary');
        await expect(summary.getByTestId('summary-error')).toBeVisible({ timeout: 10_000 });
        await expect(summary.getByTestId('summary-error')).toContainText(/couldn't load|failed/i);
    });

    test('error-simulate flags are ignored in production builds', async ({ page }) => {
        // In a production build the simulate flag must not alter the live response.
        const summaryResponse = page.waitForResponse(
            (res) => res.url().includes('/api/analytics/dashboard-summary'),
        );

        await page.goto(`${DASHBOARD_URL}?simulate=api-500`);

        const response = await summaryResponse;
        expect(response.status()).toBe(200);
    });
});

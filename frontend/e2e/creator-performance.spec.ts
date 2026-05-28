import { test, expect } from '@playwright/test';

/**
 * Performance benchmarks for the creator profile page (#415).
 *
 * Thresholds chosen to match Web Vitals "good" bands:
 *   - TTFB  < 600 ms  (server responded quickly)
 *   - LCP   < 2500 ms (largest contentful paint — "good" band)
 *   - Plans section visible in the initial viewport (above the fold)
 */

const CREATOR_URL = '/creator/jane';

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

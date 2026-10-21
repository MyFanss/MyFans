// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

import main from './main';

describe('.storybook/main', () => {
  it('includes the expected stories glob', () => {
    expect(main.stories).toContain(
      '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    );
  });

  it('uses the @storybook/react-vite framework', () => {
    expect(main.framework).toBeDefined();
    expect((main.framework as { name: string }).name).toBe(
      '@storybook/react-vite',
    );
  });

  it('includes ../public in staticDirs', () => {
    expect(main.staticDirs).toContain('../public');
  });

  it('resolves the @ alias to the src directory', async () => {
    const expected = fileURLToPath(new URL('../src', import.meta.url));

    const config = await main.viteFinal!({ resolve: {} } as never, {} as never);

    expect(config.resolve?.alias?.['@']).toBe(expected);
    expect(String(config.resolve?.alias?.['@'])).toMatch(/src$/);
  });

  it('preserves pre-existing resolve.alias entries', async () => {
    const existing = { '@existing': '/some/path' };

    const config = await main.viteFinal!(
      { resolve: { alias: { ...existing } } } as never,
      {} as never,
    );

    expect(config.resolve?.alias?.['@existing']).toBe('/some/path');
    expect(config.resolve?.alias?.['@']).toBe(
      fileURLToPath(new URL('../src', import.meta.url)),
    );
  });
});

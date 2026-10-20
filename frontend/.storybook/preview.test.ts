// @vitest-environment node
import { describe, expect, it } from 'vitest';

import preview from './preview';

describe('.storybook/preview', () => {
  it('sets the default backgrounds value', () => {
    expect(preview.parameters?.backgrounds?.default).toBeDefined();
  });

  it('configures the color and date control matchers', () => {
    const matchers = preview.parameters?.controls?.matchers;

    expect(matchers?.color).toBeInstanceOf(RegExp);
    expect(matchers?.date).toBeInstanceOf(RegExp);
  });
});

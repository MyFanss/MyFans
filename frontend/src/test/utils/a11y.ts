import { axe, toHaveNoViolations } from 'axe-core';
import { render } from '@testing-library/react';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

/**
 * Test component for accessibility violations
 * @param ui - React component to test
 * @param options - Axe options
 */
export const testAccessibility = async (
  ui: React.ReactElement,
  options: {
    rules?: Record<string, { enabled: boolean }>;
    context?: any;
  } = {}
) => {
  const { container } = render(ui);

  const results = await axe(container, {
    rules: {
      // Disable rules that are not relevant for component testing
      'page-has-heading-one': { enabled: false },
      'landmark-one-main': { enabled: false },
      'region': { enabled: false },
      ...options.rules,
    },
    ...options.context,
  });

  expect(results).toHaveNoViolations();
};
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import React from 'react';

afterEach(() => {
  cleanup();
});

export const Link = ({ children, to }: any) => React.createElement('a', { href: to }, children);

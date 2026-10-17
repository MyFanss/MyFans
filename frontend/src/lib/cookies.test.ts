import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCookie } from './cookies';

describe('getCookie', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when document is undefined (SSR)', () => {
    vi.stubGlobal('document', undefined);

    expect(getCookie('session')).toBeNull();
  });

  it('returns the decoded value for a present cookie', () => {
    document.cookie = 'session=abc%20123; theme=dark';

    expect(getCookie('session')).toBe('abc 123');
  });

  it('returns null for an absent cookie', () => {
    document.cookie = 'session=abc%20123; theme=dark';

    expect(getCookie('missing')).toBeNull();
  });

  it('escapes regex metacharacters in the name', () => {
    document.cookie = 'a.b=dot; axb=other';

    expect(getCookie('a.b')).toBe('dot');
  });
});

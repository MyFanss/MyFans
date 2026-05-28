import { render } from '@testing-library/react';
import { NoFlashScript } from './NoFlashScript';

describe('NoFlashScript', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = '';
  });

  it('renders a script tag', () => {
    const { container } = render(<NoFlashScript />);
    const script = container.querySelector('script');
    expect(script).toBeInTheDocument();
  });

  it('has suppressHydrationWarning prop', () => {
    const { container } = render(<NoFlashScript />);
    const script = container.querySelector('script');
    expect(script).toHaveAttribute('suppressHydrationWarning');
  });

  it('contains theme preference logic', () => {
    const { container } = render(<NoFlashScript />);
    const script = container.querySelector('script');
    const content = script?.textContent || '';

    expect(content).toContain('myfans-theme-preference');
    expect(content).toContain('localStorage.getItem');
    expect(content).toContain('data-theme');
    expect(content).toContain('colorScheme');
  });

  it('handles system preference check', () => {
    const { container } = render(<NoFlashScript />);
    const script = container.querySelector('script');
    const content = script?.textContent || '';

    expect(content).toContain('prefers-color-scheme');
    expect(content).toContain('matchMedia');
  });

  it('has error handling for localStorage failures', () => {
    const { container } = render(<NoFlashScript />);
    const script = container.querySelector('script');
    const content = script?.textContent || '';

    expect(content).toContain('try');
    expect(content).toContain('catch');
  });

  it('sets both data-theme and colorScheme', () => {
    const { container } = render(<NoFlashScript />);
    const script = container.querySelector('script');
    const content = script?.textContent || '';

    // Count occurrences
    const dataThemeMatches = content.match(/data-theme/g) || [];
    const colorSchemeMatches = content.match(/colorScheme/g) || [];

    expect(dataThemeMatches.length).toBeGreaterThan(0);
    expect(colorSchemeMatches.length).toBeGreaterThan(0);
  });
});

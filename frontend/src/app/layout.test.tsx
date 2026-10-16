import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RootLayout, { metadata } from './layout';

vi.mock('@/context/UserContext', () => ({
  UserProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="user-provider">{children}</div>
  ),
}));

describe('RootLayout', () => {
  it('renders its children', () => {
    render(
      <RootLayout>
        <span data-testid="child" />
      </RootLayout>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('wraps children with UserProvider', () => {
    render(
      <RootLayout>
        <span data-testid="child" />
      </RootLayout>,
    );

    const provider = screen.getByTestId('user-provider');
    expect(provider).toBeInTheDocument();
    expect(provider).toContainElement(screen.getByTestId('child'));
  });

  it('sets the document language to en', () => {
    render(
      <RootLayout>
        <span data-testid="child" />
      </RootLayout>,
    );

    expect(document.documentElement).toHaveAttribute('lang', 'en');
  });

  it('exports the expected metadata', () => {
    expect(metadata.title).toBe('MyFans');
    expect(metadata.description).toBe(
      'Decentralized content subscription platform on Stellar',
    );
  });
});

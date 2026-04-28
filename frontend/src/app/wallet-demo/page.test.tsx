import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import WalletDemoPage from './page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));

// Mock the wallet demo component to avoid complex wallet context rendering in tests
vi.mock('@/components/wallet/WalletModalDemo', () => ({
  WalletModalDemo: () => <div data-testid="wallet-demo">Wallet Demo Component</div>,
}));

describe('WalletDemoPage', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the non-production banner and demo component in development', () => {
    // @ts-ignore
    process.env.NODE_ENV = 'development';
    
    render(<WalletDemoPage />);
    
    expect(screen.getByText(/NON-PRODUCTION DEMO:/i)).toBeInTheDocument();
    expect(screen.getByTestId('wallet-demo')).toBeInTheDocument();
  });

  it('calls notFound() in production', () => {
    // @ts-ignore
    process.env.NODE_ENV = 'production';
    
    expect(() => render(<WalletDemoPage />)).toThrow('NEXT_NOT_FOUND');
    
    // Restore
    // @ts-ignore
    process.env.NODE_ENV = originalEnv;
  });
});

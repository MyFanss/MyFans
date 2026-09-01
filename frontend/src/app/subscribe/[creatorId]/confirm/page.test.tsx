import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SubscribeConfirmPage from './page';

// Mock the creator-plans API
vi.mock('@/lib/creator-plans-api', () => ({
  getCreatorPlanById: vi.fn(),
}));

// Mock the SubscribeConfirmationFlow component to avoid complex setup
vi.mock('@/components/subscribe/SubscribeConfirmationFlow', () => ({
  default: ({ plan }: any) => (
    <div data-testid="flow">
      <div data-testid="plan-name">{plan.name}</div>
      <div data-testid="plan-price">{plan.price}</div>
      <div data-testid="plan-currency">{plan.currency}</div>
      <div data-testid="plan-interval">{plan.billingInterval}</div>
    </div>
  ),
}));

describe('SubscribeConfirmPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load and display the real plan from API instead of mock data', async () => {
    const { getCreatorPlanById } = await import('@/lib/creator-plans-api');

    const mockPlan = {
      id: 1,
      creator: 'GBCQ6C7OXWTKJ7APCIQPKK6X4CQBFGWJKW35GD7H5GMVVDANQCXLSV7',
      asset: 'USDC:GBUQWP3BOUZX34LOCALTOKEN2VNB4I45VI4YIPPV5J7U3QXK4KOTECGP3',
      amount: '25.50',
      intervalDays: 30,
      syncStatus: 'synced' as const,
    };

    (getCreatorPlanById as any).mockResolvedValue(mockPlan);

    const params = Promise.resolve({ creatorId: 'GBCQ6C7OXWTKJ7APCIQPKK6X4CQBFGWJKW35GD7H5GMVVDANQCXLSV7' });
    const searchParams = Promise.resolve({ planId: '1' });

    const result = await SubscribeConfirmPage({ params, searchParams });
    const { container } = render(result);

    // Verify the real plan data is displayed, not the mock "Premium Plan" with price "9.99"
    expect(screen.getByTestId('plan-price')).toHaveTextContent('25.50');
    expect(screen.getByTestId('plan-currency')).toHaveTextContent('USDC:GBUQWP3BOUZX34LOCALTOKEN2VNB4I45VI4YIPPV5J7U3QXK4KOTECGP3');
  });

  it('should still render with mock data when plan fetch fails', async () => {
    const { getCreatorPlanById } = await import('@/lib/creator-plans-api');

    (getCreatorPlanById as any).mockRejectedValue(new Error('API Error'));

    const params = Promise.resolve({ creatorId: 'GBCQ6C7OXWTKJ7APCIQPKK6X4CQBFGWJKW35GD7H5GMVVDANQCXLSV7' });
    const searchParams = Promise.resolve({ planId: '1' });

    const result = await SubscribeConfirmPage({ params, searchParams });

    // Should still render without crashing
    expect(result).toBeDefined();
  });
});

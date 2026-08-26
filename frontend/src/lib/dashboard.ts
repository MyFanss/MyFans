/**
 * Dashboard home types and data (API or mock).
 */

export interface DashboardMetrics {
  totalSubscribers: number;
  totalSubscribersChangePercent: number;
  mrr: number;
  mrrChangePercent: number;
  activeSubscriptions: number;
  activeSubscriptionsChangePercent: number;
}

export interface ActivityItem {
  id: string;
  type: 'subscription' | 'renewal' | 'cancellation' | 'content' | 'payout';
  title: string;
  description: string;
  timestamp: string; // ISO
  metadata?: string;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentActivity: ActivityItem[];
}

const MOCK_METRICS: DashboardMetrics = {
  totalSubscribers: 1247,
  totalSubscribersChangePercent: 12.4,
  mrr: 3840,
  mrrChangePercent: 8.2,
  activeSubscriptions: 892,
  activeSubscriptionsChangePercent: -2.1,
};

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: '1', type: 'subscription', title: 'New subscriber', description: '@alex_fan subscribed to Premium', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), metadata: '+$9.99' },
  { id: '2', type: 'renewal', title: 'Renewal', description: '@jordan_art renewed Monthly', timestamp: new Date(Date.now() - 1000 * 60 * 32).toISOString(), metadata: '$4.99' },
  { id: '3', type: 'content', title: 'Content published', description: 'New post: "Behind the scenes"', timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString() },
  { id: '4', type: 'cancellation', title: 'Subscription cancelled', description: '@sam_user cancelled Premium', timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
  { id: '5', type: 'payout', title: 'Payout sent', description: 'Weekly payout completed', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), metadata: '$420.00' },
];

/**
 * Fetch dashboard data from the real API.
 * Falls back to mock data if API is unavailable (for testing).
 * @param options.simulateError - if true, rejects to test error state (dev only)
 * @param options.useMock - if true, uses mock data instead of real API (test only)
 */
export async function fetchDashboardData(options?: {
  simulateError?: boolean;
  useMock?: boolean;
}): Promise<DashboardData> {
  // Test-only mock mode
  if (options?.useMock) {
    if (options?.simulateError) {
      await new Promise((_, reject) => setTimeout(() => reject(new Error('Failed to load dashboard')), 400));
    }
    await new Promise((r) => setTimeout(r, 100));
    return {
      metrics: MOCK_METRICS,
      recentActivity: MOCK_ACTIVITY,
    };
  }

  // Default: fetch from real API
  if (options?.simulateError) {
    await new Promise((_, reject) => setTimeout(() => reject(new Error('Failed to load dashboard')), 400));
  }

  try {
    const response = await fetch('/v1/subscriptions/dashboard/creator-summary', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Dashboard API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      metrics: {
        totalSubscribers: data.totalSubscribers ?? 0,
        totalSubscribersChangePercent: data.totalSubscribersChangePercent ?? 0,
        mrr: data.mrr ?? 0,
        mrrChangePercent: data.mrrChangePercent ?? 0,
        activeSubscriptions: data.activeSubscriptions ?? 0,
        activeSubscriptionsChangePercent: data.activeSubscriptionsChangePercent ?? 0,
      },
      recentActivity: (data.recentActivity ?? []).map((activity: any) => ({
        id: activity.id,
        type: activity.type,
        title: activity.title,
        description: activity.description,
        timestamp: activity.timestamp,
        metadata: activity.metadata,
      })),
    };
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    // Fail fast: don't fall back to mock - let the error bubble up
    throw error;
  }
}

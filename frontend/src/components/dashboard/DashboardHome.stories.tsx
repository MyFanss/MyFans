import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { DashboardHome } from './DashboardHome';
import type { DashboardData } from '@/lib/dashboard';

const meta: Meta<typeof DashboardHome> = {
  title: 'Dashboard/DashboardHome',
  component: DashboardHome,
  parameters: {
    // Prevent real network calls in Storybook/Chromatic
    mockData: [],
    chromatic: { viewports: [320, 768, 1024, 1440] },
  },
};
export default meta;
type Story = StoryObj<typeof DashboardHome>;

const mockData: DashboardData = {
  metrics: {
    totalSubscribers: 1247,
    totalSubscribersChangePercent: 12.4,
    mrr: 3840,
    mrrChangePercent: 8.2,
    activeSubscriptions: 892,
    activeSubscriptionsChangePercent: -2.1,
  },
  recentActivity: [
    { id: '1', type: 'subscription', title: 'New subscriber', description: '@alex_fan subscribed to Premium', timestamp: new Date('2026-04-23T14:00:00Z').toISOString(), metadata: '+$9.99' },
    { id: '2', type: 'renewal', title: 'Renewal', description: '@jordan_art renewed Monthly', timestamp: new Date('2026-04-23T13:00:00Z').toISOString(), metadata: '$4.99' },
    { id: '3', type: 'content', title: 'Content published', description: 'New post: "Behind the scenes"', timestamp: new Date('2026-04-23T12:00:00Z').toISOString() },
    { id: '4', type: 'cancellation', title: 'Subscription cancelled', description: '@sam_user cancelled Premium', timestamp: new Date('2026-04-23T11:00:00Z').toISOString() },
    { id: '5', type: 'payout', title: 'Payout sent', description: 'Weekly payout completed', timestamp: new Date('2026-04-23T10:00:00Z').toISOString(), metadata: '$420.00' },
  ],
};

export const Loaded: Story = {
  args: { 
    onCreatePlan: fn(), 
    onUploadContent: fn(),
    fetchDashboardData: () => Promise.resolve(mockData),
  },
};

export const Loading: Story = {
  args: { 
    onCreatePlan: fn(), 
    onUploadContent: fn(),
    fetchDashboardData: () => new Promise(() => {}),
  },
};

export const ErrorState: Story = {
  args: { 
    onCreatePlan: fn(), 
    onUploadContent: fn(),
    fetchDashboardData: () => Promise.reject(new Error('Network error')),
  },
};

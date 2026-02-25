'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { MetricCard } from '@/components/cards';
import { MetricCardSkeleton } from './MetricCardSkeleton';
import { ActivityFeed } from './ActivityFeed';
import { ActivityFeedSkeleton } from './ActivityFeedSkeleton';
import { QuickActions } from './QuickActions';
import { DashboardError } from './DashboardError';
import { fetchDashboardData, type DashboardData } from '@/lib/dashboard';

const PeopleIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
);
const CurrencyIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676 1.096C6.97 7.087 6.905 7.5 7 8c.095.5.03.913-.324 1.204C6.3 9.47 6 10.036 6 11v.5a1 1 0 002 0v-.5c0-.364.14-.704.382-.958.243-.254.418-.582.418-.958V8.5a1 1 0 002 0v-.5c0-.364.14-.704.382-.958.243-.254.418-.582.418-.958V7a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676 1.096C6.97 7.087 6.905 7.5 7 8c.095.5.03.913-.324 1.204C6.3 9.47 6 10.036 6 11v.5a1 1 0 002 0v-.5c0-.364.14-.704.382-.958.243-.254.418-.582.418-.958V8.5a1 1 0 002 0v-.5c0-.364.14-.704.382-.958.243-.254.418-.582.418-.958V7z" clipRule="evenodd" /></svg>
);
const SubscriptionIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
);
const PlanIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
);
const UploadIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
);

export interface DashboardHomeProps {
  onCreatePlan?: () => void;
  onUploadContent?: () => void;
}

export function DashboardHome({ onCreatePlan, onUploadContent }: DashboardHomeProps) {
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [data, setData] = useState<DashboardData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await fetchDashboardData();
      setData(result);
      setState('success');
    } catch (e) {
      setState('error');
      setErrorMessage(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state === 'error') {
    return (
      <div className="grid gap-6">
        <DashboardError message={errorMessage} onRetry={load} />
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="grid gap-4 sm:gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4" role="status" aria-label="Loading metrics">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 order-2 lg:order-1">
            <ActivityFeedSkeleton />
          </div>
          <div className="order-1 lg:order-2">
            <QuickActions
              actions={[
                { id: 'plan', label: 'Create plan', description: 'New subscription plan', onClick: onCreatePlan ?? (() => {}), icon: <PlanIcon /> },
                { id: 'upload', label: 'Upload content', description: 'Publish new content', onClick: onUploadContent ?? (() => {}), icon: <UploadIcon /> },
              ]}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { metrics, recentActivity } = data;

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <MetricCard
          title="Total subscribers"
          value={metrics.totalSubscribers}
          changePercent={metrics.totalSubscribersChangePercent}
          trend={metrics.totalSubscribersChangePercent >= 0 ? 'up' : 'down'}
          comparisonLabel="vs last month"
          icon={<PeopleIcon />}
        />
        <MetricCard
          title="MRR"
          value={metrics.mrr}
          valuePrefix="$"
          changePercent={metrics.mrrChangePercent}
          trend={metrics.mrrChangePercent >= 0 ? 'up' : 'down'}
          comparisonLabel="vs last month"
          icon={<CurrencyIcon />}
        />
        <MetricCard
          title="Active subscriptions"
          value={metrics.activeSubscriptions}
          changePercent={metrics.activeSubscriptionsChangePercent}
          trend={metrics.activeSubscriptionsChangePercent >= 0 ? 'up' : 'down'}
          comparisonLabel="vs last month"
          icon={<SubscriptionIcon />}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 order-2 lg:order-1">
          <ActivityFeed items={recentActivity} />
        </div>
        <div className="order-1 lg:order-2">
          <QuickActions
            actions={[
              { id: 'plan', label: 'Create plan', description: 'New subscription plan', onClick: onCreatePlan ?? (() => {}), icon: <PlanIcon /> },
              { id: 'upload', label: 'Upload content', description: 'Publish new content', onClick: onUploadContent ?? (() => {}), icon: <UploadIcon /> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

export default DashboardHome;

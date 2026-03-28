'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Wallet } from 'lucide-react';
import { BaseCard } from '@/components/cards';
import { PlanCard } from '@/components/cards/PlanCard';
import { SubscriptionPlanForm } from '@/components/plan';
import { useWallet } from '@/hooks/useWallet';
import {
  type PlanFormValues,
  type PlanInterval,
  type PlanTier,
  getIntervalDays,
  getTokenDisplayLabel,
  toAtomicPlanAmount,
} from '@/lib/plan-form';
import { createCreatorPlanOnSoroban } from '@/lib/stellar';
import { createAppError } from '@/types/errors';

interface CreatorDashboardPlan {
  id: string;
  name: string;
  description: string;
  tokenAddress: string;
  price: number;
  priceInput: string;
  interval: PlanInterval;
  tier: PlanTier;
  status: 'draft' | 'pending' | 'on-chain';
  createdAt: string;
  updatedAt: string;
  txHash?: string;
  planId?: number;
  creatorAddress?: string;
}

const STORAGE_KEY = 'myfans.creator-dashboard.plans';
const STATUS_ORDER: Record<CreatorDashboardPlan['status'], number> = {
  pending: 0,
  'on-chain': 1,
  draft: 2,
};

function isStoredPlan(value: unknown): value is CreatorDashboardPlan {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const plan = value as Partial<CreatorDashboardPlan>;

  return (
    typeof plan.id === 'string' &&
    typeof plan.name === 'string' &&
    typeof plan.description === 'string' &&
    typeof plan.tokenAddress === 'string' &&
    typeof plan.price === 'number' &&
    typeof plan.priceInput === 'string' &&
    (plan.interval === 'month' || plan.interval === 'year') &&
    (plan.tier === 'basic' || plan.tier === 'pro' || plan.tier === 'premium') &&
    (plan.status === 'draft' || plan.status === 'pending' || plan.status === 'on-chain') &&
    typeof plan.createdAt === 'string' &&
    typeof plan.updatedAt === 'string'
  );
}

function loadStoredPlans(): CreatorDashboardPlan[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isStoredPlan);
  } catch {
    return [];
  }
}

function persistPlans(plans: CreatorDashboardPlan[]) {
  if (typeof window === 'undefined') return;

  const stablePlans = plans.filter((plan) => plan.status !== 'pending');
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stablePlans));
}

function formatWalletAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusCopy(status: CreatorDashboardPlan['status']) {
  if (status === 'pending') {
    return {
      label: 'Pending confirmation',
      tone: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
      Icon: Clock3,
    };
  }

  if (status === 'on-chain') {
    return {
      label: 'Live on Soroban',
      tone: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200',
      Icon: CheckCircle2,
    };
  }

  return {
    label: 'Saved draft',
    tone: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200',
    Icon: AlertCircle,
  };
}

function createPlanRecord(
  values: PlanFormValues,
  overrides: Partial<CreatorDashboardPlan> = {},
): CreatorDashboardPlan {
  const now = new Date().toISOString();

  return {
    id: overrides.id ?? `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: values.name.trim(),
    description: values.description.trim(),
    tokenAddress: values.tokenAddress.trim(),
    price: Number(values.price),
    priceInput: values.price,
    interval: values.interval,
    tier: values.tier,
    status: overrides.status ?? 'draft',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    txHash: overrides.txHash,
    planId: overrides.planId,
    creatorAddress: overrides.creatorAddress,
  };
}

export default function PlansPage() {
  const { connectionState, isConnected, address, connect, disconnect } = useWallet();
  const [plans, setPlans] = useState<CreatorDashboardPlan[]>(() => loadStoredPlans());
  const plansRef = useRef<CreatorDashboardPlan[]>([]);

  useEffect(() => {
    plansRef.current = plans;
    persistPlans(plans);
  }, [plans]);

  const handleConnectWallet = useCallback(async () => {
    await connect('freighter');
  }, [connect]);

  const handleSaveDraft = useCallback(async (values: PlanFormValues) => {
    const draft = createPlanRecord(values, { status: 'draft' });

    setPlans((current) => [draft, ...current]);
  }, []);

  const handlePublish = useCallback(
    async (values: PlanFormValues) => {
      if (!isConnected || !address) {
        throw createAppError('WALLET_NOT_CONNECTED', {
          message: 'Connect a creator wallet first',
          description: 'A connected creator wallet is required to sign the Soroban create_plan transaction.',
        });
      }

      const previousPlans = plansRef.current;
      const optimisticPlan = createPlanRecord(values, {
        status: 'pending',
        creatorAddress: address,
      });

      setPlans((current) => [optimisticPlan, ...current]);

      try {
        const result = await createCreatorPlanOnSoroban({
          creatorAddress: address,
          tokenAddress: values.tokenAddress.trim(),
          amountAtomic: toAtomicPlanAmount(values.price),
          intervalDays: getIntervalDays(values.interval),
        });

        const confirmedPlan: CreatorDashboardPlan = {
          ...optimisticPlan,
          status: 'on-chain',
          updatedAt: new Date().toISOString(),
          txHash: result.txHash,
          planId: result.planId,
        };

        setPlans((current) =>
          current.map((plan) => (plan.id === optimisticPlan.id ? confirmedPlan : plan)),
        );

        return result;
      } catch (error) {
        setPlans(previousPlans);
        throw error;
      }
    },
    [address, isConnected],
  );

  const sortedPlans = [...plans].sort((left, right) => {
    const statusOrder = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (statusOrder !== 0) return statusOrder;

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });

  const livePlans = plans.filter((plan) => plan.status === 'on-chain').length;
  const pendingPlans = plans.filter((plan) => plan.status === 'pending').length;
  const draftPlans = plans.filter((plan) => plan.status === 'draft').length;

  return (
    <div className="max-w-full space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription Plans</h1>
        <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-400">
          Create token-priced plans for your fans, sign them with your creator wallet, and keep the dashboard in sync with pending and confirmed Soroban state.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <BaseCard padding="lg" as="section">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Creator Wallet
              </p>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Signing status</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Your connected creator wallet signs the contract invocation for each new plan.
              </p>
            </div>

            {isConnected && address ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
                  <Wallet className="h-4 w-4" />
                  {formatWalletAddress(address)}
                </div>
                <button
                  type="button"
                  onClick={disconnect}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleConnectWallet()}
                disabled={connectionState.status === 'connecting'}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:pointer-events-none disabled:opacity-50"
              >
                {connectionState.status === 'connecting' ? 'Connecting…' : 'Connect Freighter'}
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Live plans</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{livePlans}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Pending</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{pendingPlans}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Drafts</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{draftPlans}</p>
            </div>
          </div>

          {connectionState.status === 'error' && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {connectionState.error}
            </div>
          )}
        </BaseCard>

        <BaseCard padding="lg" as="section">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Publishing checklist</h2>
          <ul className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-primary-500" aria-hidden />
              Connect the same creator wallet that should own the new plan on-chain.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-primary-500" aria-hidden />
              Use a valid Soroban token contract and a positive plan price before publishing.
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-primary-500" aria-hidden />
              Pending plans appear immediately, but failed transactions roll back automatically.
            </li>
          </ul>
        </BaseCard>
      </div>

      <SubscriptionPlanForm onSave={handleSaveDraft} onPublish={handlePublish} />

      <section className="space-y-4" aria-labelledby="existing-plans-heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="existing-plans-heading" className="text-xl font-semibold text-gray-900 dark:text-white">
              Your plan pipeline
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Drafts stay local, pending plans show optimistic progress, and confirmed plans keep their transaction reference.
            </p>
          </div>
        </div>

        {sortedPlans.length === 0 ? (
          <BaseCard padding="lg" as="section">
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
              <p className="text-lg font-medium text-gray-900 dark:text-white">No plans yet</p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Save a draft or publish your first plan to start building your creator catalog.
              </p>
            </div>
          </BaseCard>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {sortedPlans.map((plan) => {
              const statusCopy = getStatusCopy(plan.status);
              const StatusIcon = statusCopy.Icon;

              return (
                <PlanCard
                  key={plan.id}
                  name={plan.name}
                  price={plan.price}
                  billingPeriod={plan.interval}
                  description={plan.description || undefined}
                  currencySymbol={`${getTokenDisplayLabel(plan.tokenAddress)} `}
                  isPopular={plan.tier === 'pro'}
                  badge={
                    plan.status === 'pending'
                      ? 'Pending'
                      : plan.status === 'on-chain'
                        ? 'On-chain'
                        : plan.tier === 'premium'
                          ? 'Draft Premium'
                          : 'Draft'
                  }
                  features={[
                    { text: `Token ${getTokenDisplayLabel(plan.tokenAddress)}`, included: true },
                    { text: `Interval ${getIntervalDays(plan.interval)} days`, included: true },
                    { text: `Tier ${plan.tier}`, included: true },
                  ]}
                  actionButton={
                    <div className="space-y-3">
                      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${statusCopy.tone}`}>
                        <StatusIcon className="h-4 w-4" />
                        <span>{statusCopy.label}</span>
                      </div>
                      <div className="rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                        <p>Updated {formatTimestamp(plan.updatedAt)}</p>
                        {plan.creatorAddress && <p className="mt-1">Creator {formatWalletAddress(plan.creatorAddress)}</p>}
                        {plan.txHash && (
                          <p className="mt-2 break-all font-mono text-xs text-gray-500 dark:text-gray-400">
                            {plan.txHash}
                          </p>
                        )}
                      </div>
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

'use client';

import React, { useState, useCallback } from 'react';
import { BaseCard } from '@/components/cards';
import { PlanCard } from '@/components/cards/PlanCard';
import { useToast } from '@/contexts/ToastContext';
import {
  DEFAULT_PLAN_TOKEN_ADDRESS,
  DEFAULT_PLAN_TOKEN_SYMBOL,
  PLAN_INTERVALS,
  PLAN_TIERS,
  type PlanFormValues,
  type PlanFormErrors,
  type PlanStatus,
  getTokenDisplayLabel,
  validatePlanForm,
} from '@/lib/plan-form';
import { SUPPORTED_ASSETS } from '@/lib/assets';

const defaultValues: PlanFormValues = {
  name: '',
  description: '',
  tokenAddress: DEFAULT_PLAN_TOKEN_ADDRESS,
  price: '',
  interval: 'month',
  tier: 'basic',
};

export interface PublishPlanResult {
  txHash?: string;
  planId?: number;
}

export interface SubscriptionPlanFormProps {
  initialStatus?: PlanStatus;
  onSave?: (values: PlanFormValues) => Promise<void>;
  onPublish?: (values: PlanFormValues) => Promise<PublishPlanResult | void>;
}

type SubmissionState = 'idle' | 'saving' | 'publishing' | 'success' | 'error';

function getSubmissionPanelStyles(state: SubmissionState) {
  if (state === 'error') {
    return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200';
  }

  if (state === 'success') {
    return 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200';
  }

  return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200';
}

export function SubscriptionPlanForm({
  initialStatus = 'draft',
  onSave,
  onPublish,
}: SubscriptionPlanFormProps) {
  const { showSuccess, showError, showLoading, dismiss } = useToast();
  const [values, setValues] = useState<PlanFormValues>(defaultValues);
  const [errors, setErrors] = useState<PlanFormErrors>({});
  const [status, setStatus] = useState<PlanStatus>(initialStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [lastTxHash, setLastTxHash] = useState<string>();

  const update = useCallback(
    (field: keyof PlanFormValues, value: string | PlanFormValues['interval'] | PlanFormValues['tier']) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      if (errors[field as keyof PlanFormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
      if (submissionState === 'error') {
        setSubmissionState('idle');
        setSubmissionMessage('');
      }
    },
    [errors, submissionState],
  );

  const validate = useCallback(() => {
    const next = validatePlanForm(values);
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [values]);

  const handleBlur = useCallback(
    (field: keyof PlanFormValues) => {
      setErrors((prev) => ({ ...prev, ...validatePlanForm(values), [field]: validatePlanForm(values)[field as keyof PlanFormErrors] }));
    },
    [values],
  );

  const handleSave = useCallback(async () => {
    if (isSubmitting) return;

    if (!validate()) {
      setSubmissionState('error');
      setSubmissionMessage('Fix the highlighted fields before saving this draft.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionState('saving');
    setSubmissionMessage('Saving your draft plan...');
    setLastTxHash(undefined);

    try {
      if (!onSave) {
        throw new Error('Draft saving is not configured for this form.');
      }

      await onSave(values);
      setStatus('draft');
      setSubmissionState('success');
      setSubmissionMessage('Draft saved. You can publish it when you are ready.');
      showSuccess('Draft saved', 'Your creator plan draft is ready for review.');
    } catch (err) {
      const description = err instanceof Error ? err.message : 'Please try again.';
      setSubmissionState('error');
      setSubmissionMessage(description);
      showError('SAVE_FAILED', {
        message: 'Could not save draft',
        description,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, onSave, showError, showSuccess, validate, values]);

  const handlePublish = useCallback(async () => {
    if (isSubmitting) return;

    if (!validate()) {
      setSubmissionState('error');
      setSubmissionMessage('Fix the highlighted fields before publishing on Soroban.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionState('publishing');
    setSubmissionMessage('Submitting your plan creation transaction to Soroban...');
    setLastTxHash(undefined);

    const loadingToast = showLoading('Preparing transaction', 'Open Freighter to review and approve the plan creation.');

    try {
      if (!onPublish) {
        throw new Error('Plan publishing is not configured for this form.');
      }

      const result = await onPublish(values);
      const txHash = result && typeof result === 'object' && 'txHash' in result ? result.txHash : undefined;
      dismiss(loadingToast);
      setStatus('on-chain');
      setSubmissionState('success');
      setSubmissionMessage('Plan created successfully on Soroban.');
      setLastTxHash(txHash);
      showSuccess('Plan published', 'Your subscription plan is now live on the Stellar network.');
    } catch (err) {
      dismiss(loadingToast);
      const description = err instanceof Error ? err.message : 'Please try again.';
      setSubmissionState('error');
      setSubmissionMessage(description);
      showError('PUBLISH_FAILED', {
        message: 'Could not publish plan',
        description,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [dismiss, isSubmitting, onPublish, showError, showLoading, showSuccess, validate, values]);

  const priceNum = values.price === '' ? 0 : Number(values.price);
  const isValidPrice = !errors.price && values.price !== '' && !Number.isNaN(priceNum) && priceNum > 0;
  const tokenLabel = getTokenDisplayLabel(values.tokenAddress || DEFAULT_PLAN_TOKEN_ADDRESS);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <BaseCard padding="lg" as="section" aria-labelledby="plan-form-heading">
        <h2 id="plan-form-heading" className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
          Create subscription plan
        </h2>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          Define a token-priced membership tier, validate it locally, then publish it with a creator-signed Soroban transaction.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handlePublish();
          }}
          className="space-y-5"
          noValidate
        >
          <div>
            <label htmlFor="plan-name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </label>
            <input
              id="plan-name"
              type="text"
              value={values.name}
              onChange={(e) => update('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              placeholder="e.g. Studio Pass"
              maxLength={61}
              className={`w-full rounded-lg border px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 ${
                errors.name ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'plan-name-error' : undefined}
            />
            {errors.name && (
              <p id="plan-name-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="plan-description" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              id="plan-description"
              value={values.description}
              onChange={(e) => update('description', e.target.value)}
              onBlur={() => handleBlur('description')}
              placeholder="What fans get when they subscribe to this tier."
              maxLength={501}
              rows={3}
              className={`w-full rounded-lg border px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 ${
                errors.description ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'plan-description-error' : 'plan-description-help'}
            />
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span id="plan-description-help">Optional, but helpful when fans compare plans.</span>
              <span>{values.description.length}/500</span>
            </div>
            {errors.description && (
              <p id="plan-description-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="plan-token-address" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Payment asset
              </label>
              {/* Known-asset quick-select */}
              <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Select a known asset">
                {SUPPORTED_ASSETS.filter((a) => a.contractId).map((asset) => (
                  <button
                    key={asset.contractId}
                    type="button"
                    onClick={() => update('tokenAddress', asset.contractId)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      values.tokenAddress === asset.contractId
                        ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-950/30 dark:text-primary-300'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                    aria-pressed={values.tokenAddress === asset.contractId}
                  >
                    {asset.symbol}
                    {asset.isStablecoin && (
                      <span className="ml-1 text-gray-400 dark:text-gray-500">(stablecoin)</span>
                    )}
                  </button>
                ))}
              </div>
              <input
                id="plan-token-address"
                type="text"
                value={values.tokenAddress}
                onChange={(e) => update('tokenAddress', e.target.value)}
                onBlur={() => handleBlur('tokenAddress')}
                placeholder="C... (or select above)"
                spellCheck={false}
                className={`w-full rounded-lg border px-3 py-2 font-mono text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 ${
                  errors.tokenAddress ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                aria-invalid={!!errors.tokenAddress}
                aria-describedby={errors.tokenAddress ? 'plan-token-address-error' : 'plan-token-address-help'}
              />
              <p id="plan-token-address-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Select a known asset above or paste any Soroban token contract address.
              </p>
              {errors.tokenAddress && (
                <p id="plan-token-address-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.tokenAddress}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="plan-price" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Price
              </label>
              <input
                id="plan-price"
                type="text"
                inputMode="decimal"
                value={values.price}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  if (nextValue === '' || /^\d*\.?\d{0,2}$/.test(nextValue)) {
                    update('price', nextValue);
                  }
                }}
                onBlur={() => handleBlur('price')}
                placeholder="0.00"
                className={`w-full rounded-lg border px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 ${
                  errors.price ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                aria-invalid={!!errors.price}
                aria-describedby={errors.price ? 'plan-price-error' : 'plan-price-help'}
              />
              <p id="plan-price-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Supports up to 2 decimal places for creator pricing.
              </p>
              {errors.price && (
                <p id="plan-price-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.price}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="plan-tier" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tier
              </label>
              <select
                id="plan-tier"
                value={values.tier}
                onChange={(e) => update('tier', e.target.value as PlanFormValues['tier'])}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {PLAN_TIERS.map((tier) => (
                  <option key={tier.value} value={tier.value}>
                    {tier.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Billing interval
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-describedby={errors.interval ? 'plan-interval-error' : 'plan-interval-help'}>
              {PLAN_INTERVALS.map((interval) => {
                const selected = values.interval === interval.value;

                return (
                  <label
                    key={interval.value}
                    className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                      selected
                        ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/30'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan-interval"
                      value={interval.value}
                      checked={selected}
                      onChange={() => update('interval', interval.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{interval.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Publishes as {interval.days} billing days on-chain</p>
                      </div>
                      <span
                        className={`h-4 w-4 rounded-full border ${
                          selected ? 'border-primary-600 bg-primary-600 dark:border-primary-400 dark:bg-primary-400' : 'border-gray-400'
                        }`}
                        aria-hidden
                      />
                    </div>
                  </label>
                );
              })}
            </div>
            <p id="plan-interval-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Choose the cadence fans will be charged for this plan.
            </p>
            {errors.interval && (
              <p id="plan-interval-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.interval}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                status === 'on-chain'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                  : status === 'published'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
              aria-live="polite"
            >
              {status === 'on-chain' && <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />}
              {status === 'draft' && 'Draft'}
              {status === 'published' && 'Published'}
              {status === 'on-chain' && 'On-chain'}
            </span>
          </div>

          {submissionState !== 'idle' && (
            <div
              className={`rounded-xl border p-4 text-sm ${getSubmissionPanelStyles(submissionState)}`}
              role={submissionState === 'error' ? 'alert' : 'status'}
              aria-live={submissionState === 'error' ? 'assertive' : 'polite'}
              aria-atomic="true"
            >
              <p className="font-medium">
                {submissionState === 'saving' && 'Saving draft'}
                {submissionState === 'publishing' && 'Publishing to Soroban'}
                {submissionState === 'success' && 'Latest result'}
                {submissionState === 'error' && 'Plan could not be published'}
              </p>
              <p className="mt-1">{submissionMessage}</p>
              {lastTxHash && (
                <p className="mt-2 break-all font-mono text-xs">
                  Transaction hash: {lastTxHash}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {isSubmitting && submissionState === 'saving' ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-700 disabled:pointer-events-none disabled:opacity-50"
            >
              {isSubmitting && submissionState === 'publishing' ? 'Publishing…' : 'Publish on Soroban'}
            </button>
          </div>
        </form>
      </BaseCard>

      <div className="lg:sticky lg:top-8">
        <p className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">Live preview</p>
        <PlanCard
          name={values.name.trim() || 'Plan name'}
          price={isValidPrice ? priceNum : 0}
          billingPeriod={values.interval}
          description={values.description.trim() || undefined}
          assetSymbol={tokenLabel}
          isPopular={values.tier === 'pro'}
          badge={
            status === 'on-chain'
              ? 'On-chain'
              : values.tier === 'premium'
                ? 'Premium'
                : values.tier === 'pro'
                  ? 'Most Popular'
                  : undefined
          }
          features={[
            {
              text: `Paid with ${values.tokenAddress.trim() ? tokenLabel : DEFAULT_PLAN_TOKEN_SYMBOL}`,
              included: true,
            },
            {
              text: `Bills every ${values.interval === 'month' ? '30' : '365'} days`,
              included: true,
            },
            {
              text: status === 'on-chain' ? 'Ready for fan checkout' : 'Awaiting creator publication',
              included: true,
            },
          ]}
        />
      </div>
    </div>
  );
}

export default SubscriptionPlanForm;

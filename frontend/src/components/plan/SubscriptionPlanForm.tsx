'use client';

import React, { useState, useCallback } from 'react';
import { BaseCard } from '@/components/cards';
import { PlanCard } from '@/components/cards/PlanCard';
import {
  validatePlanForm,
  getCurrencySymbol,
  PLAN_TIERS,
  CURRENCIES,
  type PlanFormValues,
  type PlanFormErrors,
  type PlanStatus,
} from '@/lib/plan-form';

const defaultValues: PlanFormValues = {
  name: '',
  description: '',
  price: '',
  currency: 'USD',
  interval: 'month',
  tier: 'basic',
};

export interface SubscriptionPlanFormProps {
  initialStatus?: PlanStatus;
  onSave?: (values: PlanFormValues) => Promise<void>;
  onPublish?: (values: PlanFormValues) => Promise<void>;
}

export function SubscriptionPlanForm({
  initialStatus = 'draft',
  onSave,
  onPublish,
}: SubscriptionPlanFormProps) {
  const [values, setValues] = useState<PlanFormValues>(defaultValues);
  const [errors, setErrors] = useState<PlanFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof PlanFormValues, boolean>>>({});
  const [status, setStatus] = useState<PlanStatus>(initialStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = useCallback((field: keyof PlanFormValues, value: string | PlanFormValues['interval'] | PlanFormValues['tier'] | PlanFormValues['currency']) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof PlanFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);

  const validate = useCallback(() => {
    const next = validatePlanForm(values);
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [values]);

  const handleBlur = useCallback((field: keyof PlanFormValues) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, ...validatePlanForm(values) }));
  }, [values]);

  const handleSave = useCallback(async () => {
    if (isSubmitting) return;
    setTouched({ name: true, description: true, price: true });
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await onSave?.(values);
      setStatus('draft');
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate, isSubmitting, onSave]);

  const handlePublish = useCallback(async () => {
    if (isSubmitting) return;
    setTouched({ name: true, description: true, price: true });
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await onPublish?.(values);
      setStatus('on-chain');
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate, isSubmitting, onPublish]);

  const priceNum = values.price === '' ? 0 : Number(values.price);
  const isValidPrice = !errors.price && values.price !== '' && !Number.isNaN(priceNum) && priceNum >= 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form */}
      <BaseCard padding="lg" as="section" aria-labelledby="plan-form-heading">
        <h2 id="plan-form-heading" className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Plan details
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handlePublish();
          }}
          className="space-y-4"
          noValidate
        >
          <div>
            <label htmlFor="plan-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              id="plan-name"
              type="text"
              value={values.name}
              onChange={(e) => update('name', e.target.value)}
              onBlur={() => handleBlur('name')}
              placeholder="e.g. Pro"
              maxLength={61}
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
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
            <label htmlFor="plan-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              id="plan-description"
              value={values.description}
              onChange={(e) => update('description', e.target.value)}
              onBlur={() => handleBlur('description')}
              placeholder="What's included in this plan?"
              maxLength={501}
              rows={3}
              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                errors.description ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'plan-description-error' : undefined}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {values.description.length}/500
            </p>
            {errors.description && (
              <p id="plan-description-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="plan-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Price
              </label>
              <input
                id="plan-price"
                type="text"
                inputMode="decimal"
                value={values.price}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) update('price', v);
                }}
                onBlur={() => handleBlur('price')}
                placeholder="0.00"
                className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ${
                  errors.price ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                aria-invalid={!!errors.price}
                aria-describedby={errors.price ? 'plan-price-error' : undefined}
              />
              {errors.price && (
                <p id="plan-price-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.price}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="plan-currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Currency
              </label>
              <select
                id="plan-currency"
                value={values.currency}
                onChange={(e) => update('currency', e.target.value as PlanFormValues['currency'])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Interval
            </label>
            <div className="flex gap-4">
              {(['month', 'year'] as const).map((interval) => (
                <label key={interval} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="plan-interval"
                    value={interval}
                    checked={values.interval === interval}
                    onChange={() => update('interval', interval)}
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{interval}ly</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="plan-tier" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tier
            </label>
            <select
              id="plan-tier"
              value={values.tier}
              onChange={(e) => update('tier', e.target.value as PlanFormValues['tier'])}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {PLAN_TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 pt-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                status === 'on-chain'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                  : status === 'published'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              aria-live="polite"
            >
              {status === 'on-chain' && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden />
              )}
              {status === 'draft' && 'Draft'}
              {status === 'published' && 'Published'}
              {status === 'on-chain' && 'On-chain'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {isSubmitting ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </form>
      </BaseCard>

      {/* Live preview */}
      <div className="lg:sticky lg:top-8">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Preview</p>
        <PlanCard
          name={values.name.trim() || 'Plan name'}
          price={isValidPrice ? priceNum : 0}
          billingPeriod={values.interval}
          description={values.description.trim() || undefined}
          currencySymbol={getCurrencySymbol(values.currency)}
          isPopular={values.tier === 'pro'}
          badge={values.tier === 'premium' ? 'Premium' : values.tier === 'pro' ? 'Most Popular' : undefined}
        />
      </div>
    </div>
  );
}

export default SubscriptionPlanForm;

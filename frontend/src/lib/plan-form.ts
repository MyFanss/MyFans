/**
 * Subscription plan form types and validation.
 */

import { StrKey } from '@stellar/stellar-sdk';

export type PlanInterval = 'month' | 'year';
export type PlanTier = 'basic' | 'pro' | 'premium';

export interface PlanFormValues {
  name: string;
  description: string;
  tokenAddress: string;
  price: string;
  interval: PlanInterval;
  tier: PlanTier;
}

export interface PlanFormErrors {
  name?: string;
  description?: string;
  tokenAddress?: string;
  price?: string;
  interval?: string;
}

export interface PlanIntervalOption {
  value: PlanInterval;
  label: string;
  days: number;
}

const PRICE_DECIMAL_PLACES = 2;
const PRICE_REGEX = new RegExp(`^\\d+(\\.\\d{1,${PRICE_DECIMAL_PLACES}})?$`);
const DEFAULT_PLAN_TOKEN_DECIMALS_FALLBACK = 7;

export const DEFAULT_PLAN_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_PLAN_TOKEN_CONTRACT_ID ??
  process.env.NEXT_PUBLIC_MYFANS_TOKEN_CONTRACT_ID ??
  '';

export const DEFAULT_PLAN_TOKEN_SYMBOL =
  process.env.NEXT_PUBLIC_PLAN_TOKEN_SYMBOL ??
  process.env.NEXT_PUBLIC_MYFANS_TOKEN_SYMBOL ??
  'TOKEN';

const parsedPlanTokenDecimals = Number.parseInt(
  process.env.NEXT_PUBLIC_PLAN_TOKEN_DECIMALS ?? `${DEFAULT_PLAN_TOKEN_DECIMALS_FALLBACK}`,
  10,
);

export const DEFAULT_PLAN_TOKEN_DECIMALS = Number.isFinite(parsedPlanTokenDecimals) && parsedPlanTokenDecimals >= 0
  ? parsedPlanTokenDecimals
  : DEFAULT_PLAN_TOKEN_DECIMALS_FALLBACK;

export const PLAN_INTERVALS: PlanIntervalOption[] = [
  { value: 'month', label: 'Monthly', days: 30 },
  { value: 'year', label: 'Yearly', days: 365 },
];

export const PLAN_TIERS: { value: PlanTier; label: string }[] = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
];

export type PlanStatus = 'draft' | 'published' | 'on-chain';

export function validateTokenAddress(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Token contract is required';
  if (!StrKey.isValidContract(trimmed)) {
    return 'Enter a valid Soroban contract address';
  }
  return undefined;
}

/** Validate price: positive number, max 2 decimal places. */
export function validatePrice(value: string): string | undefined {
  if (value === '') return 'Price is required';
  const normalized = value.trim();
  const n = Number(normalized);
  if (Number.isNaN(n)) return 'Enter a valid number';
  if (n <= 0) return 'Price must be greater than 0';
  if (!PRICE_REGEX.test(normalized)) return `Max ${PRICE_DECIMAL_PLACES} decimal places`;
  return undefined;
}

export function validateInterval(value: string): string | undefined {
  if (!PLAN_INTERVALS.some((interval) => interval.value === value)) {
    return 'Select a billing interval';
  }
  return undefined;
}

export function validatePlanForm(values: PlanFormValues): PlanFormErrors {
  const errors: PlanFormErrors = {};

  if (!values.name.trim()) errors.name = 'Name is required';
  if (values.name.length > 60) errors.name = 'Name must be 60 characters or less';
  if (values.description.length > 500) errors.description = 'Description must be 500 characters or less';

  const tokenError = validateTokenAddress(values.tokenAddress);
  if (tokenError) errors.tokenAddress = tokenError;

  const priceError = validatePrice(values.price);
  if (priceError) errors.price = priceError;

  const intervalError = validateInterval(values.interval);
  if (intervalError) errors.interval = intervalError;

  return errors;
}

export function getIntervalDays(interval: PlanInterval): number {
  return PLAN_INTERVALS.find((option) => option.value === interval)?.days ?? PLAN_INTERVALS[0].days;
}

export function getTokenDisplayLabel(tokenAddress: string): string {
  const trimmed = tokenAddress.trim();
  if (!trimmed) return DEFAULT_PLAN_TOKEN_SYMBOL;
  if (trimmed === DEFAULT_PLAN_TOKEN_ADDRESS && DEFAULT_PLAN_TOKEN_ADDRESS) {
    return DEFAULT_PLAN_TOKEN_SYMBOL;
  }

  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export function toAtomicPlanAmount(price: string, decimals: number = DEFAULT_PLAN_TOKEN_DECIMALS): string {
  const normalized = price.trim();
  const validationError = validatePrice(normalized);

  if (validationError) {
    throw new Error(validationError);
  }

  const [wholePart, fractionalPart = ''] = normalized.split('.');
  const paddedFraction = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
  const combined = `${wholePart}${paddedFraction}`.replace(/^0+(?=\d)/, '');

  return combined || '0';
}

/**
 * Subscription plan form types and validation.
 */

export type PlanInterval = 'month' | 'year';
export type PlanTier = 'basic' | 'pro' | 'premium';

export const CURRENCIES = [
  { value: 'USD', symbol: '$', label: 'USD' },
  { value: 'EUR', symbol: '€', label: 'EUR' },
  { value: 'GBP', symbol: '£', label: 'GBP' },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['value'];

export interface PlanFormValues {
  name: string;
  description: string;
  price: string;
  currency: CurrencyCode;
  interval: PlanInterval;
  tier: PlanTier;
}

export interface PlanFormErrors {
  name?: string;
  description?: string;
  price?: string;
}

const PRICE_DECIMAL_PLACES = 2;
const PRICE_REGEX = new RegExp(`^\\d+(\\.\\d{1,${PRICE_DECIMAL_PLACES}})?$`);

/** Validate price: positive number, max 2 decimal places. */
export function validatePrice(value: string): string | undefined {
  if (value === '') return 'Price is required';
  const n = Number(value);
  if (Number.isNaN(n)) return 'Enter a valid number';
  if (n < 0) return 'Price must be 0 or greater';
  if (!PRICE_REGEX.test(value)) return `Max ${PRICE_DECIMAL_PLACES} decimal places`;
  return undefined;
}

export function validatePlanForm(values: PlanFormValues): PlanFormErrors {
  const errors: PlanFormErrors = {};
  if (!values.name.trim()) errors.name = 'Name is required';
  if (values.name.length > 60) errors.name = 'Name must be 60 characters or less';
  if (values.description.length > 500) errors.description = 'Description must be 500 characters or less';
  const priceError = validatePrice(values.price);
  if (priceError) errors.price = priceError;
  return errors;
}

export function getCurrencySymbol(code: CurrencyCode): string {
  return CURRENCIES.find((c) => c.value === code)?.symbol ?? '$';
}

export const PLAN_TIERS: { value: PlanTier; label: string }[] = [
  { value: 'basic', label: 'Basic' },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
];

export type PlanStatus = 'draft' | 'published' | 'on-chain';

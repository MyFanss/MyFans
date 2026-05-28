'use client';

import React, { forwardRef } from 'react';
import { Select, type SelectOption } from './Select';

export const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
];

export interface CurrencySelectorProps extends Omit<React.ComponentProps<typeof Select>, 'options' | 'label'> {
  label?: string;
  options?: SelectOption[];
}

export const CurrencySelector = forwardRef<HTMLSelectElement, CurrencySelectorProps>(function CurrencySelector(
  { label = 'Currency', options = CURRENCY_OPTIONS, ...props },
  ref
) {
  return <Select ref={ref} label={label} options={options} {...props} />;
});

export default CurrencySelector;

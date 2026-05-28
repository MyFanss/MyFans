/**
 * Locale-ready formatting utilities for dates, currencies, and numbers
 * 
 * Provides consistent formatting across the application with proper
 * internationalization support and sensible fallbacks.
 */

// Default locale fallback
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_CURRENCY = 'USD';

/**
 * Get the user's locale from browser or use fallback
 */
export function getUserLocale(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  // Try to get locale from browser
  const browserLocale = navigator.language || (navigator as any).userLanguage;
  
  // Validate locale format (e.g., 'en-US', 'fr-FR')
  if (browserLocale && /^[a-z]{2}(-[A-Z]{2})?$/.test(browserLocale)) {
    return browserLocale;
  }

  return DEFAULT_LOCALE;
}

/**
 * Format currency with proper locale support
 * 
 * @param amount - The amount to format
 * @param currency - Currency code (ISO 4217, e.g., 'USD', 'EUR', 'GBP')
 * @param locale - Optional locale override
 * @param options - Additional Intl.NumberFormat options
 * 
 * @example
 * formatCurrency(1234.56, 'USD') // "$1,234.56"
 * formatCurrency(1234.56, 'EUR', 'fr-FR') // "1 234,56 €"
 * formatCurrency(1234.56, 'JPY') // "¥1,235" (no decimals for JPY)
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale?: string,
  options?: Intl.NumberFormatOptions
): string {
  const userLocale = locale || getUserLocale();

  try {
    return new Intl.NumberFormat(userLocale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      ...options,
    }).format(amount);
  } catch (error) {
    // Fallback if currency code is invalid
    console.warn(`Invalid currency code: ${currency}, falling back to ${DEFAULT_CURRENCY}`);
    return new Intl.NumberFormat(userLocale, {
      style: 'currency',
      currency: DEFAULT_CURRENCY,
      ...options,
    }).format(amount);
  }
}

/**
 * Format currency with compact notation for large numbers
 * 
 * @example
 * formatCurrencyCompact(1234) // "$1.2K"
 * formatCurrencyCompact(1234567) // "$1.2M"
 */
export function formatCurrencyCompact(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale?: string
): string {
  const userLocale = locale || getUserLocale();

  try {
    return new Intl.NumberFormat(userLocale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  } catch (error) {
    console.warn(`Invalid currency code: ${currency}, falling back to ${DEFAULT_CURRENCY}`);
    return new Intl.NumberFormat(userLocale, {
      style: 'currency',
      currency: DEFAULT_CURRENCY,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }
}

/**
 * Get currency symbol for a given currency code
 * 
 * @example
 * getCurrencySymbol('USD') // "$"
 * getCurrencySymbol('EUR') // "€"
 * getCurrencySymbol('GBP') // "£"
 */
export function getCurrencySymbol(currency: string, locale?: string): string {
  const userLocale = locale || getUserLocale();

  try {
    const formatted = new Intl.NumberFormat(userLocale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);

    // Extract symbol by removing digits and spaces
    return formatted.replace(/[\d\s]/g, '');
  } catch (error) {
    // Fallback to currency code
    return currency.toUpperCase();
  }
}

/**
 * Format date with locale support
 * 
 * @param date - Date to format (Date object, timestamp, or ISO string)
 * @param style - Predefined style or custom options
 * @param locale - Optional locale override
 * 
 * @example
 * formatDate(new Date(), 'short') // "1/15/24"
 * formatDate(new Date(), 'medium') // "Jan 15, 2024"
 * formatDate(new Date(), 'long') // "January 15, 2024"
 * formatDate(new Date(), 'full') // "Monday, January 15, 2024"
 */
export function formatDate(
  date: Date | string | number,
  style: 'short' | 'medium' | 'long' | 'full' | Intl.DateTimeFormatOptions = 'medium',
  locale?: string
): string {
  const userLocale = locale || getUserLocale();
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  // Check for invalid date
  if (isNaN(dateObj.getTime())) {
    console.warn('Invalid date provided to formatDate');
    return '';
  }

  const styleOptions: Record<string, Intl.DateTimeFormatOptions> = {
    short: { year: '2-digit', month: 'numeric', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
    full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  };

  const options = typeof style === 'string' ? styleOptions[style] : style;

  try {
    return new Intl.DateTimeFormat(userLocale, options).format(dateObj);
  } catch (error) {
    console.warn('Error formatting date, using fallback');
    return dateObj.toLocaleDateString(DEFAULT_LOCALE);
  }
}

/**
 * Format time with locale support
 * 
 * @example
 * formatTime(new Date()) // "2:30 PM"
 * formatTime(new Date(), true) // "14:30:45"
 */
export function formatTime(
  date: Date | string | number,
  use24Hour: boolean = false,
  locale?: string
): string {
  const userLocale = locale || getUserLocale();
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    console.warn('Invalid date provided to formatTime');
    return '';
  }

  try {
    return new Intl.DateTimeFormat(userLocale, {
      hour: 'numeric',
      minute: '2-digit',
      second: use24Hour ? '2-digit' : undefined,
      hour12: !use24Hour,
    }).format(dateObj);
  } catch (error) {
    console.warn('Error formatting time, using fallback');
    return dateObj.toLocaleTimeString(DEFAULT_LOCALE);
  }
}

/**
 * Format date and time together
 * 
 * @example
 * formatDateTime(new Date()) // "Jan 15, 2024, 2:30 PM"
 */
export function formatDateTime(
  date: Date | string | number,
  dateStyle: 'short' | 'medium' | 'long' = 'medium',
  use24Hour: boolean = false,
  locale?: string
): string {
  const userLocale = locale || getUserLocale();
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    console.warn('Invalid date provided to formatDateTime');
    return '';
  }

  const dateStyleOptions: Record<string, Intl.DateTimeFormatOptions> = {
    short: { year: '2-digit', month: 'numeric', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
  };

  try {
    return new Intl.DateTimeFormat(userLocale, {
      ...dateStyleOptions[dateStyle],
      hour: 'numeric',
      minute: '2-digit',
      hour12: !use24Hour,
    }).format(dateObj);
  } catch (error) {
    console.warn('Error formatting datetime, using fallback');
    return dateObj.toLocaleString(DEFAULT_LOCALE);
  }
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 * 
 * @example
 * formatRelativeTime(new Date(Date.now() - 3600000)) // "1 hour ago"
 * formatRelativeTime(new Date(Date.now() + 86400000)) // "in 1 day"
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale?: string
): string {
  const userLocale = locale || getUserLocale();
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    console.warn('Invalid date provided to formatRelativeTime');
    return '';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((dateObj.getTime() - now.getTime()) / 1000);
  const absDiff = Math.abs(diffInSeconds);

  // Define time units in seconds
  const units: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: 'year', seconds: 31536000 },
    { unit: 'month', seconds: 2592000 },
    { unit: 'week', seconds: 604800 },
    { unit: 'day', seconds: 86400 },
    { unit: 'hour', seconds: 3600 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 },
  ];

  // Find the appropriate unit
  for (const { unit, seconds } of units) {
    if (absDiff >= seconds) {
      const value = Math.floor(diffInSeconds / seconds);
      try {
        return new Intl.RelativeTimeFormat(userLocale, { numeric: 'auto' }).format(value, unit);
      } catch (error) {
        console.warn('Error formatting relative time, using fallback');
        return `${Math.abs(value)} ${unit}${Math.abs(value) !== 1 ? 's' : ''} ${value < 0 ? 'ago' : 'from now'}`;
      }
    }
  }

  return 'just now';
}

/**
 * Format number with locale support
 * 
 * @example
 * formatNumber(1234567.89) // "1,234,567.89"
 * formatNumber(1234567.89, { maximumFractionDigits: 0 }) // "1,234,568"
 */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: string
): string {
  const userLocale = locale || getUserLocale();

  try {
    return new Intl.NumberFormat(userLocale, options).format(value);
  } catch (error) {
    console.warn('Error formatting number, using fallback');
    return value.toLocaleString(DEFAULT_LOCALE);
  }
}

/**
 * Format number with compact notation (K, M, B)
 * 
 * @example
 * formatNumberCompact(1234) // "1.2K"
 * formatNumberCompact(1234567) // "1.2M"
 * formatNumberCompact(1234567890) // "1.2B"
 */
export function formatNumberCompact(
  value: number,
  locale?: string
): string {
  const userLocale = locale || getUserLocale();

  try {
    return new Intl.NumberFormat(userLocale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  } catch (error) {
    // Fallback for older browsers
    const absValue = Math.abs(value);
    if (absValue >= 1e9) {
      return `${(value / 1e9).toFixed(1)}B`;
    }
    if (absValue >= 1e6) {
      return `${(value / 1e6).toFixed(1)}M`;
    }
    if (absValue >= 1e3) {
      return `${(value / 1e3).toFixed(1)}K`;
    }
    return value.toString();
  }
}

/**
 * Format percentage with locale support
 * 
 * @example
 * formatPercentage(0.1234) // "12.3%"
 * formatPercentage(0.1234, { minimumFractionDigits: 2 }) // "12.34%"
 */
export function formatPercentage(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: string
): string {
  const userLocale = locale || getUserLocale();

  try {
    return new Intl.NumberFormat(userLocale, {
      style: 'percent',
      maximumFractionDigits: 1,
      ...options,
    }).format(value);
  } catch (error) {
    console.warn('Error formatting percentage, using fallback');
    return `${(value * 100).toFixed(1)}%`;
  }
}

/**
 * Format file size with appropriate units
 * 
 * @example
 * formatFileSize(1024) // "1.0 KB"
 * formatFileSize(1048576) // "1.0 MB"
 */
export function formatFileSize(
  bytes: number,
  locale?: string
): string {
  const userLocale = locale || getUserLocale();
  
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  try {
    const formatted = new Intl.NumberFormat(userLocale, {
      maximumFractionDigits: 1,
      minimumFractionDigits: i === 0 ? 0 : 1,
    }).format(value);
    return `${formatted} ${units[i]}`;
  } catch (error) {
    return `${value.toFixed(1)} ${units[i]}`;
  }
}

/**
 * Format duration in seconds to human-readable format
 * 
 * @example
 * formatDuration(90) // "1:30"
 * formatDuration(3665) // "1:01:05"
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format list of items with locale-appropriate separators
 * 
 * @example
 * formatList(['apples', 'oranges', 'bananas']) // "apples, oranges, and bananas"
 * formatList(['apples', 'oranges'], 'or') // "apples or oranges"
 */
export function formatList(
  items: string[],
  type: 'conjunction' | 'disjunction' = 'conjunction',
  locale?: string
): string {
  const userLocale = locale || getUserLocale();

  try {
    return new Intl.ListFormat(userLocale, { type }).format(items);
  } catch (error) {
    // Fallback for older browsers
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) {
      return items.join(type === 'disjunction' ? ' or ' : ' and ');
    }
    const last = items[items.length - 1];
    const rest = items.slice(0, -1);
    return `${rest.join(', ')}, ${type === 'disjunction' ? 'or' : 'and'} ${last}`;
  }
}

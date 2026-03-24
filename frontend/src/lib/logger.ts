/**
 * Secure logger with PII and secret redaction
 */

const SENSITIVE_KEYS = ['token', 'key', 'secret', 'password', 'auth', 'authorization', 'privateKey', 'seed', 'mnemonic'];
const ADDRESS_PATTERN = /G[A-Z0-9]{55}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function redactValue(key: string, value: unknown): unknown {
  if (typeof value === 'string') {
    // Redact auth tokens and keys
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      return value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : '[REDACTED]';
    }
    // Redact wallet addresses
    if (key.toLowerCase().includes('address') || key.toLowerCase().includes('wallet')) {
      return value.replace(ADDRESS_PATTERN, (addr) => `${addr.slice(0, 4)}...${addr.slice(-4)}`);
    }
    // Redact emails
    if (key.toLowerCase().includes('email')) {
      return value.replace(EMAIL_PATTERN, (email) => {
        const [local, domain] = email.split('@');
        return `${local.slice(0, 2)}***@${domain}`;
      });
    }
  }
  return value;
}

function redactObject(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item));
  }
  
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    redacted[key] = typeof value === 'object' ? redactObject(value) : redactValue(key, value);
  }
  return redacted;
}

export const logger = {
  info: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[INFO] ${message}`, data ? redactObject(data) : '');
    }
  },
  
  error: (message: string, error?: unknown) => {
    const redacted = error instanceof Error 
      ? { message: error.message, name: error.name }
      : redactObject(error);
    console.error(`[ERROR] ${message}`, redacted);
  },
  
  warn: (message: string, data?: unknown) => {
    console.warn(`[WARN] ${message}`, data ? redactObject(data) : '');
  }
};

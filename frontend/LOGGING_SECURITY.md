# Logging Security - Issue #232

## Implementation

Added secure logging utility with automatic PII and secret redaction.

### Redacted Data

**Secrets:**
- Tokens (auth, bearer, API keys)
- Private keys
- Passwords
- Seeds/mnemonics

**PII:**
- Email addresses (shows first 2 chars + domain)
- Wallet addresses (shows first 4 + last 4 chars)

### Usage

```typescript
import { logger } from '@/lib/logger';

// Safe logging - automatically redacts sensitive data
logger.info('User connected', { 
  address: 'GBRP...', 
  email: 'user@example.com' 
});

logger.error('Auth failed', { token: 'abc123' });
```

### Files Modified

- `src/lib/logger.ts` - Secure logger utility
- `src/lib/__tests__/logger.test.ts` - Redaction tests

### Testing

Run tests: `npm test logger.test.ts`

All sensitive fields are redacted before logging.

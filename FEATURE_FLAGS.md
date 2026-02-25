# Feature Flags Implementation

Feature flags allow toggling new flows on/off without redeployment.

## Backend

### Configuration

Add to `.env`:
```env
FEATURE_NEW_SUBSCRIPTION_FLOW=false
FEATURE_CRYPTO_PAYMENTS=false
```

### Usage in Controllers

```typescript
import { UseGuards } from '@nestjs/common';
import { FeatureFlagGuard } from './feature-flags/feature-flag.guard';
import { RequireFeatureFlag } from './feature-flags/feature-flag.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  @Post('new-flow')
  @UseGuards(FeatureFlagGuard)
  @RequireFeatureFlag('newSubscriptionFlow')
  createWithNewFlow() {
    return { message: 'New subscription flow' };
  }
}
```

### API Endpoint

Get all feature flags:
```
GET /feature-flags
```

Response:
```json
{
  "newSubscriptionFlow": false,
  "cryptoPayments": false
}
```

## Frontend

### Configuration

Add to `.env.local`:
```env
NEXT_PUBLIC_FEATURE_NEW_SUBSCRIPTION_FLOW=false
NEXT_PUBLIC_FEATURE_CRYPTO_PAYMENTS=false
```

### Usage with Component

```tsx
import { FeatureFlag } from '@/components/FeatureFlag';

export default function Page() {
  return (
    <div>
      {/* Always visible */}
      <OldFlow />

      {/* Only visible when flag is enabled */}
      <FeatureFlag feature="newSubscriptionFlow">
        <NewFlow />
      </FeatureFlag>

      {/* With fallback */}
      <FeatureFlag
        feature="cryptoPayments"
        fallback={<p>Coming soon!</p>}
      >
        <CryptoPayment />
      </FeatureFlag>
    </div>
  );
}
```

### Usage with Hook

```tsx
import { isFeatureEnabled } from '@/lib/featureFlags';

export default function Page() {
  const showNewFlow = isFeatureEnabled('newSubscriptionFlow');

  return (
    <div>
      {showNewFlow && <NewFlow />}
    </div>
  );
}
```

## Available Flags

| Flag | Description | Default |
|------|-------------|---------|
| `newSubscriptionFlow` | Enhanced subscription flow with improved UX | `false` |
| `cryptoPayments` | Stellar/XLM cryptocurrency payments | `false` |

## Toggling Flags

### Development
Update `.env` or `.env.local` and restart the server.

### Production
Update environment variables in your hosting platform:
- Vercel: Project Settings → Environment Variables
- Railway: Project → Variables
- Docker: Update docker-compose.yml or runtime env

No redeployment needed - just restart the service.

## Testing

### Backend Tests
```bash
cd backend
npm test feature-flags
```

### Manual Testing

1. Set flag to `false`:
   ```bash
   export FEATURE_NEW_SUBSCRIPTION_FLOW=false
   ```

2. Try accessing protected endpoint:
   ```bash
   curl -X POST http://localhost:3000/subscriptions/new-flow
   # Returns: 403 Forbidden
   ```

3. Set flag to `true`:
   ```bash
   export FEATURE_NEW_SUBSCRIPTION_FLOW=true
   ```

4. Try again:
   ```bash
   curl -X POST http://localhost:3000/subscriptions/new-flow
   # Returns: 200 OK
   ```

## Best Practices

1. **Default to safe**: New features should default to `false`
2. **Document flags**: Update this README when adding new flags
3. **Clean up**: Remove flags after full rollout
4. **Test both states**: Test with flag on and off
5. **Monitor**: Log flag usage for analytics

## Adding New Flags

### Backend

1. Add env var to `.env.example`:
   ```env
   FEATURE_MY_NEW_FEATURE=false
   ```

2. Add method to `FeatureFlagsService`:
   ```typescript
   isMyNewFeatureEnabled(): boolean {
     return process.env.FEATURE_MY_NEW_FEATURE === 'true';
   }
   ```

3. Update `getAllFlags()`:
   ```typescript
   getAllFlags() {
     return {
       // ...existing flags
       myNewFeature: this.isMyNewFeatureEnabled(),
     };
   }
   ```

4. Add case to `FeatureFlagGuard`:
   ```typescript
   case 'myNewFeature':
     return this.featureFlagsService.isMyNewFeatureEnabled();
   ```

### Frontend

1. Add env var to `.env.example`:
   ```env
   NEXT_PUBLIC_FEATURE_MY_NEW_FEATURE=false
   ```

2. Add to `featureFlags` object:
   ```typescript
   export const featureFlags = {
     // ...existing flags
     myNewFeature: process.env.NEXT_PUBLIC_FEATURE_MY_NEW_FEATURE === 'true',
   };
   ```

3. Use in components:
   ```tsx
   <FeatureFlag feature="myNewFeature">
     <MyNewFeature />
   </FeatureFlag>
   ```

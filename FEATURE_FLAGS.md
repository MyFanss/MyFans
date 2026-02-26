# Feature Flags

Toggle new flows on/off without redeployment.

## Backend

Add to `.env`:
```env
FEATURE_NEW_SUBSCRIPTION_FLOW=false
FEATURE_CRYPTO_PAYMENTS=false
```

Usage:
```typescript
@Post('new-flow')
@UseGuards(FeatureFlagGuard)
@RequireFeatureFlag('newSubscriptionFlow')
createWithNewFlow() {
  return { message: 'New flow' };
}
```

## Frontend

Add to `.env.local`:
```env
NEXT_PUBLIC_FEATURE_NEW_SUBSCRIPTION_FLOW=false
NEXT_PUBLIC_FEATURE_CRYPTO_PAYMENTS=false
```

Usage:
```tsx
<FeatureFlag feature="newSubscriptionFlow">
  <NewFlow />
</FeatureFlag>
```

## Toggle

Update env vars and restart - no deploy needed.

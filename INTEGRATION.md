# MyFans Integration Guide

## Architecture Flow

```
Fan → Frontend → Wallet (Freighter) → Soroban Contract → Stellar Network
                    ↓
                 Backend → Database → Content Access
```

## Key Integration Points

### 1. Wallet Connection (Frontend)

```typescript
import { connectWallet, signTransaction } from '@/lib/wallet';
import { buildSubscriptionTx, submitTransaction } from '@/lib/stellar';

// Connect wallet
const address = await connectWallet();

// Subscribe to creator
const xdr = await buildSubscriptionTx(address, creatorAddress, planId, tokenAddress);
const signedXdr = await signTransaction(xdr);
const txHash = await submitTransaction(signedXdr);
```

### 2. Subscription Check (Backend)

```typescript
import { StellarService } from './common/stellar.service';

// Check if user has active subscription
const isActive = await stellarService.isSubscriber(fanAddress, creatorAddress);

// Gate content access
if (!isActive) {
  throw new UnauthorizedException('Active subscription required');
}
```

### 3. Contract Events (Backend Indexer)

Listen to Soroban events for real-time updates:

```typescript
// Subscribe to contract events
server.getEvents({
  contractIds: [subscriptionContractId],
  startLedger: lastProcessedLedger,
}).then(events => {
  events.forEach(event => {
    if (event.topic.includes('subscribed')) {
      // Update database
      // Send notification
    }
  });
});
```

## API Endpoints

### Backend REST API

```
POST   /api/subscriptions/checkout     - Create checkout session
GET    /api/subscriptions/checkout/:id - Get checkout details
POST   /api/subscriptions/confirm      - Confirm subscription
GET    /api/subscriptions              - List user subscriptions
GET    /api/content/:id                - Get content (gated)
POST   /api/creators/plans             - Create subscription plan
```

## Contract Functions

### Subscription Contract

```rust
// Create plan
create_plan(creator, asset, amount, interval_days) -> plan_id

// Subscribe
subscribe(fan, plan_id, token)

// Check subscription
is_subscriber(fan, creator) -> bool

// Cancel
cancel(fan, creator)

// Extend
extend_subscription(fan, creator, extra_ledgers, token)
```

## Data Models

### Subscription (On-chain)
- fan: Address
- plan_id: u32
- expiry: u64

### Plan (On-chain)
- creator: Address
- asset: Address
- amount: i128
- interval_days: u32

### Checkout (Backend)
- id: string
- fanAddress: string
- creatorAddress: string
- planId: number
- status: pending | completed | failed
- txHash?: string

## Error Handling

All errors use standardized AppError format:

```typescript
{
  code: 'WALLET_NOT_FOUND' | 'TX_REJECTED' | 'INSUFFICIENT_BALANCE',
  message: string,
  description?: string,
  severity: 'error' | 'warning' | 'info'
}
```

## Testing

### Contract Tests
```bash
cd contract
cargo test
```

### Backend Tests
```bash
cd backend
npm run test
npm run test:e2e
```

### Frontend Tests
```bash
cd frontend
npm run test
```

## Monitoring

Track key metrics:
- Subscription creations
- Failed transactions
- Active subscriptions
- Revenue by creator
- Platform fees collected

## Security

- All transactions require wallet signature
- Backend validates subscription status on-chain
- No private keys stored
- Rate limiting on API endpoints
- Input validation on all endpoints

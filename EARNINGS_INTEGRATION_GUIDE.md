# Earnings Feature - Integration Guide

## Quick Start

### 1. Backend Setup

#### Step 1: Add Earnings Module to App Module
Already done in `myfans-backend/src/app.module.ts`

#### Step 2: Run Database Migration
```bash
cd myfans-backend

# Generate migration
npm run typeorm migration:generate -- -n AddWithdrawalEntity

# Run migration
npm run typeorm migration:run
```

#### Step 3: Verify Backend Endpoints
```bash
# Start backend
npm run start

# Test endpoints
curl http://localhost:3001/earnings/summary?days=30
curl http://localhost:3001/earnings/fees
```

### 2. Frontend Setup

#### Step 1: Verify Components
All components are in `frontend/src/components/earnings/`

#### Step 2: Verify Page
Main page is at `frontend/src/app/earnings/page.tsx`

#### Step 3: Configure API URL
In `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

#### Step 4: Start Frontend
```bash
cd frontend
npm run dev
```

#### Step 5: Access Earnings Page
Navigate to `http://localhost:3000/earnings`

## File Checklist

### Backend Files
- ✅ `myfans-backend/src/earnings/dto/earnings-summary.dto.ts`
- ✅ `myfans-backend/src/earnings/entities/withdrawal.entity.ts`
- ✅ `myfans-backend/src/earnings/earnings.service.ts`
- ✅ `myfans-backend/src/earnings/earnings.controller.ts`
- ✅ `myfans-backend/src/earnings/earnings.module.ts`
- ✅ `myfans-backend/src/app.module.ts` (updated)

### Frontend Files
- ✅ `frontend/src/app/earnings/page.tsx`
- ✅ `frontend/src/components/earnings/EarningsSummary.tsx`
- ✅ `frontend/src/components/earnings/EarningsChart.tsx`
- ✅ `frontend/src/components/earnings/EarningsBreakdown.tsx`
- ✅ `frontend/src/components/earnings/TransactionHistory.tsx`
- ✅ `frontend/src/components/earnings/WithdrawalUI.tsx`
- ✅ `frontend/src/components/earnings/FeeTransparency.tsx`
- ✅ `frontend/src/components/earnings/index.ts`
- ✅ `frontend/src/lib/earnings-api.ts`
- ✅ `frontend/src/lib/earnings-errors.ts`

### Documentation Files
- ✅ `MyFans/EARNINGS_FEATURE.md`
- ✅ `MyFans/EARNINGS_IMPLEMENTATION_SUMMARY.md`
- ✅ `MyFans/EARNINGS_INTEGRATION_GUIDE.md`

## API Endpoints Reference

### Get Earnings Summary
```bash
GET /earnings/summary?days=30

Response:
{
  "total_earnings": "1000.000000",
  "total_earnings_usd": 1000,
  "pending_amount": "100.000000",
  "available_for_withdrawal": "900.000000",
  "currency": "USD",
  "period_start": "2024-01-20T00:00:00.000Z",
  "period_end": "2024-02-20T00:00:00.000Z"
}
```

### Get Earnings Breakdown
```bash
GET /earnings/breakdown?days=30

Response:
{
  "by_time": [
    {
      "date": "2024-02-20",
      "amount": "50.000000",
      "currency": "USD",
      "count": 5
    }
  ],
  "by_plan": [
    {
      "plan_id": "plan-1",
      "plan_name": "Basic",
      "total_amount": "600.000000",
      "currency": "USD",
      "subscriber_count": 30
    }
  ],
  "by_asset": [
    {
      "asset": "USD",
      "total_amount": "1000.000000",
      "percentage": 100
    }
  ]
}
```

### Get Transaction History
```bash
GET /earnings/transactions?limit=50&offset=0

Response:
[
  {
    "id": "tx-123",
    "date": "2024-02-20T10:30:00.000Z",
    "type": "subscription",
    "description": "subscription from subscriber",
    "amount": "9.99",
    "currency": "USD",
    "status": "completed",
    "reference_id": "ref-123",
    "tx_hash": "hash-123"
  }
]
```

### Request Withdrawal
```bash
POST /earnings/withdraw

Request:
{
  "amount": "500.000000",
  "currency": "USD",
  "destination_address": "GXXXXXX...",
  "method": "wallet"
}

Response:
{
  "id": "withdrawal-123",
  "amount": "500.000000",
  "currency": "USD",
  "status": "pending",
  "created_at": "2024-02-20T10:30:00.000Z",
  "destination_address": "GXXXXXX...",
  "fee": "11.00",
  "net_amount": "489.00"
}
```

### Get Fee Transparency
```bash
GET /earnings/fees

Response:
{
  "protocol_fee_bps": 500,
  "protocol_fee_percentage": 5,
  "withdrawal_fee_fixed": "1.00",
  "withdrawal_fee_percentage": 2,
  "example_earnings": "100.00",
  "example_protocol_fee": "5.00",
  "example_net_earnings": "95.00",
  "example_withdrawal_fee": "2.90",
  "example_final_amount": "92.10"
}
```

## Component Usage Examples

### Using EarningsSummaryCard
```tsx
import { EarningsSummaryCard } from '@/components/earnings';

export function MyComponent() {
  return <EarningsSummaryCard days={30} />;
}
```

### Using WithdrawalUI
```tsx
import { WithdrawalUI } from '@/components/earnings';

export function MyComponent() {
  return (
    <WithdrawalUI
      availableBalance="500.000000"
      currency="USD"
    />
  );
}
```

### Using EarningsChart
```tsx
import { EarningsChart } from '@/components/earnings';

export function MyComponent() {
  return <EarningsChart />;
}
```

## Environment Variables

### Backend (.env)
```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=myfans
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Testing the Feature

### Manual Testing Checklist

#### Backend
- [ ] Start backend: `npm run start`
- [ ] Test GET /earnings/summary
- [ ] Test GET /earnings/breakdown
- [ ] Test GET /earnings/transactions
- [ ] Test GET /earnings/withdrawals
- [ ] Test POST /earnings/withdraw with valid data
- [ ] Test POST /earnings/withdraw with invalid data
- [ ] Test GET /earnings/fees
- [ ] Verify auth guard on all endpoints

#### Frontend
- [ ] Start frontend: `npm run dev`
- [ ] Navigate to /earnings
- [ ] Verify summary cards load
- [ ] Verify chart renders
- [ ] Test period selector (7d, 30d, 90d)
- [ ] Test breakdown tabs
- [ ] Test transaction pagination
- [ ] Test withdrawal form validation
- [ ] Test withdrawal submission
- [ ] Verify error messages
- [ ] Test dark mode toggle
- [ ] Test responsive design on mobile

### API Testing with cURL

```bash
# Get summary
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/earnings/summary?days=30

# Get breakdown
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/earnings/breakdown?days=30

# Request withdrawal
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "100.000000",
    "currency": "USD",
    "destination_address": "GXXXXXX...",
    "method": "wallet"
  }' \
  http://localhost:3001/earnings/withdraw
```

## Troubleshooting

### Backend Issues

**Issue**: Earnings module not found
- **Solution**: Verify import in `app.module.ts`

**Issue**: Database migration fails
- **Solution**: Check database connection and run migrations

**Issue**: 401 Unauthorized on endpoints
- **Solution**: Verify auth token is included in request

### Frontend Issues

**Issue**: Components not rendering
- **Solution**: Check console for errors, verify API URL

**Issue**: API calls failing
- **Solution**: Verify backend is running, check CORS settings

**Issue**: Form validation not working
- **Solution**: Check Input/Select component props

## Performance Optimization

### Backend
1. Add caching for earnings summary (5 min TTL)
2. Index queries on (user_id, created_at)
3. Paginate large result sets
4. Use database connection pooling

### Frontend
1. Lazy load components
2. Memoize expensive calculations
3. Use React Query for caching
4. Debounce API calls

## Security Checklist

- [ ] All endpoints require authentication
- [ ] Users can only access their own data
- [ ] Input validation on all fields
- [ ] SQL injection prevention via ORM
- [ ] Rate limiting on withdrawal requests
- [ ] Audit logging for withdrawals
- [ ] HTTPS in production
- [ ] CORS properly configured

## Deployment

### Pre-deployment
1. Run all tests
2. Security review
3. Performance testing
4. Database backup
5. Rollback plan

### Deployment Steps
1. Deploy backend
2. Run database migrations
3. Deploy frontend
4. Verify endpoints
5. Monitor logs

### Post-deployment
1. Verify all features work
2. Check error logs
3. Monitor performance
4. Gather user feedback

## Support & Debugging

### Enable Debug Logging
```typescript
// In earnings.service.ts
console.log('Fetching earnings for creator:', creatorId);
```

### Check Database
```sql
-- View withdrawals
SELECT * FROM withdrawals WHERE user_id = 'user-id';

-- View payments
SELECT * FROM payments WHERE creator_id = 'creator-id';
```

### Monitor API
```bash
# Watch API logs
tail -f logs/api.log

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/earnings/summary
```

## Next Steps

1. ✅ Complete implementation
2. ⏳ Run database migrations
3. ⏳ Configure environment variables
4. ⏳ Test all endpoints
5. ⏳ Test all components
6. ⏳ Security review
7. ⏳ Performance testing
8. ⏳ Deploy to staging
9. ⏳ User acceptance testing
10. ⏳ Deploy to production

---

**Status**: Ready for integration and testing

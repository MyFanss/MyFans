# Earnings Page Feature - Complete Implementation

## Overview

The earnings page provides creators with comprehensive financial insights and withdrawal management. It includes total earnings tracking, multi-currency support, breakdown analytics, transaction history, withdrawal UI, and transparent fee information.

## Architecture

### Backend (NestJS)

#### Modules & Services

**EarningsModule** (`src/earnings/`)
- `earnings.service.ts` - Core business logic
- `earnings.controller.ts` - API endpoints
- `earnings.module.ts` - Module configuration

**Entities**
- `Withdrawal` - Withdrawal request tracking with status, fees, and transaction hash

**DTOs**
- `EarningsSummaryDto` - Total earnings, pending, available balance
- `EarningsBreakdownDto` - Breakdown by time, plan, asset
- `TransactionHistoryDto` - Individual transaction records
- `WithdrawalRequestDto` - Withdrawal request payload
- `WithdrawalDto` - Withdrawal response
- `FeeTransparencyDto` - Fee structure and examples

#### API Endpoints

```
GET  /earnings/summary?days=30        - Get earnings summary
GET  /earnings/breakdown?days=30      - Get earnings breakdown
GET  /earnings/transactions           - Get transaction history
GET  /earnings/withdrawals            - Get withdrawal history
POST /earnings/withdraw               - Request withdrawal
GET  /earnings/fees                   - Get fee transparency info
```

#### Key Features

1. **Earnings Summary**
   - Total earnings with USD conversion
   - Pending amount tracking
   - Available balance calculation
   - Period information

2. **Breakdown Analytics**
   - By time (daily aggregation)
   - By plan (subscription plan analysis)
   - By asset (multi-currency breakdown)

3. **Transaction History**
   - Paginated transaction list
   - Status tracking (completed, pending, failed)
   - Transaction types (subscription, post_purchase, tip, withdrawal, fee)

4. **Withdrawal Management**
   - Request withdrawal with validation
   - Support for wallet and bank transfers
   - Automatic fee calculation
   - Withdrawal history tracking

5. **Fee Transparency**
   - Protocol fee: 500 bps (5%)
   - Withdrawal fee: $1.00 + 2%
   - Example calculations
   - Clear breakdown

### Frontend (Next.js)

#### Components

**EarningsSummaryCard** (`components/earnings/EarningsSummary.tsx`)
- Displays total earnings, pending, and available balance
- Shows USD conversion
- Period information

**EarningsChart** (`components/earnings/EarningsChart.tsx`)
- Bar chart visualization
- Time range selection (7d, 30d, 90d)
- Dark mode support
- Accessible table fallback

**EarningsBreakdownCard** (`components/earnings/EarningsBreakdown.tsx`)
- Tabbed interface (time, plan, asset)
- Sortable tables
- Responsive design

**TransactionHistoryCard** (`components/earnings/TransactionHistory.tsx`)
- Transaction list with status indicators
- Type icons
- Pagination
- Responsive layout

**WithdrawalUI** (`components/earnings/WithdrawalUI.tsx`)
- Withdrawal form with validation
- Method selection (wallet/bank)
- Address input with validation
- Withdrawal history display
- Error handling

**FeeTransparencyCard** (`components/earnings/FeeTransparency.tsx`)
- Fee structure display
- Example calculation
- Clear breakdown
- Educational content

#### Pages

**Earnings Page** (`app/earnings/page.tsx`)
- Main earnings dashboard
- Period selector (7, 30, 90 days)
- Error boundary
- Responsive layout
- Footer with resources

#### Utilities

**earnings-api.ts** (`lib/earnings-api.ts`)
- API client functions
- Type definitions
- Error handling
- Request/response mapping

**earnings-errors.ts** (`lib/earnings-errors.ts`)
- Error handling utilities
- Error message mapping
- Custom error class

## Data Flow

### Earnings Summary Flow
```
User visits /earnings
  ↓
Page loads with 30-day default
  ↓
EarningsSummaryCard fetches /earnings/summary?days=30
  ↓
Backend queries Payment table (COMPLETED status)
  ↓
Calculates total, pending, available balance
  ↓
Returns EarningsSummaryDto
  ↓
Component displays summary cards
```

### Withdrawal Flow
```
User fills withdrawal form
  ↓
Form validation (amount, address, method)
  ↓
User submits
  ↓
POST /earnings/withdraw
  ↓
Backend validates balance
  ↓
Calculates fees
  ↓
Creates Withdrawal record (PENDING status)
  ↓
Returns WithdrawalDto
  ↓
Component shows success/error
  ↓
Withdrawal history updates
```

## Database Schema

### Withdrawal Entity
```sql
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(18,6) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL,
  method VARCHAR(10) NOT NULL,
  destination_address VARCHAR NOT NULL,
  fee DECIMAL(18,6) NOT NULL,
  net_amount DECIMAL(18,6) NOT NULL,
  tx_hash VARCHAR NULLABLE,
  error_message TEXT NULLABLE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP NULLABLE
);

CREATE INDEX idx_withdrawals_user_id_created_at ON withdrawals(user_id, created_at);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);
```

## Fee Calculation

### Protocol Fee
- Applied to each subscription payment
- 500 basis points (5%)
- Deducted before creator receives payment

### Withdrawal Fee
- Fixed: $1.00
- Percentage: 2% of withdrawal amount
- Total: $1.00 + (amount × 0.02)

### Example
```
Earnings: $100.00
Protocol Fee (5%): -$5.00
Net Earnings: $95.00

Withdrawal Request: $95.00
Withdrawal Fee: $1.00 + ($95.00 × 0.02) = $2.90
Final Amount: $92.10
```

## Error Handling

### Backend Errors
- `BadRequestException` - Invalid input (insufficient balance, invalid amount)
- `NotFoundException` - Resource not found
- `UnauthorizedException` - Authentication required

### Frontend Errors
- Network errors with retry logic
- Validation errors with field-level feedback
- User-friendly error messages
- Error recovery suggestions

### Error Types
- `INSUFFICIENT_BALANCE` - Not enough balance to withdraw
- `INVALID_ADDRESS` - Invalid wallet/bank address
- `NETWORK_ERROR` - Connection issues
- `WITHDRAWAL_FAILED` - Withdrawal processing failed
- `INVALID_AMOUNT` - Invalid amount format
- `API_ERROR` - Server communication error

## Validation Rules

### Withdrawal Amount
- Must be greater than 0
- Must not exceed available balance
- Must be a valid number
- Precision: up to 6 decimal places

### Withdrawal Address
- Wallet: Must start with 'G' and be 56 characters (Stellar)
- Bank: Required but format flexible
- Must not be empty

### Withdrawal Method
- Must be 'wallet' or 'bank'
- Determines address validation rules

## Multi-Currency Support

### Supported Currencies
- USD (default)
- EUR
- GBP
- XLM (Stellar native)
- USDC (Stellar asset)

### Conversion Rates (Mock)
```
USD: 1.0
EUR: 1.1
GBP: 1.27
XLM: 0.12
USDC: 1.0
```

## Testing Checklist

### Backend
- [ ] GET /earnings/summary returns correct totals
- [ ] GET /earnings/breakdown groups data correctly
- [ ] GET /earnings/transactions paginates properly
- [ ] POST /earnings/withdraw validates input
- [ ] POST /earnings/withdraw calculates fees correctly
- [ ] GET /earnings/fees returns correct structure
- [ ] Unauthorized requests return 401
- [ ] Invalid input returns 400

### Frontend
- [ ] Earnings page loads without errors
- [ ] Period selector updates data
- [ ] Summary cards display correctly
- [ ] Chart renders with data
- [ ] Breakdown tabs switch content
- [ ] Transaction history paginates
- [ ] Withdrawal form validates input
- [ ] Withdrawal success shows confirmation
- [ ] Error messages display properly
- [ ] Dark mode works correctly
- [ ] Mobile responsive layout
- [ ] Accessibility features work

## Performance Considerations

1. **Caching**
   - Cache earnings summary (5 min TTL)
   - Cache fee transparency (1 hour TTL)
   - Invalidate on withdrawal

2. **Database Queries**
   - Index on (user_id, created_at) for payments
   - Index on (user_id, created_at) for withdrawals
   - Index on status for withdrawal queries

3. **Frontend Optimization**
   - Lazy load components
   - Memoize expensive calculations
   - Debounce API calls
   - Use React Query for caching

## Security Considerations

1. **Authentication**
   - All endpoints require auth guard
   - Verify user owns the earnings data

2. **Authorization**
   - Users can only access their own earnings
   - Creators can only withdraw to their addresses

3. **Validation**
   - Server-side validation for all inputs
   - Prevent SQL injection via ORM
   - Sanitize error messages

4. **Withdrawal Security**
   - Verify destination address format
   - Rate limit withdrawal requests
   - Log all withdrawal attempts
   - Require confirmation for large amounts

## Future Enhancements

1. **Advanced Analytics**
   - Cohort analysis
   - Churn prediction
   - Revenue forecasting
   - Subscriber lifetime value

2. **Withdrawal Options**
   - Scheduled withdrawals
   - Automatic payouts
   - Multi-signature approval
   - Escrow for disputes

3. **Tax Features**
   - Tax report generation
   - 1099 forms
   - Quarterly summaries
   - Expense tracking

4. **Integrations**
   - Stripe Connect
   - PayPal integration
   - Bank transfer APIs
   - Accounting software

5. **Notifications**
   - Email on withdrawal
   - SMS alerts for large earnings
   - In-app notifications
   - Webhook events

## Deployment

### Environment Variables
```
NEXT_PUBLIC_API_URL=http://localhost:3001
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=myfans
REDIS_URL=redis://localhost:6379
```

### Database Migration
```bash
npm run typeorm migration:generate -- -n AddWithdrawalEntity
npm run typeorm migration:run
```

### Build & Deploy
```bash
# Backend
npm run build
npm run start

# Frontend
npm run build
npm run start
```

## Support & Documentation

- API Documentation: `/api/docs`
- Component Storybook: `npm run storybook`
- Database Schema: `docs/schema.md`
- Error Codes: `docs/errors.md`

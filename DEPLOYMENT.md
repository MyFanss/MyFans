# MyFans Deployment Guide

## Quick Start

### 1. Contract Deployment

```bash
cd contract

# Build all contracts
cargo build --release --target wasm32-unknown-unknown

# Deploy subscription contract
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/subscription.wasm \
  --network testnet \
  --source <YOUR_SECRET_KEY>

# Initialize contract
soroban contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  --source <YOUR_SECRET_KEY> \
  -- init \
  --admin <ADMIN_ADDRESS> \
  --fee_bps 500 \
  --fee_recipient <FEE_ADDRESS> \
  --token <TOKEN_ADDRESS> \
  --price 1000000
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your contract IDs and database credentials

# Run database migrations (if using TypeORM migrations)
npm run migration:run

# Start development server
npm run start:dev
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Add Stellar SDK
npm install @stellar/stellar-sdk

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your contract IDs

# Start development server
npm run dev
```

## Environment Variables

### Backend (.env)
- `SUBSCRIPTION_CONTRACT_ID`: Deployed subscription contract address
- `STELLAR_NETWORK`: testnet or public
- `DB_*`: PostgreSQL connection details

### Frontend (.env.local)
- `NEXT_PUBLIC_SUBSCRIPTION_CONTRACT_ID`: Same as backend
- `NEXT_PUBLIC_STELLAR_NETWORK`: testnet or public
- `NEXT_PUBLIC_API_URL`: Backend API URL

## Testing Flow

1. Install Freighter wallet extension
2. Fund testnet account: https://laboratory.stellar.org/#account-creator
3. Connect wallet in frontend
4. Create a subscription plan (creator)
5. Subscribe to a plan (fan)
6. Verify subscription status

## Production Checklist

- [ ] Deploy contracts to mainnet
- [ ] Update all contract IDs in env files
- [ ] Set strong JWT_SECRET
- [ ] Configure production database
- [ ] Set up SSL/TLS
- [ ] Enable CORS properly
- [ ] Set up monitoring and logging
- [ ] Audit smart contracts
- [ ] Test with real XLM/USDC

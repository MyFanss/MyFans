# MyFans Quick Start Guide

## Prerequisites

- Node.js 18+ and npm
- Rust and Cargo
- Stellar CLI (`cargo install soroban-cli`)
- PostgreSQL
- Freighter Wallet browser extension

## Installation

### Option 1: Automated Setup (Recommended)

**Windows:**
```bash
setup.bat
```

**Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

**1. Install Dependencies**
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install

# Contracts
cd ../contract
cargo build --release --target wasm32-unknown-unknown
```

**2. Configure Environment**
```bash
# Frontend
cd frontend
cp .env.local.example .env.local
# Edit .env.local

# Backend
cd ../backend
cp .env.example .env
# Edit .env
```

## Deploy Contracts

```bash
cd contract

# Deploy subscription contract
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/subscription.wasm \
  --network testnet \
  --source <YOUR_SECRET_KEY>

# Save the contract ID and update your .env files
```

## Initialize Contract

```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  --source <YOUR_SECRET_KEY> \
  -- init \
  --admin <ADMIN_ADDRESS> \
  --fee_bps 500 \
  --fee_recipient <FEE_ADDRESS> \
  --token <TOKEN_ADDRESS> \
  --price 10000000
```

## Start Services

**Terminal 1 - Database:**
```bash
# Using Docker
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=myfans \
  postgres

# Or start your local PostgreSQL
```

**Terminal 2 - Backend:**
```bash
cd backend
npm run start:dev
# Runs on http://localhost:3001
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:3000
```

## Test the Application

1. **Install Freighter Wallet**
   - Chrome: https://chrome.google.com/webstore
   - Firefox: https://addons.mozilla.org

2. **Fund Testnet Account**
   - Visit: https://laboratory.stellar.org/#account-creator
   - Create and fund a testnet account

3. **Connect Wallet**
   - Open http://localhost:3000
   - Click "Connect Wallet"
   - Approve connection in Freighter

4. **Create a Plan (as Creator)**
   - Go to Dashboard → Plans
   - Create a subscription plan
   - Set price and interval

5. **Subscribe (as Fan)**
   - Browse creators
   - Select a plan
   - Complete checkout
   - Sign transaction in Freighter

## Verify Subscription

Check subscription status:
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  -- is_subscriber \
  --fan <FAN_ADDRESS> \
  --creator <CREATOR_ADDRESS>
```

## Troubleshooting

### Contract deployment fails
- Ensure you have testnet XLM
- Check your secret key is correct
- Verify soroban-cli is installed

### Backend won't start
- Check PostgreSQL is running
- Verify .env file exists and is configured
- Check port 3001 is available

### Frontend won't connect
- Verify Freighter is installed
- Check .env.local has correct contract ID
- Ensure backend is running

### Transaction fails
- Check wallet has sufficient balance
- Verify contract is initialized
- Check network (testnet vs mainnet)

## Development Workflow

1. **Make contract changes:**
   ```bash
   cd contract
   cargo test
   cargo build --release --target wasm32-unknown-unknown
   # Redeploy if needed
   ```

2. **Make backend changes:**
   ```bash
   cd backend
   npm run test
   # Server auto-reloads in dev mode
   ```

3. **Make frontend changes:**
   ```bash
   cd frontend
   # Next.js auto-reloads
   ```

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment guide.

## API Documentation

Once backend is running, visit:
- Swagger UI: http://localhost:3001/api
- Health check: http://localhost:3001/health

## Support

- Email: realjaiboi70@gmail.com
- Issues: GitHub Issues
- Docs: See INTEGRATION.md for detailed integration guide

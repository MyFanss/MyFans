# Contributing to MyFans

Thank you for your interest in contributing to MyFans! This document provides guidelines and information for contributors.

## Prerequisites

- Node.js 18+ and npm
- Rust and Cargo
- Soroban CLI (`cargo install soroban-cli`)
- PostgreSQL
- Freighter Wallet browser extension

## Development Setup

### Automated Setup

**Windows:**
```bash
setup.bat
```

**Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

### Manual Setup

1. **Install Dependencies**
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

2. **Configure Environment**
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

## Running the Application

1. **Database:**
   ```bash
   docker run -d -p 5432:5432 \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=myfans \
     postgres
   ```

2. **Backend:**
   ```bash
   cd backend
   npm run start:dev
   # Runs on http://localhost:3001
   ```

3. **Frontend:**
   ```bash
   cd frontend
   npm run dev
   # Runs on http://localhost:3000
   ```

## Testing

- **Frontend:** `cd frontend && npm test`
- **Backend:** `cd backend && npm test`
- **Contracts:** `cd contract && cargo test`

## Code Style

- Follow existing patterns in the repository
- Run linters: `npm run lint` in respective directories
- Ensure tests pass before submitting PR

## Submitting Changes

1. Create a new branch for your changes
2. Make your changes
3. Add tests if applicable
4. Ensure all tests pass
5. Submit a pull request

## Reporting Issues

Please use the issue templates for bug reports, feature requests, and security issues.
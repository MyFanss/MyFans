#!/bin/bash

echo "🚀 MyFans Setup Script"
echo "======================"

# Check if we're in the right directory
if [ ! -f "README.md" ]; then
    echo "❌ Please run this script from the MyFans root directory"
    exit 1
fi

# Frontend setup
echo ""
echo "📦 Setting up Frontend..."
cd frontend
if [ ! -f ".env.local" ]; then
    cp .env.local.example .env.local
    echo "✅ Created frontend/.env.local (please update with your values)"
else
    echo "⚠️  frontend/.env.local already exists"
fi
npm install
cd ..

# Backend setup
echo ""
echo "📦 Setting up Backend..."
cd backend
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Created backend/.env (please update with your values)"
else
    echo "⚠️  backend/.env already exists"
fi
npm install
cd ..

# Contract setup
echo ""
echo "🔨 Setting up Contracts..."
cd contract
cargo build --release --target wasm32-unknown-unknown
echo "✅ Contracts built successfully"
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Deploy contracts: cd contract && soroban contract deploy --wasm target/wasm32-unknown-unknown/release/subscription.wasm --network testnet"
echo "2. Update contract IDs in backend/.env and frontend/.env.local"
echo "3. Start PostgreSQL database"
echo "4. Run backend: cd backend && npm run start:dev"
echo "5. Run frontend: cd frontend && npm run dev"

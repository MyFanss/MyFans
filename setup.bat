@echo off
echo 🚀 MyFans Setup Script
echo ======================

if not exist "README.md" (
    echo ❌ Please run this script from the MyFans root directory
    exit /b 1
)

echo.
echo 📦 Setting up Frontend...
cd frontend
if not exist ".env.local" (
    copy .env.local.example .env.local
    echo ✅ Created frontend/.env.local
) else (
    echo ⚠️  frontend/.env.local already exists
)
call npm install
cd ..

echo.
echo 📦 Setting up Backend...
cd backend
if not exist ".env" (
    copy .env.example .env
    echo ✅ Created backend/.env
) else (
    echo ⚠️  backend/.env already exists
)
call npm install
cd ..

echo.
echo 🔨 Building Contracts...
cd contract
cargo build --release --target wasm32-unknown-unknown
echo ✅ Contracts built
cd ..

echo.
echo ✅ Setup complete!
echo.
echo 📝 Next steps:
echo 1. Contract (build and test): cd contract ^&^& cargo build --release --target wasm32-unknown-unknown ^&^& cargo test
echo 2. Deploy contracts to testnet
echo 3. Update contract IDs in .env files
echo 4. Run: cd backend ^&^& npm run start:dev
echo 5. Run: cd frontend ^&^& npm run dev

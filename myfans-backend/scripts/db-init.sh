#!/bin/bash
# Database initialization script for local development
# Usage: ./scripts/db-init.sh

set -e

echo "🗄️  MyFans Database Initialization"
echo "=================================="

# Check environment
if [ -z "$DB_HOST" ]; then
  export DB_HOST=localhost
fi

if [ -z "$DB_PORT" ]; then
  export DB_PORT=5432
fi

if [ -z "$DB_USERNAME" ]; then
  export DB_USERNAME=myfans
fi

if [ -z "$DB_NAME" ]; then
  export DB_NAME=myfans
fi

echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  User: $DB_USERNAME"
echo "  Database: $DB_NAME"
echo ""

# Check if database exists
echo "1️⃣  Checking for existing database..."
if psql -h "$DB_HOST" -U "$DB_USERNAME" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  echo "   ✓ Database '$DB_NAME' already exists"
  
  # Ask if we should reset it
  read -p "   Reset existing database? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Dropping existing database..."
    dropdb -h "$DB_HOST" -U "$DB_USERNAME" "$DB_NAME"
    echo "   ✓ Database dropped"
  else
    echo "   Skipping reset"
  fi
else
  echo "   ✓ Database '$DB_NAME' does not exist"
fi

# Create database if it doesn't exist
echo ""
echo "2️⃣  Creating database..."
createdb -h "$DB_HOST" -U "$DB_USERNAME" "$DB_NAME" || echo "   ✓ Database already exists"
echo "   ✓ Database created"

# Run migrations
echo ""
echo "3️⃣  Applying migrations..."
npm run db:migrate:up
echo "   ✓ Migrations applied"

# Optional: Seed with test data
echo ""
read -p "4️⃣  Seed with test data? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  npm run db:seed
  echo "   ✓ Test data seeded"
else
  echo "   Skipping seed"
fi

echo ""
echo "✅ Database initialization complete!"
echo ""
echo "Connected to: postgresql://$DB_USERNAME@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo "Next steps:"
echo "  • npm run start:dev    (start development server)"
echo "  • npm run test:db      (run database tests)"
echo "  • npm run db:migrate:down (rollback migrations)"

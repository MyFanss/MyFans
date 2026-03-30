/**
 * Database scripts for package.json
 * Add these to your "scripts" section in package.json
 */

{
  "scripts": {
    "db:migrate:up": "ts-node src/database/migrations.runner.ts up",
    "db:migrate:down": "ts-node src/database/migrations.runner.ts down",
    "db:migrate:create": "typeorm migration:create",
    "db:migrate:status": "typeorm migration:show -d src/database/data-source.ts",
    "db:entities:sync": "typeorm query \"SELECT 1\"",
    "db:seed": "ts-node scripts/seed.ts",
    "db:clean": "ts-node scripts/clean-database.ts",
    "test:migrations": "jest --testPathPattern=migrations.spec.ts",
    "test:seed": "jest --testPathPattern=seed.spec.ts",
    "test:db": "npm run test:migrations && npm run test:seed",
    "docker:db:start": "docker-compose up -d postgres",
    "docker:db:stop": "docker-compose down",
    "docker:db:logs": "docker-compose logs -f postgres"
  }
}

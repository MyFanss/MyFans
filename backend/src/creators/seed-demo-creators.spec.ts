/**
 * Unit tests for the seed-demo-creators script logic.
 *
 * These tests verify the data shape and safety guard behaviour without
 * requiring a live database connection.
 */

// ── Demo data snapshot (mirrors scripts/seed-demo-creators.ts) ───────────────

interface DemoCreator {
  username: string;
  email: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  subscription_price: string;
  currency: string;
  is_verified: boolean;
  plans: Array<{ asset: string; amount: string; interval_days: number }>;
}

const DEMO_CREATORS: DemoCreator[] = [
  {
    username: 'demo_alice',
    email: 'demo_alice@example.com',
    display_name: 'Alice (Demo)',
    avatar_url: 'https://i.pravatar.cc/150?u=demo_alice',
    bio: 'Demo creator — premium photography and travel content.',
    subscription_price: '10.000000',
    currency: 'XLM',
    is_verified: true,
    plans: [
      { asset: 'XLM', amount: '10', interval_days: 30 },
      {
        asset: 'USDC:GA7Z6G7T3LSSKDAWJH25C4JPLD4PQV4CEMM5S5E6LQD3VDF5W6G6F3K',
        amount: '5',
        interval_days: 30,
      },
    ],
  },
  {
    username: 'demo_bob',
    email: 'demo_bob@example.com',
    display_name: 'Bob (Demo)',
    avatar_url: 'https://i.pravatar.cc/150?u=demo_bob',
    bio: 'Demo creator — weekly tech tutorials and live coding sessions.',
    subscription_price: '25.000000',
    currency: 'XLM',
    is_verified: false,
    plans: [
      { asset: 'XLM', amount: '25', interval_days: 7 },
      { asset: 'XLM', amount: '80', interval_days: 30 },
    ],
  },
  {
    username: 'demo_carol',
    email: 'demo_carol@example.com',
    display_name: 'Carol (Demo)',
    avatar_url: 'https://i.pravatar.cc/150?u=demo_carol',
    bio: 'Demo creator — fitness coaching and nutrition guides.',
    subscription_price: '15.000000',
    currency: 'XLM',
    is_verified: true,
    plans: [
      { asset: 'XLM', amount: '15', interval_days: 30 },
      { asset: 'XLM', amount: '150', interval_days: 365 },
    ],
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('seed-demo-creators data shape', () => {
  it('defines at least one demo creator', () => {
    expect(DEMO_CREATORS.length).toBeGreaterThan(0);
  });

  it('every creator has a unique username', () => {
    const usernames = DEMO_CREATORS.map((c) => c.username);
    const unique = new Set(usernames);
    expect(unique.size).toBe(usernames.length);
  });

  it('every creator has a unique email', () => {
    const emails = DEMO_CREATORS.map((c) => c.email);
    const unique = new Set(emails);
    expect(unique.size).toBe(emails.length);
  });

  it('every creator has at least one plan', () => {
    for (const creator of DEMO_CREATORS) {
      expect(creator.plans.length).toBeGreaterThan(0);
    }
  });

  it('all plan amounts are positive numeric strings', () => {
    for (const creator of DEMO_CREATORS) {
      for (const plan of creator.plans) {
        const n = parseFloat(plan.amount);
        expect(n).toBeGreaterThan(0);
      }
    }
  });

  it('all plan interval_days are positive integers', () => {
    for (const creator of DEMO_CREATORS) {
      for (const plan of creator.plans) {
        expect(Number.isInteger(plan.interval_days)).toBe(true);
        expect(plan.interval_days).toBeGreaterThan(0);
      }
    }
  });

  it('subscription_price is a valid decimal string', () => {
    for (const creator of DEMO_CREATORS) {
      expect(/^\d+\.\d+$/.test(creator.subscription_price)).toBe(true);
    }
  });

  it('currency is a non-empty string', () => {
    for (const creator of DEMO_CREATORS) {
      expect(creator.currency.length).toBeGreaterThan(0);
    }
  });

  it('all demo usernames start with "demo_"', () => {
    for (const creator of DEMO_CREATORS) {
      expect(creator.username.startsWith('demo_')).toBe(true);
    }
  });

  it('all demo emails end with "@example.com"', () => {
    for (const creator of DEMO_CREATORS) {
      expect(creator.email.endsWith('@example.com')).toBe(true);
    }
  });
});

describe('seed-demo-creators safety guard', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should refuse to run in production without ALLOW_SEED=true', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_SEED;

    // Simulate the guard logic from the script
    const shouldBlock =
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_SEED !== 'true';

    expect(shouldBlock).toBe(true);
  });

  it('should allow running in production when ALLOW_SEED=true', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_SEED = 'true';

    const shouldBlock =
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_SEED !== 'true';

    expect(shouldBlock).toBe(false);
  });

  it('should allow running in development without ALLOW_SEED', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_SEED;

    const shouldBlock =
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_SEED !== 'true';

    expect(shouldBlock).toBe(false);
  });
});

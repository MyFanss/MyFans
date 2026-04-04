# MyFans Database Schema Diagram

## Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  USERS                                        │
│                          (Platform Users & Fans)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ id (UUID) [PK]                                                                │
│ email (VARCHAR 255) [UNIQUE]                                                  │
│ username (VARCHAR 100) [UNIQUE]                                               │
│ password_hash (TEXT)                                                          │
│ display_name (VARCHAR 255)                                                    │
│ bio (TEXT)                                                                    │
│ avatar_url (VARCHAR 2083)                                                     │
│ is_active (BOOLEAN) [DEFAULT: true]                                           │
│ created_at (TIMESTAMP) [DEFAULT: CURRENT_TIMESTAMP]                           │
│ updated_at (TIMESTAMP) [DEFAULT: CURRENT_TIMESTAMP]                           │
└──────────┬──────────────────────────────────────────────────────────────────┘
           │
           │ ONE-TO-ONE (1:1)
           │
           │ CASCADE DELETE
           │
┌──────────▼──────────────────────────────────────────────────────────────────┐
│                                 CREATORS                                      │
│                          (Creator Profiles)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ id (UUID) [PK]                                                                │
│ user_id (UUID) [FK → users] [NOT NULL]                                        │
│ slug (VARCHAR 100) [UNIQUE]                                                   │
│ headline (VARCHAR 255)                                                        │
│ description (TEXT)                                                            │
│ is_verified (BOOLEAN) [DEFAULT: false]                                        │
│ created_at (TIMESTAMP) [DEFAULT: CURRENT_TIMESTAMP]                           │
│ updated_at (TIMESTAMP) [DEFAULT: CURRENT_TIMESTAMP]                           │
└──────────┬──────────────────────────────────────────────────────────────────┘
           │
           │ ONE-TO-MANY (1:N)
           │
           ├─────────────────┬─────────────────┐
           │                 │                 │
        PLANS            CONTENT          (Future Relations)
           │                 │
           │                 │
┌──────────▼────┐    ┌───────▼─────────────────────────────────┐
│    PLANS       │    │          CONTENT                        │
│  (Subscription)│    │      (Posts, Media)                     │
├────────────────┤    ├─────────────────────────────────────────┤
│ id (UUID) [PK] │    │ id (UUID) [PK]                          │
│ creator_id (FK)│    │ creator_id (FK → creators) [NOT NULL]   │
│ name          │    │ title (VARCHAR 500)                     │
│ description   │    │ body (TEXT)                             │
│ price_cents   │    │ media_url (VARCHAR 2083)                │
│ billing_      │    │ visibility (ENUM)                       │
│  interval     │    │ published_at (TIMESTAMP)                │
│ is_active     │    │ created_at (TIMESTAMP)                  │
│ created_at    │    │ updated_at (TIMESTAMP)                  │
│ updated_at    │    │                                         │
└────────┬───────┘    └─────────────────────────────────────────┘
         │
         │ ONE-TO-MANY (1:N)
         │ CASCADE DELETE
         │
         │
┌────────▼─────────────────────────────────────────────────────┐
│               SUBSCRIPTIONS                                   │
│         (Fan Subscriptions to Plans)                          │
├───────────────────────────────────────────────────────────────┤
│ id (UUID) [PK]                                                │
│ user_id (UUID) [FK → users] [NOT NULL]                        │
│ plan_id (UUID) [FK → plans] [NOT NULL]                        │
│ status (ENUM: active|cancelled|expired)                       │
│ started_at (TIMESTAMP) [NOT NULL]                             │
│ expires_at (TIMESTAMP)                                        │
│ created_at (TIMESTAMP) [DEFAULT: CURRENT_TIMESTAMP]           │
│ updated_at (TIMESTAMP) [DEFAULT: CURRENT_TIMESTAMP]           │
└───────────────────────────────────────────────────────────────┘
```

## Data Flow

```
1. USER REGISTRATION
   ┌─────────────────────────────────────────────┐
   │ 1. User signs up                            │
   │ 2. Insert into users table                  │
   │ 3. Login with email/username                │
   └─────────────────────────────────────────────┘

2. BECOMING A CREATOR
   ┌─────────────────────────────────────────────┐
   │ 1. User elects to become creator            │
   │ 2. Insert into creators (user_id, slug)    │
   │ 3. Creator profile created                  │
   │ 4. Can now create plans & content           │
   └─────────────────────────────────────────────┘

3. CREATOR MONETIZATION
   ┌─────────────────────────────────────────────┐
   │ 1. Creator creates subscription plans       │
   │ 2. Insert into plans (creator_id, price)   │
   │ 3. Creator publishes content                │
   │ 4. Insert into content with visibility     │
   │ 5. Set access control per content item     │
   └─────────────────────────────────────────────┘

4. FAN SUBSCRIPTION
   ┌─────────────────────────────────────────────┐
   │ 1. Fan browses creator (by slug)            │
   │ 2. Views plans (filter by creator_id)      │
   │ 3. Purchases subscription                   │
   │ 4. Insert into subscriptions                │
   │ 5. Fan can now access subscriber content    │
   └─────────────────────────────────────────────┘

5. CONTENT ACCESS
   ┌─────────────────────────────────────────────┐
   │ 1. Fan requests content                     │
   │ 2. Check content.visibility                 │
   │ 3. If public: grant access                  │
   │ 4. If subscribers_only/premium:             │
   │    - Query subscriptions for fan            │
   │    - Match to plan_id                       │
   │    - Verify status = 'active'               │
   │    - Grant/deny based on plan tier          │
   └─────────────────────────────────────────────┘
```

## Key Indexes for Query Performance

### User Lookups
```sql
-- Login by email
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Profile lookup by username
CREATE UNIQUE INDEX idx_users_username ON users(username);

-- Recent users
CREATE INDEX idx_users_created_at ON users(created_at);
```

### Creator Discovery
```sql
-- Direct URL access
CREATE UNIQUE INDEX idx_creators_slug ON creators(slug);

-- Browse verified creators
CREATE INDEX idx_creators_is_verified ON creators(is_verified);

-- User's creator profile
CREATE INDEX idx_creators_user_id ON creators(user_id);
```

### Plan Filtering
```sql
-- Creator's available plans
CREATE INDEX idx_plans_creator_id ON plans(creator_id);

-- Only active plans
CREATE INDEX idx_plans_is_active ON plans(is_active);

-- Creator's active plans (composite)
CREATE INDEX idx_plans_creator_id_is_active 
  ON plans(creator_id, is_active);
```

### Content Queries
```sql
-- Creator's content
CREATE INDEX idx_content_creator_id ON content(creator_id);

-- Filter by visibility (public/private/premium)
CREATE INDEX idx_content_visibility ON content(visibility);

-- Recent content
CREATE INDEX idx_content_published_at ON content(published_at);

-- Creator's recent published content (descending)
CREATE INDEX idx_content_creator_published_at 
  ON content(creator_id, published_at DESC NULLS LAST);
```

### Subscription Lookups
```sql
-- User's subscriptions
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

-- Plan subscribers
CREATE INDEX idx_subscriptions_plan_id ON subscriptions(plan_id);

-- By status (active/cancelled/expired)
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- User's active subscriptions
CREATE INDEX idx_subscriptions_user_status 
  ON subscriptions(user_id, status);

-- Plan's active subscribers
CREATE INDEX idx_subscriptions_plan_status 
  ON subscriptions(plan_id, status);
```

## Common Queries

### Get Creator Profile
```sql
SELECT c.id, c.slug, c.headline, c.is_verified, u.display_name, u.avatar_url
FROM creators c
JOIN users u ON c.user_id = u.id
WHERE c.slug = 'alice-creator';
```

**Indexes Used:** `idx_creators_slug`

### Get Creator's Active Plans
```sql
SELECT id, name, price_cents, billing_interval
FROM plans
WHERE creator_id = $1 AND is_active = TRUE
ORDER BY price_cents ASC;
```

**Indexes Used:** `idx_plans_creator_id_is_active`

### Get Recent Public Content
```sql
SELECT id, title, media_url, published_at
FROM content
WHERE creator_id = $1 AND visibility = 'public' AND published_at IS NOT NULL
ORDER BY published_at DESC
LIMIT 10;
```

**Indexes Used:** `idx_content_creator_published_at`, `idx_content_visibility`

### Get User's Active Subscriptions
```sql
SELECT s.id, p.name, p.price_cents, c.slug
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
JOIN creators c ON p.creator_id = c.id
WHERE s.user_id = $1 AND s.status = 'active'
ORDER BY s.created_at DESC;
```

**Indexes Used:** `idx_subscriptions_user_status`

### Check User Subscription Status
```sql
SELECT COUNT(*) > 0 as has_subscription
FROM subscriptions
WHERE user_id = $1 
  AND plan_id = $2 
  AND status = 'active'
  AND (expires_at IS NULL OR expires_at > NOW());
```

**Indexes Used:** `idx_subscriptions_user_status`

## Constraints & Validations

### CHECK Constraints
```sql
-- Price must be non-negative
CHECK (price_cents >= 0)

-- Billing interval valid values
CHECK (billing_interval IN ('monthly', 'yearly'))

-- Content visibility valid values
CHECK (visibility IN ('public', 'subscribers_only', 'premium'))

-- Subscription status valid values
CHECK (status IN ('active', 'cancelled', 'expired'))

-- Dates make sense
CHECK (expires_at IS NULL OR expires_at >= started_at)
```

### Foreign Key Constraints
```sql
-- Creators belong to users (cascade delete)
CONSTRAINT creators_user_id_fk 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE

-- Plans belong to creators (cascade delete)
CONSTRAINT plans_creator_id_fk 
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE

-- Content belongs to creators (cascade delete)
CONSTRAINT content_creator_id_fk 
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE

-- Subscriptions link users and plans (cascade delete)
CONSTRAINT subscriptions_user_id_fk 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
CONSTRAINT subscriptions_plan_id_fk 
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
```

## Transition Tables (For Auditing)

Future enhancement: Add temporal tables for audit logging:

```sql
-- Enable row-level audit logging
CREATE TABLE users_history AS TABLE users WITH NO DATA;
CREATE TRIGGER users_audit_trigger AFTER UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION audit_log_users();
```

## Performance Metrics

Expected query times (with proper indexing and reasonable data volumes):

- **Login by email**: < 1ms
- **Creator lookup by slug**: < 1ms
- **Get creator's plans**: < 5ms
- **Get user subscriptions**: < 5ms
- **Check subscription access**: < 2ms
- **Get creator content list**: < 10ms
- **Full-text content search**: < 50ms (with FTS index)

## Connection Pool Recommendations

For production deployments:

```
Min connections: 5
Max connections: 20
Idle timeout: 30 seconds
Connection timeout: 5 seconds
```

Adjust based on: expected concurrent users, plan size complexity, content query volume.

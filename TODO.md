# Subscription Contract Event Indexer Implementation
Current Status: [x] Started

**Completed:**
- ✅ SubscriptionIndexEntity created
- ✅ SubscriptionIndexRepository created

## Breakdown of Approved Plan (Logical Steps)

### 1. Database Layer ✅ Complete
   - ✅ Create `backend/src/subscriptions/entities/subscription-index.entity.ts`
   - ✅ Create `backend/src/subscriptions/repositories/subscription-index.repository.ts`
   - ✅ Update `backend/src/subscriptions/subscriptions.module.ts` (add TypeOrmModule.forFeature([SubscriptionIndexEntity]))

### 2. Event Poller Service ✅ Complete (skeleton)
    - ✅ Create `backend/src/subscriptions/services/subscription-event-poller.service.ts` 
    - ✅ Integrate to module + ScheduleModule/ConfigModule
    - [ ] Full Soroban getEvents impl (read SorobanRpcService)
    - [ ] Expiry view invoke
    - [ ] Add idempotent upsert + DomainEvent publish ✅
    - [ ] Checkpoint handling ✅

### 3. Update Core Services ✅ Complete
   - ✅ Refactor `backend/src/subscriptions/subscriptions.service.ts` (Maps → DB repo)
     - ✅ Add repo inject + remove subscription Map
     - ✅ Replace methods (add/renew → upsert mock, isSubscriber/get → repo)
     - ✅ listSubscriptions, dashboard → repo queries
   - ✅ Update `backend/src/subscriptions/subscription-lifecycle-indexer.service.ts` (HTTP → DB upsert)
   - ✅ Update `backend/src/subscriptions/subscription-reconciler.service.ts` (use repo)

### 4. Module Updates
   - [ ] Add ScheduleModule to `backend/src/subscriptions/subscriptions.module.ts`
   - [ ] Config: CONTRACT_ID in env/ConfigService

### 5. Testing & Migration
   - [ ] Unit tests for poller/parser/repo
   - [ ] TypeORM migration generation
   - [ ] Manual test: deploy, poll events, verify DB/no dups

### 6. Completion
   - [ ] Update TODO.md ✅
   - [ ] attempt_completion

**Progress: 0/20 steps complete**


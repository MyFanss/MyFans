TODO: Creator Onboarding Flow Implementation

## Steps:
- [x] Plan approved by user
- [x] 1. Create Creator entity
- [x] 2. Create OnboardCreatorDto
- [x] 3. Update creators.service.ts with onboard method
- [x] 4. Update creators.controller.ts with POST /onboard endpoint
- [x] 5. Update creators.module.ts with TypeOrm and UsersModule
- [x] 6. Update app.module.ts to include Creator entity

## Implementation Details:
- POST /creators/onboard: auth required
- Body: bio (max 500), subscription_price (>= 0), currency (XLM/USDC)
- Idempotent: return 409 if already creator
- Set User.is_creator = true when creating Creator

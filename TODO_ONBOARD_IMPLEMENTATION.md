# Creator Onboarding Flow Implementation

## Tasks

- [x] 1. Create OnboardCreatorDto
- [x] 2. Update creators.service.ts with onboard method
- [x] 3. Update creators.controller.ts with POST /onboard endpoint
- [x] 4. Update creators.module.ts with TypeOrm and UsersModule
- [x] 5. Verify build compiles successfully

## Implementation Details

- POST /creators/onboard: auth required
- Body: bio (max 500), subscription_price (>= 0), currency (XLM/USDC)
- Idempotent: return 409 if already creator
- Set User.is_creator = true when creating Creator

# Social Links Form Implementation - TODO

## Tasks

- [x] 1. Create Social Links form component (social-links-form.tsx)
- [x] 2. Update use-settings.ts to add "Social Links" nav item
- [x] 3. Update settings/page.tsx to add Social Links section
- [x] 4. Test and verify the implementation

---

# Checkout Flow Implementation - TODO

## Tasks

- [x] 1. Fix TypeScript error in CheckoutFlow.tsx (line 156) - showError expects ErrorCode
- [x] 2. Create checkout page at /checkout/[id]
- [x] 3. Integrate CheckoutFlow with wallet connection
- [x] 4. Verify build compiles successfully

## Completed Work

### Fix: TypeScript Error in CheckoutFlow.tsx

- Changed `showError(new Error('Insufficient balance...'))` to `showError('INSUFFICIENT_BALANCE', {...})`
- The showError function expects `ErrorCode | AppError`, not a plain Error

### New: Checkout Page

- Created `/checkout/[id]/page.tsx`
- Handles wallet connection state
- Renders CheckoutFlow component
- Supports query params: `?id=<checkoutId>&planId=<planId>&creator=<creatorAddress>`

### Build Status

- ✅ Frontend builds successfully
- ✅ All TypeScript checks pass
- ✅ New checkout route added: `/checkout/[id]`

## Testing

To test the checkout flow:

```bash
cd frontend
npm run dev
# Visit: http://localhost:3000/checkout/123?planId=1&creator=GAAAAAAAAAAAAAAA
```

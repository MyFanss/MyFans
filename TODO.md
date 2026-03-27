# Issue #299: Contract Error Code Normalization - TODO

## Steps from approved plan:

- [x] Step 1: ✅ Created shared `MyfansError` enum in `myfans-lib/src/lib.rs`
- [ ] Step 2: Update all contract `lib.rs` files to use shared `MyfansError` (preserve codes)
  - content-access
  - content-likes
  - creator-deposits
  - creator-earnings
  - creator-registry
  - earnings
  - myfans-token
  - subscription
  - treasury
- [ ] Step 3: Update any test.rs files if they reference local Error enums
- [ ] Step 4: Run `cd contract && cargo test` - ensure all 100% pass, snapshots unchanged
- [ ] Step 5: `git add . && git commit -m "fix(#299): normalize errors with shared MyfansError enum"`
- [ ] Step 6: `git push origin issue-299-contract-error-normalization`
- [ ] Step 7: `gh pr create --title "fix(#299): Contract error code normalization" --body "Introduce consistent shared error enums..."`

**Current status:** On branch `issue-299-contract-error-normalization`. Many files already modified (good progress!).

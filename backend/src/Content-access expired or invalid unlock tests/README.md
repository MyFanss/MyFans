# Content Access Contract

A Solidity smart contract for managing content access with purchase validation.

## Features

- Purchase content with expiry time
- Unlock content with validation checks
- Prevents unlock when:
  - Purchase has expired
  - Wrong content_id is provided
  - Caller is not the buyer

## Setup

```bash
npm install
```

## Compile

```bash
npm run compile
```

## Test

```bash
npm test
```

## Test Coverage

The test suite covers:

- ✅ Successful purchase and unlock
- ✅ Unlock with expired purchase (reverts)
- ✅ Unlock with wrong content_id (reverts)
- ✅ Unlock as non-buyer (reverts)
- ✅ Edge cases (non-existent purchase, exact expiry time, etc.)

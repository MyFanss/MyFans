# Token Transfer Indexer - Quick Start Guide

## Overview

The Token Transfer Indexer tracks token transfer activity on the MyFans platform. Use this module to:
- Index (store) blockchain token transfer events
- Query transfer history for accounts
- Generate analytics and reports
- Verify that transfers are recorded

## Installation

The module is already installed and integrated into the application. No additional setup needed!

## Basic Usage

### 1. Inject the Service

```typescript
import { Injectable } from '@nestjs/common';
import { TokenTransfersService } from '../token-transfers/token-transfers.service';
import { TransferDirection } from '../token-transfers/entities/token-transfer.entity';

@Injectable()
export class MyService {
  constructor(private transfersService: TokenTransfersService) {}

  async handleTransfer() {
    // Use service here
  }
}
```

### 2. Index a Transfer

```typescript
const transfer = await this.transfersService.indexTransfer({
  sender_address: 'GBUQ...',
  receiver_address: 'GBXP...',
  account_address: 'GBUQ...',
  amount: '100.500000',
  direction: TransferDirection.OUTGOING,
  tx_hash: 'abc123def456',
  fee: '1.000000',
  net_amount: '99.500000',
});
```

### 3. Query Transfer History

```typescript
// Get all transfers for an account
const { data, total } = await this.transfersService.getTransferHistory(
  accountAddress,
  50,    // limit
  0      // offset
);

// Get only incoming transfers
const incoming = await this.transfersService.getIncomingTransfers(
  accountAddress,
  50,
  0
);

// Get only outgoing transfers
const outgoing = await this.transfersService.getOutgoingTransfers(
  accountAddress,
  50,
  0
);
```

### 4. Look Up Transfers

```typescript
// By transaction hash
const transfer = await this.transfersService.getTransferByTxHash('abc123');

// Between two addresses
const { data, total } = await this.transfersService.getTransfersBetween(
  'GBUQ...',
  'GBXP...',
  50,
  0
);

// Check if transfer is indexed
const isIndexed = await this.transfersService.isTransferIndexed('abc123');
```

### 5. Get Statistics

```typescript
const stats = await this.transfersService.getAccountStats(accountAddress);

console.log(stats);
// Output:
// {
//   totalIncoming: '500.000000',
//   totalOutgoing: '250.000000',
//   incomingCount: 5,
//   outgoingCount: 3,
//   totalFeesPaid: '5.000000'
// }
```

## API Endpoints Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/token-transfers` | Index new transfer (webhook) |
| GET | `/token-transfers/account/{address}` | Get transfer history |
| GET | `/token-transfers/incoming/{address}` | Get incoming transfers |
| GET | `/token-transfers/outgoing/{address}` | Get outgoing transfers |
| GET | `/token-transfers/tx/{txHash}` | Look up by transaction hash |
| GET | `/token-transfers/between/{addr1}/{addr2}` | Transfers between addresses |
| GET | `/token-transfers/stats/{address}` | Account statistics |
| GET | `/token-transfers/exists/{txHash}` | Check if indexed |

## Common Patterns

### Pattern 1: Smart Contract Event Listener

```typescript
import { Injectable } from '@nestjs/common';
import { TokenTransfersService } from '../token-transfers/token-transfers.service';
import { TransferDirection } from '../token-transfers/entities/token-transfer.entity';

@Injectable()
export class SorobanListener {
  constructor(private transfers: TokenTransfersService) {}

  async handleContractEvent(event: any) {
    const isOutgoing = event.from === this.myAccountAddress;
    
    await this.transfers.indexTransfer({
      sender_address: event.from,
      receiver_address: event.to,
      account_address: isOutgoing ? event.from : event.to,
      amount: event.amount,
      direction: isOutgoing 
        ? TransferDirection.OUTGOING 
        : TransferDirection.INCOMING,
      tx_hash: event.transactionHash,
      contract_address: event.contractAddress,
      token_type: event.tokenType,
      fee: event.fee,
      net_amount: event.netAmount,
    });
  }
}
```

### Pattern 2: User Dashboard

```typescript
@Controller('dashboard')
export class DashboardController {
  constructor(private transfers: TokenTransfersService) {}

  @Get('transfers/:userId')
  async getUserTransfers(@Param('userId') userId: string) {
    const address = await this.getAddressFromUser(userId);
    
    const [history, stats] = await Promise.all([
      this.transfers.getTransferHistory(address, 10, 0),
      this.transfers.getAccountStats(address),
    ]);

    return {
      recentTransfers: history.data,
      statistics: stats,
    };
  }
}
```

### Pattern 3: Analytics Report

```typescript
@Controller('analytics')
export class AnalyticsController {
  constructor(private transfers: TokenTransfersService) {}

  @Get('peer-activity/:addr1/:addr2')
  async getPeerActivity(
    @Param('addr1') addr1: string,
    @Param('addr2') addr2: string,
  ) {
    const { data } = await this.transfers.getTransfersBetween(addr1, addr2, 100, 0);
    
    return {
      totalTransfers: data.length,
      totalAmount: data.reduce((sum, t) => 
        sum + parseFloat(t.amount), 0
      ),
      transfers: data,
    };
  }
}
```

## Type Safety

The module uses TypeScript interfaces for type safety:

```typescript
import { TokenTransfer, TransferDirection } from 
  '../token-transfers/entities/token-transfer.entity';
import { CreateTokenTransferDto } from 
  '../token-transfers/dto/create-token-transfer.dto';

// All DTOs are type-safe
const dto: CreateTokenTransferDto = {
  sender_address: 'GBUQ...',
  receiver_address: 'GBXP...',
  account_address: 'GBUQ...',
  amount: '100.000000', // Must be string
  direction: TransferDirection.OUTGOING, // Enum
  tx_hash: 'abc123',
  // ... optional fields
};
```

## Error Handling

The controller returns appropriate HTTP status codes:

```typescript
// 201 Created - Transfer indexed successfully
POST /token-transfers

// 400 Bad Request - Invalid input
GET /token-transfers/account/invalid-address

// 404 Not Found - Transfer doesn't exist
GET /token-transfers/tx/nonexistent-hash

// 500 Internal Server Error - Server issue
POST /token-transfers (with DB error)
```

Example error handling:

```typescript
try {
  const transfer = await this.transfers.getTransferByTxHash(txHash);
  if (!transfer) {
    throw new NotFoundException('Transfer not found');
  }
  return transfer;
} catch (error) {
  logger.error('Failed to get transfer', error);
  throw new InternalServerErrorException();
}
```

## Pagination Examples

```typescript
// Page 1 (items 0-49)
const page1 = await this.transfers.getTransferHistory(address, 50, 0);

// Page 2 (items 50-99)
const page2 = await this.transfers.getTransferHistory(address, 50, 50);

// Page 3 (items 100-149)
const page3 = await this.transfers.getTransferHistory(address, 50, 100);

// Calculate next offset
const nextOffset = currentOffset + currentPageSize;
```

## Performance Tips

1. **Use Pagination** - Always use limit/offset for large result sets
2. **Filter Early** - Use `getIncomingTransfers()` or `getOutgoingTransfers()` instead of filtering in code
3. **Cache Results** - Cache account stats if they don't need real-time updates
4. **Index Regularly** - Process events as they happen, not in batch
5. **Monitor Metrics** - Track indexing latency and query performance

## Testing

The module includes comprehensive tests:

```bash
# Run service tests
npm test src/token-transfers/token-transfers.service.spec.ts

# Run controller tests
npm test src/token-transfers/token-transfers.controller.spec.ts

# Run E2E tests
npm run test:e2e test/token-transfers.e2e-spec.ts
```

## Debugging

Enable TypeORM query logging to see SQL:

```typescript
// In your TypeORM config
{
  logging: true, // or specific loggers: ['query', 'error']
}
```

## Troubleshooting

### Q: Transfer was indexed but transfer history returns no results

**A:** Make sure you're querying with the correct account address (exact match including case).

### Q: Stats show incorrect totals

**A:** Ensure all transfers have the correct `account_address` field set. Stats are calculated using this field.

### Q: Performance is slow

**A:** Check that database indexes are created:
```sql
SELECT * FROM pg_stat_user_indexes WHERE tablename = 'token_transfers';
```

### Q: Getting validation errors

**A:** Ensure decimal amounts are strings with correct format:
```typescript
// ✅ Correct
amount: '100.500000'

// ❌ Wrong
amount: 100.5
amount: '100.5'
```

## Migration from v0 to Future Versions

The module is designed for backward compatibility. Future changes will:
- Add new optional fields only
- Never remove existing fields
- Maintain API endpoint URLs
- Update documentation in CHANGELOG.md

## Support References

- Full API docs: [README.md](./README.md)
- Implementation details: [IMPLEMENTATION.md](./IMPLEMENTATION.md)
- Entity schema: [entities/token-transfer.entity.ts](./entities/token-transfer.entity.ts)
- Service methods: [token-transfers.service.ts](./token-transfers.service.ts)
- Controller endpoints: [token-transfers.controller.ts](./token-transfers.controller.ts)

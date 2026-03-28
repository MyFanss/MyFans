# Token Transfer Indexer

A comprehensive backend indexing service for tracking token transfer activity for analytics and auditing.

## Features

- **Transfer Indexing**: Parse and store token transfer events with sender/receiver/amount/timestamp
- **Query Endpoints**: RESTful API for querying transfer history with filtering and pagination
- **Account Filtering**: Support for filtering transfers by account address, direction (incoming/outgoing)
- **Analytics**: Aggregated statistics for accounts (total amounts, transfer counts, fees)
- **Transaction Verification**: Check if a transfer has been indexed by transaction hash
- **Peer-to-Peer Tracking**: Query transfers between specific address pairs

## Database Schema

### TokenTransfer Entity

```typescript
- id: UUID (Primary Key)
- sender_address: string (255 chars, indexed)
- receiver_address: string (255 chars, indexed)
- account_address: string (255 chars, indexed)
- amount: Decimal(18,6) - Transfer amount with 6 decimal places
- token_type: string (default: 'TOKEN')
- direction: INCOMING | OUTGOING
- tx_hash: string (unique transaction identifier, indexed)
- contract_address: string (optional)
- fee: Decimal(18,6) (optional)
- net_amount: Decimal(18,6) (optional, amount after fees)
- user_id: UUID (optional, foreign key to User entity)
- timestamp: DateTime - Event timestamp (indexed with account_address)
- created_at: DateTime - Record creation time
```

### Indexes

- `[sender_address, created_at]` - For sender queries
- `[receiver_address, created_at]` - For receiver queries
- `[account_address, created_at]` - For account history
- `[tx_hash]` - For transfer verification (implicit from tx_hash field)

## API Endpoints

### Index Transfer (Internal/Webhook)
```http
POST /token-transfers
Content-Type: application/json

{
  "sender_address": "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTGSNXBVJQ47XJJFY3SOFBEXHR",
  "receiver_address": "GBXP4ACUQG4C5SQNXQD5LT4DLPTVHVGWTZL4VMWFPWK6BXV7L3TAZQ47",
  "account_address": "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTGSNXBVJQ47XJJFY3SOFBEXHR",
  "amount": "100.500000",
  "direction": "outgoing",
  "tx_hash": "e2a6a5c4f3e4d3c2b1a0f9e8d7c6b5a4",
  "token_type": "TOKEN",
  "contract_address": "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  "fee": "1.000000",
  "net_amount": "99.500000",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "sender_address": "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTGSNXBVJQ47XJJFY3SOFBEXHR",
  "receiver_address": "GBXP4ACUQG4C5SQNXQD5LT4DLPTVHVGWTZL4VMWFPWK6BXV7L3TAZQ47",
  "amount": "100.500000",
  "direction": "outgoing",
  "tx_hash": "e2a6a5c4f3e4d3c2b1a0f9e8d7c6b5a4",
  "timestamp": "2026-03-28T10:00:00Z",
  "created_at": "2026-03-28T10:00:00Z"
}
```

### Get Transfer History
```http
GET /token-transfers/account/{accountAddress}?limit=50&offset=0
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "sender_address": "...",
      "receiver_address": "...",
      "amount": "100.000000",
      "direction": "outgoing",
      "tx_hash": "...",
      "timestamp": "2026-03-28T10:00:00Z"
    }
  ],
  "total": 42
}
```

### Get Incoming Transfers
```http
GET /token-transfers/incoming/{accountAddress}?limit=50&offset=0
```

### Get Outgoing Transfers
```http
GET /token-transfers/outgoing/{accountAddress}?limit=50&offset=0
```

### Get Transfer by TX Hash
```http
GET /token-transfers/tx/{txHash}
```

**Response:** `200 OK` - Returns single transfer object or `404 Not Found`

### Get Transfers Between Addresses
```http
GET /token-transfers/between/{addressA}/{addressB}?limit=50&offset=0
```

### Get Account Statistics
```http
GET /token-transfers/stats/{accountAddress}
```

**Response:** `200 OK`
```json
{
  "totalIncoming": "500.000000",
  "totalOutgoing": "250.000000",
  "incomingCount": 5,
  "outgoingCount": 3,
  "totalFeesPaid": "5.000000"
}
```

### Check if Transfer is Indexed
```http
GET /token-transfers/exists/{txHash}
```

**Response:** `200 OK`
```json
{
  "indexed": true,
  "txHash": "e2a6a5c4f3e4d3c2b1a0f9e8d7c6b5a4"
}
```

## Integration Guide

### Blockchain Event Listener Integration

To automatically index transfers from smart contract events:

```typescript
import { Injectable } from '@nestjs/common';
import { TokenTransfersService } from './token-transfers.service';
import { TransferDirection } from './entities/token-transfer.entity';

@Injectable()
export class BlockchainIndexer {
  constructor(private transfersService: TokenTransfersService) {}

  async indexContractEvent(event: TransferEvent) {
    // Determine direction based on your account address
    const direction = this.isOutgoing(event) 
      ? TransferDirection.OUTGOING 
      : TransferDirection.INCOMING;

    await this.transfersService.indexTransfer({
      sender_address: event.from,
      receiver_address: event.to,
      account_address: event.from, // or event.to depending on context
      amount: event.amount,
      direction,
      tx_hash: event.transactionHash,
      contract_address: event.contractAddress,
      token_type: event.tokenSymbol,
      fee: event.fee,
      net_amount: event.netAmount,
    });
  }
}
```

## Pagination

All list endpoints support pagination:
- `limit`: Maximum results per page (max: 200, default: 50)
- `offset`: Number of records to skip (default: 0)

Example:
```http
GET /token-transfers/account/GBUQ...?limit=25&offset=100
```

## Filtering Capabilities

- **By Account**: Get all transfers for an account (incoming + outgoing)
- **By Direction**: Filter for only incoming or outgoing transfers
- **By Address Pair**: Get transfers between two specific addresses
- **By TX Hash**: Look up specific transfer by blockchain transaction hash
- **By Time Range**: Results are ordered by timestamp (DESC)

## Performance Considerations

- Indexes on `sender_address`, `receiver_address`, and `account_address` enable fast filtering
- Composite index on `account_address + created_at` for chronological queries
- Pagination is recommended for large result sets (>1000 records)
- Aggregate stats queries use indexed columns for efficient computation

## Testing

Run the test suite:

```bash
# Unit tests
npm test -- token-transfers.service.spec.ts
npm test -- token-transfers.controller.spec.ts

# Integration/E2E tests
npm run test:e2e -- token-transfers.e2e-spec.ts
```

### Test Coverage

- Transfer indexing with all fields
- Transfer history pagination
- Filtering by direction (incoming/outgoing)
- Transaction hash lookup
- Account statistics calculation
- Error handling and validation
- API endpoint response formats

## Configuration

No additional configuration required. The module uses the existing:
- Database connection from `AppModule`
- TypeORM entity auto-loading
- NestJS dependency injection

## Module Registration

The `TokenTransfersModule` is already registered in `AppModule`:

```typescript
import { TokenTransfersModule } from './token-transfers/token-transfers.module';

@Module({
  imports: [
    // ... other imports
    TokenTransfersModule,
  ],
})
export class AppModule { }
```

## Error Handling

- **400 Bad Request**: Invalid input data (validation failure)
- **404 Not Found**: Transfer not found by TX hash
- **500 Internal Server Error**: Database or service errors

## Future Enhancement Ideas

1. **Real-time Updates**: WebSocket subscriptions for new transfers
2. **Export Functionality**: CSV/JSON export of transfer history
3. **Smart Alerts**: Notifications for large transfers or suspicious activity
4. **Advanced Analytics**: Charts, trends, average transfer amounts
5. **Currency Conversion**: Support for USD/fiat conversion rates
6. **Smart Contract Events**: Automatic indexing from blockchain events
7. **Audit Trail**: Immutable audit log for compliance

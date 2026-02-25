# Request ID and Correlation ID Tracing

This directory contains the implementation for request tracing across the MyFans backend application. Every request now includes unique identifiers that are propagated through all log entries for easy debugging and monitoring.

## Features

- **Request ID**: Unique identifier for each individual request
- **Correlation ID**: Identifier that can be passed between services to trace related requests
- **Automatic Context Management**: Request context is automatically managed throughout the request lifecycle
- **Structured Logging**: All log entries automatically include request context
- **Header Propagation**: IDs are included in response headers for client-side tracking

## Architecture

### Components

1. **RequestContextService** (`services/request-context.service.ts`)
   - Manages request context throughout the request lifecycle
   - Provides methods to get/set correlation ID, request ID, and user context
   - Thread-safe context storage

2. **CorrelationIdMiddleware** (`middleware/correlation-id.middleware.ts`)
   - Generates or reads request ID and correlation ID from headers
   - Sets response headers for client-side tracking
   - Initializes request context

3. **LoggingMiddleware** (`middleware/logging.middleware.ts`)
   - Logs incoming requests and outgoing responses
   - Includes request context in all HTTP logs
   - Cleans up context after request completion

4. **LoggerService** (`services/logger.service.ts`)
   - Custom logger service that automatically includes request context
   - Provides structured logging capabilities
   - Integrates with Winston for production-ready logging

## Usage

### Basic Usage

```typescript
import { LoggerService } from '../common/services/logger.service';
import { RequestContextService } from '../common/services/request-context.service';

@Controller('example')
export class ExampleController {
    constructor(
        private readonly logger: LoggerService,
        private readonly requestContextService: RequestContextService,
    ) {}

    @Get()
    getExample() {
        // Standard logging with automatic context
        this.logger.log('Processing request', 'ExampleController');

        // Structured logging
        this.logger.logStructured(
            'info',
            'Request processed',
            { action: 'get_example' },
            'ExampleController'
        );

        // Manual context access
        const context = this.requestContextService.getLogContext();
        return { message: 'Success', context };
    }
}
```

### Manual Context Access

```typescript
// Get current request IDs
const correlationId = this.requestContextService.getCorrelationId();
const requestId = this.requestContextService.getRequestId();
const userId = this.requestContextService.getUserId();

// Get full context for logging
const context = this.requestContextService.getLogContext();
```

### Setting User Context

```typescript
// In your auth middleware or guard
this.requestContextService.setUserId(user.id);
```

## Headers

### Request Headers

- `x-correlation-id`: Optional correlation ID (generated if not provided)
- `x-request-id`: Optional request ID (generated if not provided)

### Response Headers

- `x-correlation-id`: Always included
- `x-request-id`: Always included

## Log Format

### Development Mode

```
[Nest] INFO [ExampleController] Processing request [Context: {"correlationId":"abc-123","requestId":"def-456","userId":"user-789","method":"GET","url":"/api/example","ip":"127.0.0.1"}]
```

### Production Mode (JSON)

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "info",
  "message": "Request processed",
  "context": "ExampleController",
  "correlationId": "abc-123",
  "requestId": "def-456",
  "userId": "user-789",
  "method": "GET",
  "url": "/api/example",
  "ip": "127.0.0.1",
  "data": { "action": "get_example" }
}
```

## Testing

### Unit Tests

Run the unit tests for the request tracing components:

```bash
npm test -- request-context.service.spec.ts
npm test -- correlation-id.middleware.spec.ts
```

### Manual Testing

Use the provided test script to verify the implementation:

```bash
# Start the server
npm run start:dev

# In another terminal, run the test script
cd src/common/examples
node test-request-tracing.js
```

### API Testing

Test the endpoints directly:

```bash
# Basic request
curl http://localhost:3000/example

# With existing correlation ID
curl -H "x-correlation-id: test-123" http://localhost:3000/example

# With both IDs
curl -H "x-correlation-id: test-123" -H "x-request-id: req-456" http://localhost:3000/example
```

## Configuration

### Environment Variables

- `LOG_LEVEL`: Set the minimum log level (default: 'info')
- `NODE_ENV`: Set to 'production' for JSON log format

### Winston Configuration

The logger configuration is in `logger/logger.config.ts` and can be customized to add additional transports, formatters, or log levels.

## Best Practices

1. **Always use LoggerService**: Use the injected LoggerService instead of console.log or the default NestJS logger
2. **Use structured logging**: For complex operations, use `logStructured()` method
3. **Set user context early**: Set the user ID as early as possible in the request lifecycle
4. **Include context in errors**: When logging errors, the context will automatically be included
5. **Monitor logs in production**: Use the structured JSON format for log aggregation and monitoring

## Acceptance Criteria

✅ Every request has request ID in logs  
✅ Same ID used for full request lifecycle  
✅ Correlation ID propagation between services  
✅ Structured logging with automatic context inclusion  
✅ Header propagation for client-side tracking  
✅ Context cleanup after request completion  
✅ Comprehensive test coverage

# Metrics Endpoints Configuration

This document describes how to configure and use the protected metrics endpoints in the MyFans backend.

## Overview

The `/v1/metrics` and `/v1/metrics/prometheus` endpoints are protected with a scrape token to prevent unauthorized access to sensitive infrastructure metrics. These endpoints require Bearer token authentication.

## Endpoints

### GET /v1/metrics

Returns a JSON snapshot of per-endpoint HTTP latency, error rate metrics, Soroban RPC metrics, and moderation queue SLA statistics.

**Query Parameters:**
- `route` (optional): Filter HTTP endpoints by route prefix, e.g., `/v1/auth`

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_METRICS_SCRAPE_TOKEN" \
  "https://api.example.com/v1/metrics"
```

**Response:**
```json
{
  "collectedAt": "2026-07-23T10:00:00.000Z",
  "endpoints": [...],
  "moderationSla": {...},
  "rpc": {...},
  "alerts": [...]
}
```

### GET /v1/metrics/prometheus

Returns metrics in Prometheus text format suitable for direct scraping by Prometheus servers.

**Query Parameters:**
- `route` (optional): Filter HTTP endpoints by route prefix

**Example Request:**
```bash
curl -H "Authorization: Bearer YOUR_METRICS_SCRAPE_TOKEN" \
  "https://api.example.com/v1/metrics/prometheus"
```

**Response:** Text format with Prometheus metrics (HELP, TYPE, and metric lines)

## Configuration

### Environment Variables

Set the following environment variable in your production deployment:

```bash
METRICS_SCRAPE_TOKEN=<secure_random_token>
```

**Security Best Practices:**
1. Generate a strong, random token using a secure method:
   ```bash
   openssl rand -hex 32
   ```

2. Store the token securely in your secrets management system (e.g., AWS Secrets Manager, HashiCorp Vault)

3. Never commit the token to version control

4. Rotate the token periodically (recommended: quarterly)

5. If token compromise is suspected, rotate immediately

### Development Setup

For local development, add to `.env.local` or your development environment:

```bash
METRICS_SCRAPE_TOKEN=dev-metrics-token-12345
```

## Prometheus Integration

### Prometheus Configuration

To scrape metrics from a MyFans backend instance, configure Prometheus with:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'myfans-backend'
    metrics_path: '/v1/metrics/prometheus'
    bearer_token: 'YOUR_METRICS_SCRAPE_TOKEN'
    static_configs:
      - targets: ['api.example.com:443']
    scheme: https
```

### Available Metrics

The Prometheus endpoint exposes the following metrics:

**HTTP Metrics:**
- `backend_http_requests_total`: Total HTTP requests by method and route
- `backend_http_request_errors_total`: HTTP errors by code class (4xx/5xx)
- `backend_http_request_duration_seconds`: Histogram of HTTP request durations

**Soroban RPC Metrics:**
- `backend_soroban_rpc_calls_total`: Total RPC calls by method and outcome
- `backend_soroban_rpc_duration_seconds_total`: Total RPC call duration
- `backend_soroban_rpc_duration_seconds_count`: Count of RPC calls

All metrics include relevant labels (method, route, code, outcome, etc.) for fine-grained filtering.

## Testing

### Unauthorized Access

```bash
# Should return 401
curl "https://api.example.com/v1/metrics"
```

### Authorized Access

```bash
# Should return 200 with metrics
curl -H "Authorization: Bearer YOUR_METRICS_SCRAPE_TOKEN" \
  "https://api.example.com/v1/metrics"
```

### Invalid Token

```bash
# Should return 401
curl -H "Authorization: Bearer wrong-token" \
  "https://api.example.com/v1/metrics"
```

## Monitoring & Alerting

Monitor metrics scrape availability:

```yaml
# Prometheus alert rule
- alert: MetricsScrapeFailure
  expr: up{job="myfans-backend"} == 0
  for: 5m
  annotations:
    summary: "MyFans backend metrics scrape failing"
```

## Troubleshooting

### "Missing authorization token" (401)

**Cause:** Authorization header not provided

**Solution:** Include the Authorization header:
```bash
curl -H "Authorization: Bearer $METRICS_SCRAPE_TOKEN" \
  "https://api.example.com/v1/metrics"
```

### "Invalid authorization header format" (401)

**Cause:** Authorization header not in `Bearer <token>` format

**Solution:** Ensure header follows format:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### "Metrics scrape token not configured" (401)

**Cause:** `METRICS_SCRAPE_TOKEN` environment variable not set in deployment

**Solution:** Set the environment variable before starting the application:
```bash
export METRICS_SCRAPE_TOKEN=your-token
```

### "Invalid scrape token" (401)

**Cause:** Token value doesn't match configured token

**Solution:** Verify the token is correct:
1. Check the value in your secrets management system
2. Ensure no extra spaces or characters
3. Verify environment variable was loaded correctly

## Token Rotation

When rotating the token:

1. **Generate new token:**
   ```bash
   openssl rand -hex 32
   ```

2. **Update in secrets management system**

3. **Rolling deployment:**
   - Deploy with new token in parallel
   - Update Prometheus config to use new token
   - Decommission old token

4. **Verification:**
   - Test metrics scrape with new token
   - Verify Prometheus is receiving metrics

## Related Documentation

- [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) - General security practices
- [SECRET_MANAGEMENT.md](./SECRET_MANAGEMENT.md) - Secrets handling guidelines

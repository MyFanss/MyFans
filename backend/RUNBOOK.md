# MyFans Backend Production Runbook

This document serves as the primary operational runbook for the MyFans Backend. It contains the necessary procedures for deployment, rollbacks, and incident response to ensure high availability and rapid recovery during production events.

---

## 1. Deployment Procedures

### Pre-Deployment Checks
1. **Ensure CI/CD Passes:** Verify that all GitHub Actions (unit tests, e2e tests, linting, and security audits) have passed for the release branch.
2. **Review Environment Variables:** Ensure all required environment variables for the new release are present in the production environment.
    - Check for new contract IDs (`SUBSCRIPTION_CONTRACT_ID`, `TREASURY_CONTRACT_ID`, etc.) if Soroban contracts were re-deployed.
    - Check for new feature flags (e.g., `FEATURE_NEW_SUBSCRIPTION_FLOW`).
3. **Database Migrations:** Check if the release includes database schema changes. Determine if they are backwards compatible.

### Deployment Steps
1. **Build the Image:** Build the Docker image for the new release.
    ```bash
    docker build -t myfans-backend:latest -f Dockerfile .
    ```
2. **Run Migrations:** Execute any pending TypeORM database migrations before swapping traffic.
    ```bash
    npm run migration:run
    ```
3. **Deploy:** Roll out the new image to the production environment (e.g., via Docker Compose, Kubernetes, or your cloud provider).
4. **Post-Deployment Health Checks:** Run the following checks to ensure the service is healthy:
    - **General API Health:** 
      ```bash
      curl -s -o /dev/null -w "%{http_code}" https://api.yourdomain.com/v1/health
      # Expected: 200
      ```
    - **Database Health:** 
      ```bash
      curl -s -o /dev/null -w "%{http_code}" https://api.yourdomain.com/v1/health/db
      # Expected: 200
      ```
    - **Soroban RPC Health:** 
      ```bash
      curl -s -o /dev/null -w "%{http_code}" https://api.yourdomain.com/v1/health/soroban
      # Expected: 200
      ```

---

## 2. Rollback Strategy

If a deployment introduces critical bugs, high error rates, or significant performance degradation, initiate a rollback immediately.

### Rollback Triggers
- Prometheus alerts firing (e.g., `HighErrorRate` > 5% or `HighLatency` p99 > 2s).
- Core flows failing (e.g., users cannot subscribe or authenticate).
- Application fails to start (CrashLoopBackOff).

### Rollback Steps
1. **Revert the Application Version:** Deploy the previous stable Docker image or tag.
2. **Database Rollback (If applicable):** 
   - *Warning:* Rolling back the database can cause data loss. Only revert migrations if the new application version is incompatible with the new schema and no critical user data was added.
   - Run TypeORM revert command:
     ```bash
     npm run migration:revert
     ```
3. **Verify Rollback:** Execute the Post-Deployment Health Checks to confirm the system is stable.
4. **Post-Mortem:** Once stable, gather logs, metrics, and request IDs (e.g., `x-correlation-id`) to analyze the root cause before attempting a re-deploy.

---

## 3. Incident Response & Troubleshooting

### Common Failure Modes

#### A. Database Connection Failures
- **Symptoms:** `GET /health/db` returns `503`. High 5xx error rate. Connection timeout logs.
- **Troubleshooting:**
  1. Check if the PostgreSQL instance is running.
  2. Verify network connectivity between the backend and the database.
  3. Validate `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` credentials.
  4. Check database connection pool limits.

#### B. Soroban RPC / Blockchain Sync Issues
- **Symptoms:** `GET /health/soroban` returns `503`. `RpcHighErrorRate` alert firing. Users cannot complete on-chain transactions.
- **Troubleshooting:**
  1. Verify the `SOROBAN_RPC_URL` is correct and accessible.
  2. Check the response time in the health check payload.
  3. If the public RPC is down, switch to an alternative or backup RPC endpoint using the environment variable and restart.

#### C. High API Latency or Error Rates
- **Symptoms:** `HighLatency` or `HighErrorRate` Prometheus alerts firing.
- **Troubleshooting:**
  1. Use the `x-correlation-id` and `x-request-id` from logs to trace the slow or failing requests.
  2. Check if external dependencies (e.g., IPFS, Soroban) are causing the bottleneck.
  3. Review recent deployments for unoptimized database queries.

#### D. Redis/Cache Failures (If Enabled)
- **Symptoms:** High latency on cached endpoints. Cache-related error logs.
- **Troubleshooting:**
  1. Verify Redis is up and running (`docker-compose ps`).
  2. Check Redis memory usage and eviction policies.

---

## 4. On-Call Quick Commands

For rapid diagnostics during an incident, use these commands from the backend host or container:

**View Application Logs (Docker):**
```bash
docker logs --tail 500 -f myfans-backend
```

**Filter Logs for a Specific Request:**
```bash
docker logs myfans-backend | grep <correlation-id>
```

**Check Application Health Endpoints:**
```bash
curl -i http://localhost:3000/v1/health
curl -i http://localhost:3000/v1/health/db
curl -i http://localhost:3000/v1/health/soroban
```

**Check Database Status (PostgreSQL):**
```bash
docker exec -it myfans-postgres pg_isready -U postgres
```

**Test Soroban RPC Connectivity Manually:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getLatestLedger"}' \
  https://soroban-testnet.stellar.org
```

---

## 5. Maintenance & Documentation Sync

To keep this runbook effective:
- **Update on Architecture Changes:** Anytime a new external dependency (e.g., Redis, a new microservice, or a new Soroban contract) is introduced, update the Troubleshooting and Quick Commands sections.
- **Post-Mortem Updates:** After resolving a production incident, review this runbook. If a new failure mode was discovered, add it to the Troubleshooting section along with its mitigation steps.
- **Alerts Review:** Ensure that Prometheus alert rules in `prometheus/alerts.yml` align with the rollback triggers described here.

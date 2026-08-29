import { BusinessMetricsService } from '../business-metrics.service';

describe('BusinessMetricsService', () => {
  let service: BusinessMetricsService;

  beforeEach(() => {
    service = new BusinessMetricsService();
  });

  describe('checkout duration histogram', () => {
    it('records and renders histogram in Prometheus format', () => {
      service.recordCheckoutDuration(500, 'COMPLETED');
      service.recordCheckoutDuration(3000, 'COMPLETED');

      const output = service.toPrometheus();

      expect(output).toContain('myfans_checkout_duration_seconds_bucket{status="COMPLETED"');
      expect(output).toContain('myfans_checkout_duration_seconds_sum{status="COMPLETED"}');
      expect(output).toContain('myfans_checkout_duration_seconds_count{status="COMPLETED"} 2');
    });
  });

  describe('poller lag gauge', () => {
    it('records and renders gauge', () => {
      service.recordPollerLag(1500);

      const output = service.toPrometheus();

      expect(output).toContain('myfans_poller_lag_seconds 1.5');
    });

    it('overwrites previous value (gauge semantics)', () => {
      service.recordPollerLag(1000);
      service.recordPollerLag(2000);

      const output = service.toPrometheus();

      expect(output).toContain('myfans_poller_lag_seconds 2');
      expect(output).not.toContain('myfans_poller_lag_seconds 1');
    });
  });

  describe('HMAC failure counter', () => {
    it('increments and renders counter', () => {
      service.incrementHmacFailures();
      service.incrementHmacFailures();

      const output = service.toPrometheus();

      expect(output).toContain('myfans_webhook_hmac_failures_total 2');
    });
  });

  describe('checkout error counter', () => {
    it('counts errors by reason', () => {
      service.incrementCheckoutError('timeout');
      service.incrementCheckoutError('timeout');
      service.incrementCheckoutError('insufficient_balance');

      const output = service.toPrometheus();

      expect(output).toContain('myfans_checkout_errors_total{reason="timeout"} 2');
      expect(output).toContain('myfans_checkout_errors_total{reason="insufficient_balance"} 1');
    });
  });

  describe('no PII', () => {
    it('does not contain any user identifiers in output', () => {
      service.recordCheckoutDuration(100, 'COMPLETED');
      service.incrementCheckoutError('timeout');
      service.incrementHmacFailures();
      service.recordPollerLag(500);

      const output = service.toPrometheus();

      // Labels should only contain status, reason, le — no user IDs, emails, IPs
      expect(output).not.toMatch(/user[_-]?id/i);
      expect(output).not.toMatch(/@/); // no email addresses
      expect(output).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/); // no IP addresses
    });
  });
});

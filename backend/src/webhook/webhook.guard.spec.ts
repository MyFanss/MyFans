import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { WebhookGuard } from './webhook.guard';
import { WebhookService } from './webhook.service';

const PAYLOAD = JSON.stringify({ event: 'test' });

function makeContext(headers: Record<string, string>, body: unknown, rawBody?: Buffer): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers, body, rawBody }),
    }),
  } as unknown as ExecutionContext;
}

describe('WebhookGuard', () => {
  let service: WebhookService;
  let guard: WebhookGuard;

  beforeEach(() => {
    service = new WebhookService('test-secret');
    guard = new WebhookGuard(service);
  });

  it('throws when x-webhook-signature header is missing', () => {
    const ctx = makeContext({}, {});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws when signature is invalid', () => {
    const ctx = makeContext(
      { 'x-webhook-signature': 'badsig' },
      {},
      Buffer.from(PAYLOAD),
    );
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('passes when signature matches active secret (rawBody)', () => {
    const sig = service.sign(PAYLOAD);
    const ctx = makeContext(
      { 'x-webhook-signature': sig },
      {},
      Buffer.from(PAYLOAD),
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes when signature matches previous secret within cutoff', () => {
    const oldService = new WebhookService('old-secret');
    const sig = oldService.sign(PAYLOAD);

    service.rotate('new-secret', 60_000);
    // service now has active='new-secret', previous='test-secret'
    // We need previous='old-secret', so build a fresh scenario:
    const svc2 = new WebhookService('old-secret');
    svc2.rotate('new-secret', 60_000);
    const guard2 = new WebhookGuard(svc2);

    const ctx = makeContext(
      { 'x-webhook-signature': sig },
      {},
      Buffer.from(PAYLOAD),
    );
    expect(guard2.canActivate(ctx)).toBe(true);
  });

  it('throws when previous secret cutoff has expired', () => {
    const svc = new WebhookService('old-secret');
    const sig = svc.sign(PAYLOAD); // sign with old (will become previous)
    svc.rotate('new-secret', -1);  // cutoffAt already in the past
    const g = new WebhookGuard(svc);

    const ctx = makeContext(
      { 'x-webhook-signature': sig },
      {},
      Buffer.from(PAYLOAD),
    );
    expect(() => g.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws after expirePrevious() is called', () => {
    const svc = new WebhookService('old-secret');
    const sig = svc.sign(PAYLOAD);
    svc.rotate('new-secret', 60_000);
    svc.expirePrevious();
    const g = new WebhookGuard(svc);

    const ctx = makeContext(
      { 'x-webhook-signature': sig },
      {},
      Buffer.from(PAYLOAD),
    );
    expect(() => g.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('falls back to JSON.stringify(body) when rawBody is absent', () => {
    const body = { event: 'test' };
    const payload = JSON.stringify(body);
    const sig = service.sign(payload);
    const ctx = makeContext({ 'x-webhook-signature': sig }, body); // no rawBody
    expect(guard.canActivate(ctx)).toBe(true);
  });
});

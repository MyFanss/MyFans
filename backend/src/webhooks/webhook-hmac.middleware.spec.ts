import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { WebhookHmacMiddleware } from './webhook-hmac.middleware';

const CURRENT_SECRET = 'current-secret-value';
const PREVIOUS_SECRET = 'previous-secret-value';

function sign(secret: string, body: Buffer): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function buildRequest(body: Buffer, signature: string): Request {
  return {
    headers: { 'x-webhook-signature': signature },
    rawBody: body,
    body,
  } as unknown as Request;
}

describe('WebhookHmacMiddleware', () => {
  let middleware: WebhookHmacMiddleware;
  let next: jest.Mock;
  let response: Response;

  beforeEach(() => {
    process.env.WEBHOOK_HMAC_SECRET = CURRENT_SECRET;
    process.env.WEBHOOK_HMAC_PREVIOUS_SECRET = PREVIOUS_SECRET;
    middleware = new WebhookHmacMiddleware();
    next = jest.fn();
    response = {} as Response;
  });

  afterEach(() => {
    delete process.env.WEBHOOK_HMAC_SECRET;
    delete process.env.WEBHOOK_HMAC_PREVIOUS_SECRET;
    jest.restoreAllMocks();
  });

  it('accepts a signature computed with the current secret', () => {
    const body = Buffer.from(JSON.stringify({ event: 'ping' }));
    const request = buildRequest(body, sign(CURRENT_SECRET, body));

    middleware.use(request, response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('accepts a signature computed with the previous secret during rotation', () => {
    const body = Buffer.from(JSON.stringify({ event: 'rotation' }));
    const request = buildRequest(body, sign(PREVIOUS_SECRET, body));

    middleware.use(request, response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid signature and does not call next', () => {
    const body = Buffer.from(JSON.stringify({ event: 'tampered' }));
    const request = buildRequest(body, sign('wrong-secret', body));

    expect(() =>
      middleware.use(request, response, next as unknown as NextFunction),
    ).toThrow(UnauthorizedException);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a replayed request on the second call', () => {
    const body = Buffer.from(JSON.stringify({ event: 'replay' }));
    const signature = sign(CURRENT_SECRET, body);

    middleware.use(
      buildRequest(body, signature),
      response,
      next as unknown as NextFunction,
    );
    expect(next).toHaveBeenCalledTimes(1);

    expect(() =>
      middleware.use(
        buildRequest(body, signature),
        response,
        next as unknown as NextFunction,
      ),
    ).toThrow(UnauthorizedException);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

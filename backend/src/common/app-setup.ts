import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { json, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { MAX_JSON_BODY_BYTES } from './constants/body-upload-quotas';

/** Errors raised by body-parser (`raw-body`) when a body exceeds the limit. */
function isPayloadTooLarge(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { type?: string; status?: number; statusCode?: number };
  return (
    e.type === 'entity.too.large' || e.status === 413 || e.statusCode === 413
  );
}

/**
 * Wire explicit request-body size limits.
 *
 * The Nest app is created with `bodyParser: false` so that we control the
 * JSON / urlencoded parsers and can cap them at {@link MAX_JSON_BODY_BYTES}
 * (256 KB). Without this a caller can POST an arbitrarily large JSON body,
 * inviting memory exhaustion and (via the content endpoints) Pinata
 * pinning-cost abuse.
 *
 * Body-parser rejects an over-limit body from *inside Express middleware*,
 * before Nest's request pipeline runs, so its error never reaches the
 * global exception filter. The error handler installed here converts it to
 * a clean `413` JSON response and echoes a correlation id header.
 *
 * Multipart uploads are **not** parsed here — the single upload route caps
 * file size itself via Multer (`FileInterceptor` limits); those errors
 * *do* reach the exception filter. See `content.controller.ts` and
 * `MAX_UPLOAD_BYTES`.
 *
 * Exported as a standalone helper so e2e specs can apply the exact same
 * configuration (they build the app from `AppModule`, not `main.ts`).
 */
export function configureBodyLimits(app: INestApplication): void {
  app.use(json({ limit: MAX_JSON_BODY_BYTES }));
  app.use(urlencoded({ extended: true, limit: MAX_JSON_BODY_BYTES }));

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!isPayloadTooLarge(err)) {
      next(err);
      return;
    }
    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ??
      (req.headers['x-request-id'] as string | undefined) ??
      randomUUID();
    res.setHeader('X-Correlation-Id', correlationId);
    res.status(413).json({
      statusCode: 413,
      message: 'Request body exceeds the maximum allowed size.',
      correlationId,
    });
  });
}

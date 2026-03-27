import { INestApplication } from '@nestjs/common';
import { json, Request, Response, NextFunction, urlencoded } from 'express';

type RequestWithRawBody = Request & { rawBody?: Buffer };

const DEFAULT_JSON_LIMIT = '100kb';
const DEFAULT_URLENCODED_LIMIT = '100kb';
const DEFAULT_WEBHOOK_JSON_LIMIT = '1mb';

function captureRawBody(
  req: Request,
  _res: Response,
  buffer: Buffer,
): void {
  if (buffer.length > 0) {
    (req as RequestWithRawBody).rawBody = Buffer.from(buffer);
  }
}

export function configureBodyParserLimits(app: INestApplication): void {
  const jsonLimit = process.env.BODY_JSON_LIMIT ?? DEFAULT_JSON_LIMIT;
  const urlencodedLimit =
    process.env.BODY_URLENCODED_LIMIT ?? DEFAULT_URLENCODED_LIMIT;
  const webhookJsonLimit =
    process.env.BODY_WEBHOOK_JSON_LIMIT ?? DEFAULT_WEBHOOK_JSON_LIMIT;

  // Keep webhook payload support flexible without widening limits globally.
  app.use('/v1/webhook', json({ limit: webhookJsonLimit, verify: captureRawBody }));
  app.use(json({ limit: jsonLimit, verify: captureRawBody }));
  app.use(
    urlencoded({
      extended: true,
      limit: urlencodedLimit,
      verify: captureRawBody,
    }),
  );

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const bodyParserError = err as { type?: string; status?: number } | undefined;

    if (
      bodyParserError?.type === 'entity.too.large' ||
      bodyParserError?.status === 413
    ) {
      res.status(413).json({
        statusCode: 413,
        error: 'Payload Too Large',
        message: `Payload too large. Maximum request body size is ${jsonLimit}.`,
      });
      return;
    }

    next(err);
  });
}

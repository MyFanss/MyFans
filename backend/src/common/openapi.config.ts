import { DocumentBuilder } from '@nestjs/swagger';

/**
 * Named security schemes referenced by `@ApiBearerAuth(<name>)` on controllers.
 *
 * - `bearer` — the historical default scheme (`@ApiBearerAuth()` with no
 *   argument). Kept so existing annotations keep resolving.
 * - `jwt` — platform JWT issued by the auth module (`Authorization: Bearer …`).
 * - `fan-bearer` — Stellar wallet bearer token issued by the wallet-link
 *   challenge flow; used by the fan-facing `/subscriptions/me/*` and
 *   `/subscriptions/me/spending-cap` endpoints.
 */
export const OPENAPI_SECURITY_SCHEMES = {
  bearer: 'bearer',
  jwt: 'jwt',
  fanBearer: 'fan-bearer',
} as const;

/**
 * Single source of truth for the OpenAPI document config. Used by `main.ts`
 * (served at `/api-docs`), the `/system/openapi.json` controller, and the
 * `scripts/generate-openapi.ts` snapshot generator, so all three stay in sync
 * and the CI drift check compares like with like.
 */
export function buildOpenApiConfig(): ReturnType<DocumentBuilder['build']> {
  return new DocumentBuilder()
    .setTitle('MyFans API')
    .setDescription('MyFans backend REST API')
    .setVersion('1.0')
    .addTag(
      'subscriptions',
      'Subscription checkout, lifecycle, spending caps and indexer ingest',
    )
    .addBearerAuth()
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Platform JWT',
      },
      OPENAPI_SECURITY_SCHEMES.jwt,
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        description:
          'Stellar wallet bearer token issued by the wallet-link challenge flow',
      },
      OPENAPI_SECURITY_SCHEMES.fanBearer,
    )
    .build();
}

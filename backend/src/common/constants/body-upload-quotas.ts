/**
 * Explicit body-size and upload quotas.
 *
 * Not wired up yet — `main.ts` currently creates the Nest app with no
 * explicit JSON/body-size limit, and content upload endpoints
 * (`content.controller.ts` / `ipfs.service.ts`) accept metadata with no
 * enforced size cap. That means an unauthenticated or low-trust caller
 * can currently submit arbitrarily large payloads, inviting abuse
 * (memory exhaustion, storage-cost abuse against the IPFS pinning
 * service, etc).
 *
 * These constants define the intended caps so they can be wired into
 * `NestFactory.create(AppModule, { bodyParser: false })` + explicit
 * `express.json({ limit })`, and into a per-route upload guard, in a
 * follow-up change.
 */

/** Max JSON request body size accepted by the API, in bytes. */
export const MAX_JSON_BODY_BYTES = 256 * 1024; // 256 KB

/** Max size of a single content upload (metadata + referenced asset), in bytes. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/** Max number of uploads a single creator may submit per rolling hour. */
export const MAX_UPLOADS_PER_CREATOR_PER_HOUR = 20;

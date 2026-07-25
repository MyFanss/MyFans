# Auth modes

This backend has multiple overlapping auth implementations that accumulated
over time. This doc describes what's actually live, what isn't, and how CSRF
protection interacts with each.

## Live auth modes

1. **Cookie/session clients** (web frontend) — authenticated via
   `src/auth-module` (canonical `AuthModule`, `JwtAuthGuard`, `RolesGuard`,
   wired into `AppModule`). These requests are protected by
   `CsrfMiddleware` (`src/common/middleware/csrf.middleware.ts`) on all
   state-mutating routes, using a double-submit cookie.
2. **Bearer clients** (mobile apps, CLI tools, server-to-server callers,
   and the `Authorization: Bearer <base64(Stellar G-address)>` scheme used
   by `FanBearerGuard` for subscription routes) — identified purely by an
   `Authorization` header, which browsers never attach automatically to
   cross-site requests. `CsrfMiddleware` exempts any request carrying an
   `Authorization: Bearer ...` header from the double-submit cookie check,
   since CSRF only threatens auto-attached credentials (cookies).

Whether a route requires cookie-session auth, Bearer auth, or a specific
Bearer sub-scheme (e.g. `FanBearerGuard`'s Stellar-address token) is decided
per-guard on the controller/route, not by `CsrfMiddleware` — the middleware
only decides whether the CSRF check itself applies.

## Module consolidation (canonical vs. deprecated)

Several duplicate module stacks exist. `AppModule` only imports the
canonical ones; the rest are dead code at the module-wiring level, though a
few individual files inside the deprecated directories are still consumed
directly by canonical code and must not be deleted without tracing their
importers first.

| Concern | Canonical (live) | Deprecated (dead as a module) | Still-live exception inside the deprecated dir |
| --- | --- | --- | --- |
| Auth module | `src/auth-module` | `src/auth` (wallet-challenge flow) | `src/auth/throttler.guard.ts` — wired into `AppModule` as the global `APP_GUARD` rate limiter |
| Auth module | `src/auth-module` | `src/refresh-module` (JWT + refresh-token flow, own `AuthController`/`JwtStrategy`) | `refresh-token.entity.ts` — referenced by `users-module/user.entity.ts`'s relation, though neither is registered with the live TypeORM connection |
| Users module | `src/users` (imported by `auth-module/auth.module.ts`) | `src/users-module` (own `UsersController`/`UsersService`/`User` entity) | `user-profile.dto.ts` / `paginated-users-response.dto.ts` — re-exported through `src/common/dto/index.ts` and consumed by ~20 live files across the app |

Each deprecated module's entrypoint (`auth.module.ts` / `users.module.ts`)
carries a `@deprecated` header comment pointing back here. None of these
directories were deleted as part of this consolidation pass — the DTO/entity
cross-references above make blind deletion unsafe without a full
compile+test pass to verify every importer. Follow-up work should migrate
the still-live DTO/entity usages onto their canonical (`src/users`)
equivalents, then delete the deprecated directories outright.

export * from './pagination.dto';
export * from './paginated-response.dto';

// `users-module`'s NestJS module/controller/service/entity are dead code
// (not imported by AppModule — see `users-module/users.module.ts`), but these
// two DTO types are genuinely live and consumed across the app via this
// re-export. Do not remove without first migrating every importer below to
// a `src/users` (canonical) equivalent. See backend/docs/AUTH_MODES.md.
export type { UserProfileDto, PaginatedUsersDto } from '../../users-module';

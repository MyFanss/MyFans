import { SetMetadata } from '@nestjs/common';

export const DEPRECATION_KEY = 'deprecation';

export interface DeprecationMeta {
  sunsetDate: string;
  migrationPath: string;
  reason?: string;
}

export const Deprecated = (meta: DeprecationMeta) =>
  SetMetadata(DEPRECATION_KEY, meta);

import { SetMetadata } from '@nestjs/common';

export const DEPRECATION_KEY = 'deprecation';

export interface DeprecationMeta {
  sunset: string;   // ISO date, e.g. '2026-01-01'
  link: string;     // migration docs URL
  message?: string;
}

export const Deprecated = (meta: DeprecationMeta) =>
  SetMetadata(DEPRECATION_KEY, meta);

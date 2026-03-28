import { Injectable } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  allowedHosts?: string[];
}

@Injectable()
export class CorsService {
  private readonly config: CorsConfig;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    const allowedOriginsEnv = process.env.CORS_ALLOWED_ORIGINS || '';
    const allowedHostsEnv = process.env.CORS_ALLOWED_HOSTS || '';

    // Parse comma-separated origins from environment
    const allowedOrigins = allowedOriginsEnv
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);

    const allowedHosts = allowedHostsEnv
      .split(',')
      .map((host) => host.trim())
      .filter((host) => host.length > 0);

    // Default origins for local development
    const devOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8080',
    ];

    // Default hosts for local development
    const devHosts = ['localhost', '127.0.0.1'];

    this.config = {
      // In development, allow all local origins; in production, use allowlist
      allowedOrigins: isProduction
        ? allowedOrigins.length > 0
          ? allowedOrigins
          : []
        : [...devOrigins, ...allowedOrigins],
      allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Correlation-ID',
        'X-Request-ID',
        'Accept',
        'Origin',
      ],
      exposedHeaders: [
        'X-Correlation-ID',
        'X-Request-ID',
        'Content-Length',
        'Content-Range',
      ],
      credentials: true,
      maxAge: 86400, // 24 hours
      allowedHosts: isProduction
        ? allowedHosts.length > 0
          ? allowedHosts
          : undefined
        : [...devHosts, ...(allowedHosts.length > 0 ? allowedHosts : [])],
    };
  }

  getCorsOptions(): CorsOptions {
    const {
      allowedOrigins,
      allowedMethods,
      allowedHeaders,
      exposedHeaders,
      credentials,
      maxAge,
      allowedHosts,
    } = this.config;

    return {
      origin: this.getOriginFunction(allowedOrigins),
      methods: allowedMethods,
      allowedHeaders,
      exposedHeaders,
      credentials,
      maxAge,
      // Host-based filtering for additional protection
      ...(allowedHosts && {
        origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          // Always allow requests without origin (e.g., mobile apps, curl)
          if (!origin) {
            return callback(null, true);
          }

          try {
            const url = new URL(origin);
            const host = url.hostname;

            // Check if host is in allowed list
            if (allowedHosts && allowedHosts.length > 0) {
              const isAllowed = allowedHosts.some(
                (allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`),
              );
              if (!isAllowed) {
                return callback(null, false);
              }
            }

            // Check if origin is in allowed origins (for more granular control)
            if (allowedOrigins && allowedOrigins.length > 0) {
              const isAllowed = allowedOrigins.includes(origin);
              return callback(null, isAllowed);
            }

            return callback(null, true);
          } catch {
            // Invalid URL - block the request
            return callback(null, false);
          }
        },
      }),
    };
  }

  private getOriginFunction(allowedOrigins: string[]): CorsOptions['origin'] {
    // If no allowed origins specified in production, block all CORS requests
    if (allowedOrigins.length === 0 && process.env.NODE_ENV === 'production') {
      return false;
    }

    // Return function for dynamic origin checking
    return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Always allow requests without origin (e.g., mobile apps, curl)
      if (!origin) {
        return callback(null, true);
      }

      // In development, be permissive
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      // In production, check against allowlist
      const isAllowed = allowedOrigins.includes(origin);
      callback(null, isAllowed);
    };
  }

  getConfig(): CorsConfig {
    return { ...this.config };
  }
}

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string;
  strictTransportSecurity?: string;
  xFrameOptions?: string;
  xContentTypeOptions?: string;
  xXssProtection?: string;
  referrerPolicy?: string;
  permissionsPolicy?: string;
  crossOriginEmbedderPolicy?: string;
  crossOriginOpenerPolicy?: string;
  crossOriginResourcePolicy?: string;
}

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly config: SecurityHeadersConfig;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    // Content Security Policy - restricts sources for various content types
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' " + (process.env.CORS_ALLOWED_ORIGINS || ''),
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ];

    this.config = {
      // CSP is more restrictive in production
      contentSecurityPolicy: isProduction ? cspDirectives.join('; ') : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src *",

      // HSTS only in production
      strictTransportSecurity: isProduction ? 'max-age=31536000; includeSubDomains; preload' : undefined,

      // Prevent clickjacking
      xFrameOptions: 'DENY',

      // Prevent MIME type sniffing
      xContentTypeOptions: 'nosniff',

      // Legacy XSS protection (for older browsers)
      xXssProtection: '1; mode=block',

      // Control referrer information
      referrerPolicy: 'strict-origin-when-cross-origin',

      // Feature/Permissions Policy
      permissionsPolicy: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",

      // Cross-Origin policies
      crossOriginEmbedderPolicy: 'require-corp',
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'same-origin',
    };
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Set security headers
    if (this.config.contentSecurityPolicy) {
      res.setHeader('Content-Security-Policy', this.config.contentSecurityPolicy);
    }

    if (this.config.strictTransportSecurity) {
      res.setHeader('Strict-Transport-Security', this.config.strictTransportSecurity);
    }

    if (this.config.xFrameOptions) {
      res.setHeader('X-Frame-Options', this.config.xFrameOptions);
    }

    if (this.config.xContentTypeOptions) {
      res.setHeader('X-Content-Type-Options', this.config.xContentTypeOptions);
    }

    if (this.config.xXssProtection) {
      res.setHeader('X-XSS-Protection', this.config.xXssProtection);
    }

    if (this.config.referrerPolicy) {
      res.setHeader('Referrer-Policy', this.config.referrerPolicy);
    }

    if (this.config.permissionsPolicy) {
      res.setHeader('Permissions-Policy', this.config.permissionsPolicy);
    }

    if (this.config.crossOriginEmbedderPolicy) {
      res.setHeader('Cross-Origin-Embedder-Policy', this.config.crossOriginEmbedderPolicy);
    }

    if (this.config.crossOriginOpenerPolicy) {
      res.setHeader('Cross-Origin-Opener-Policy', this.config.crossOriginOpenerPolicy);
    }

    if (this.config.crossOriginResourcePolicy) {
      res.setHeader('Cross-Origin-Resource-Policy', this.config.crossOriginResourcePolicy);
    }

    // Remove potentially sensitive headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  }
}

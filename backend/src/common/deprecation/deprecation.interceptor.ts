import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DEPRECATION_KEY, DeprecationMeta } from './deprecated.decorator';

@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<DeprecationMeta>(
      DEPRECATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!meta) return next.handle();

    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap(() => {
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', new Date(meta.sunset).toUTCString());
        res.setHeader('Link', `<${meta.link}>; rel="successor-version"`);
        if (meta.message) {
          res.setHeader('X-Deprecation-Notice', meta.message);
        }
      }),
    );
  }
}

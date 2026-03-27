import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

// Blocked keywords list — extend or replace with an external moderation service
const BLOCKED_PATTERNS = [/\bspam\b/i, /\bhate\b/i, /\bscam\b/i];

@Injectable()
export class ModerationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const body = request.body as { content?: string };
    const content = body.content;

    if (content) {
      const flagged = BLOCKED_PATTERNS.some((pattern) =>
        pattern.test(content),
      );
      if (flagged) {
        throw new ForbiddenException('Message content violates community guidelines');
      }
    }

    return true;
  }
}

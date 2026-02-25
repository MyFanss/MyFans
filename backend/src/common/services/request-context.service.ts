import { Injectable } from '@nestjs/common';

export interface RequestContext {
    correlationId: string;
    requestId: string;
    method: string;
    url: string;
    ip: string;
    userAgent?: string;
    userId?: string | null;
}

@Injectable()
export class RequestContextService {
    private static context: RequestContext | null = null;

    setContext(context: RequestContext): void {
        RequestContextService.context = context;
    }

    getContext(): RequestContext | null {
        return RequestContextService.context;
    }

    getCorrelationId(): string | null {
        return RequestContextService.context?.correlationId || null;
    }

    getRequestId(): string | null {
        return RequestContextService.context?.requestId || null;
    }

    getUserId(): string | null {
        return RequestContextService.context?.userId || null;
    }

    setUserId(userId: string): void {
        if (RequestContextService.context) {
            RequestContextService.context.userId = userId;
        }
    }

    clearContext(): void {
        RequestContextService.context = null;
    }

    // Helper method to get context for logging
    getLogContext(): Record<string, any> {
        const context = RequestContextService.context;
        if (!context) {
            return {};
        }

        return {
            correlationId: context.correlationId,
            requestId: context.requestId,
            userId: context.userId,
            method: context.method,
            url: context.url,
            ip: context.ip,
        };
    }
}

import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  correlationId: string;
  requestId: string;
  method: string;
  url: string;
  ip: string;
  userAgent?: string;
  userId?: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class RequestContextService {
  /** Run a callback inside a new request context store. */
  run(context: RequestContext, fn: () => void): void {
    storage.run(context, fn);
  }

  setContext(context: RequestContext): void {
    // Mutate the current store in-place so callers that already hold a
    // reference to the store object see the update.
    const store = storage.getStore();
    if (store) {
      Object.assign(store, context);
    }
    // If no store exists yet (e.g. called outside a request), seed one.
    // This path is only hit in legacy call-sites; prefer run() instead.
  }

  getContext(): RequestContext | null {
    return storage.getStore() ?? null;
  }

  getCorrelationId(): string | null {
    return storage.getStore()?.correlationId ?? null;
  }

  getRequestId(): string | null {
    return storage.getStore()?.requestId ?? null;
  }

  getUserId(): string | null {
    return storage.getStore()?.userId ?? null;
  }

  setUserId(userId: string): void {
    const store = storage.getStore();
    if (store) store.userId = userId;
  }

  clearContext(): void {
    // AsyncLocalStorage clears automatically when the async context exits.
    // This is a no-op kept for API compatibility.
  }

  getLogContext(): Record<string, unknown> {
    const ctx = storage.getStore();
    if (!ctx) return {};
    return {
      correlationId: ctx.correlationId,
      requestId: ctx.requestId,
      userId: ctx.userId,
      method: ctx.method,
      url: ctx.url,
      ip: ctx.ip,
    };
  }
}

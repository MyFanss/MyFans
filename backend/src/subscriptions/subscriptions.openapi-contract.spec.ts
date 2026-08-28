import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { SubscriptionsController } from './subscriptions.controller';
import { SpendingCapController } from './spending-cap.controller';
import { SubscriptionLifecycleIndexerController } from './subscription-lifecycle-indexer.controller';

/**
 * Contract test: every route on every subscription controller must be
 * documented for OpenAPI (summary + at least one response), and the well-known
 * checkout / index / spending-cap / indexer routes must all be present.
 *
 * OpenAPI drift on the subscription surface has been a recurring failure
 * (frontend api-client typing), so this runs in CI (jest) without booting the
 * Nest app — it reads the same decorator metadata `SwaggerModule` consumes.
 */

type Ctor = new (...args: never[]) => object;

interface Route {
  controller: string;
  handler: string;
  method: string;
  path: string;
}

const HTTP_METHOD_NAMES: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.ALL]: 'ALL',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
};

function joinPath(base: string, sub: string): string {
  const segments = [base, sub]
    .map((s) => s.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return `/${segments.join('/')}`;
}

function collectRoutes(controller: Ctor): Route[] {
  const basePath: string = Reflect.getMetadata(PATH_METADATA, controller) ?? '';
  const proto = controller.prototype as Record<string, unknown>;

  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor')
    .filter((name) => Reflect.hasMetadata(PATH_METADATA, proto[name] as object))
    .map((name) => {
      const handler = proto[name] as object;
      const sub: string = Reflect.getMetadata(PATH_METADATA, handler) ?? '';
      const httpMethod: number =
        Reflect.getMetadata(METHOD_METADATA, handler) ?? RequestMethod.GET;
      return {
        controller: controller.name,
        handler: name,
        method: HTTP_METHOD_NAMES[httpMethod] ?? String(httpMethod),
        path: joinPath(`/${basePath}`, sub),
      };
    });
}

const CONTROLLERS: Ctor[] = [
  SubscriptionsController as unknown as Ctor,
  SpendingCapController as unknown as Ctor,
  SubscriptionLifecycleIndexerController as unknown as Ctor,
];

const routes = CONTROLLERS.flatMap(collectRoutes);

describe('Subscriptions OpenAPI contract', () => {
  it('discovers routes on every subscription controller', () => {
    expect(routes.length).toBeGreaterThan(0);
    for (const controller of CONTROLLERS) {
      expect(routes.some((r) => r.controller === controller.name)).toBe(true);
    }
  });

  it.each(routes.map((r) => [`${r.method} ${r.path} (${r.handler})`, r]))(
    '%s has an ApiOperation summary',
    (_label, route) => {
      const handler = route;
      const proto = CONTROLLERS.find((c) => c.name === handler.controller)!
        .prototype as Record<string, unknown>;
      const meta = Reflect.getMetadata(
        'swagger/apiOperation',
        proto[handler.handler] as object,
      );
      expect(meta).toBeDefined();
      expect(typeof meta.summary).toBe('string');
      expect(meta.summary.length).toBeGreaterThan(0);
    },
  );

  it.each(routes.map((r) => [`${r.method} ${r.path} (${r.handler})`, r]))(
    '%s documents at least one response',
    (_label, route) => {
      const handler = route;
      const proto = CONTROLLERS.find((c) => c.name === handler.controller)!
        .prototype as Record<string, unknown>;
      const meta = Reflect.getMetadata(
        'swagger/apiResponse',
        proto[handler.handler] as object,
      );
      expect(meta).toBeDefined();
      expect(Object.keys(meta).length).toBeGreaterThan(0);
    },
  );

  it('has no response set consisting solely of 404', () => {
    for (const route of routes) {
      const proto = CONTROLLERS.find((c) => c.name === route.controller)!
        .prototype as Record<string, unknown>;
      const meta =
        Reflect.getMetadata(
          'swagger/apiResponse',
          proto[route.handler] as object,
        ) ?? {};
      const codes = Object.keys(meta);
      expect(codes).not.toEqual(['404']);
    }
  });

  describe('well-known routes are present', () => {
    const present = (method: string, path: string) =>
      routes.some((r) => r.method === method && r.path === path);

    it('includes the checkout routes', () => {
      expect(present('POST', '/subscriptions/checkout')).toBe(true);
      expect(present('GET', '/subscriptions/checkout/:id')).toBe(true);
      expect(present('GET', '/subscriptions/checkout/:id/plan')).toBe(true);
      expect(present('GET', '/subscriptions/checkout/:id/price')).toBe(true);
      expect(present('GET', '/subscriptions/checkout/:id/wallet')).toBe(true);
      expect(present('GET', '/subscriptions/checkout/:id/preview')).toBe(true);
      expect(present('POST', '/subscriptions/checkout/:id/validate')).toBe(
        true,
      );
      expect(present('POST', '/subscriptions/checkout/:id/confirm')).toBe(true);
      expect(present('POST', '/subscriptions/checkout/:id/fail')).toBe(true);
    });

    it('includes the index / listing routes', () => {
      expect(present('GET', '/subscriptions/list')).toBe(true);
      expect(present('GET', '/subscriptions/check')).toBe(true);
      expect(present('GET', '/subscriptions/me/list')).toBe(true);
    });

    it('includes the spending-cap routes', () => {
      expect(present('GET', '/subscriptions/me/spending-cap')).toBe(true);
      expect(present('PUT', '/subscriptions/me/spending-cap')).toBe(true);
      expect(present('DELETE', '/subscriptions/me/spending-cap')).toBe(true);
    });

    it('includes the indexer ingest route', () => {
      expect(present('POST', '/subscriptions/indexer-events')).toBe(true);
    });
  });
});

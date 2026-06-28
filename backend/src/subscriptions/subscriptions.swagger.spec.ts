import { SubscriptionsController } from './subscriptions.controller';

describe('SubscriptionsController – Swagger/OpenAPI documentation', () => {
  const controllerPrototype = SubscriptionsController.prototype;

  const endpoints = [
    'getFanCreatorSubscriptionState',
    'checkSubscription',
    'listSubscriptions',
    'listMySubscriptions',
    'listCreatorSubscribers',
    'createCheckout',
    'getCheckout',
    'getPlanSummary',
    'getPriceBreakdown',
    'getWalletStatus',
    'getTransactionPreview',
    'validateBalance',
    'confirmSubscription',
    'failCheckout',
    'cancelSubscription',
  ];

  it.each(endpoints)('%s has ApiOperation metadata', (method) => {
    const metadata = Reflect.getMetadata(
      'swagger/apiOperation',
      controllerPrototype[method],
    );
    expect(metadata).toBeDefined();
    expect(metadata.summary).toBeDefined();
    expect(metadata.summary.length).toBeGreaterThan(0);
  });

  it.each(endpoints)('%s has at least one ApiResponse metadata', (method) => {
    const metadata = Reflect.getMetadata(
      'swagger/apiResponse',
      controllerPrototype[method],
    );
    expect(metadata).toBeDefined();
    expect(Object.keys(metadata).length).toBeGreaterThan(0);
  });

  it('controller class has ApiTags metadata', () => {
    const tags = Reflect.getMetadata('swagger/apiUseTags', SubscriptionsController);
    expect(tags).toContain('subscriptions');
  });

  const writeEndpoints = [
    'createCheckout',
    'validateBalance',
    'confirmSubscription',
    'failCheckout',
    'cancelSubscription',
  ];

  it.each(writeEndpoints)('%s documents 429 rate-limit response', (method) => {
    const metadata = Reflect.getMetadata(
      'swagger/apiResponse',
      controllerPrototype[method],
    );
    expect(metadata['429']).toBeDefined();
    expect(metadata['429'].description).toMatch(/too many requests/i);
  });

  const paramEndpoints = [
    'getCheckout',
    'getPlanSummary',
    'getPriceBreakdown',
    'getWalletStatus',
    'getTransactionPreview',
    'validateBalance',
    'confirmSubscription',
    'failCheckout',
  ];

  it.each(paramEndpoints)('%s has ApiParam metadata for checkout id', (method) => {
    const params = Reflect.getMetadata(
      'swagger/apiParameters',
      controllerPrototype[method],
    );
    expect(params).toBeDefined();
    const idParam = params.find((p: { name: string }) => p.name === 'id');
    expect(idParam).toBeDefined();
  });
});

import { RequestContextService } from '../common/services/request-context.service';
import { SubscriptionReconcilerService } from './subscription-reconciler.service';

/**
 * #592 – Correlation ID: ensure async context propagation
 * Verifies that scheduledReconcile() seeds a fresh correlationId so the
 * job logger and all downstream calls share the same trace ID.
 */
describe('SubscriptionReconcilerService – correlation ID propagation', () => {
  let requestContext: RequestContextService;

  const makeService = () => {
    const jobLogger = {
      start: jest.fn(() => ({ done: jest.fn() })),
    };
    const service = new (SubscriptionReconcilerService as any)(
      {
        expireSubscription: jest.fn(),
        renewSubscription: jest.fn(),
        getSubscription: jest.fn(async () => null),
      },
      { findAllForReconciler: jest.fn(async () => []) },
      { checkConnectivity: jest.fn(async () => ({ status: 'down' })) },
      jobLogger,
      requestContext,
    ) as SubscriptionReconcilerService;
    return { service, jobLogger };
  };

  beforeEach(() => {
    requestContext = new RequestContextService();
  });

  it('seeds a correlationId for each scheduled run', async () => {
    const capturedIds: string[] = [];
    const { service } = makeService();

    const origReconcile = service.reconcile.bind(service);
    service.reconcile = async (dryRun?: boolean) => {
      capturedIds.push(requestContext.getCorrelationId() ?? '');
      return origReconcile(dryRun);
    };

    await (service as any).scheduledReconcile();
    await (service as any).scheduledReconcile();

    expect(capturedIds).toHaveLength(2);
    expect(capturedIds[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(capturedIds[0]).not.toBe(capturedIds[1]);
  });

  it('passes correlationId to jobLogger.start', async () => {
    const { service, jobLogger } = makeService();

    await (service as any).scheduledReconcile();

    const startArg = jobLogger.start.mock.calls[0][0];
    expect(startArg.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('clears correlationId after scheduledReconcile() resolves', async () => {
    const { service } = makeService();
    await (service as any).scheduledReconcile();
    expect(requestContext.getCorrelationId()).toBeNull();
  });
});

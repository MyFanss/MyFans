import { NotificationRetryWorkerService } from './notification-retry-worker.service';

describe('NotificationRetryWorkerService', () => {
  let notificationsService: { processRetryQueue: jest.Mock };
  let emailOutbox: { processPending: jest.Mock };
  let worker: NotificationRetryWorkerService;

  beforeEach(() => {
    notificationsService = { processRetryQueue: jest.fn().mockResolvedValue(undefined) };
    emailOutbox = { processPending: jest.fn().mockResolvedValue(undefined) };
    worker = new NotificationRetryWorkerService(
      notificationsService as any,
      emailOutbox as any,
    );
  });

  it('drains the retry queue and the email outbox on tick', async () => {
    await worker.tick();

    expect(notificationsService.processRetryQueue).toHaveBeenCalledTimes(1);
    expect(emailOutbox.processPending).toHaveBeenCalledTimes(1);
  });

  it('does not run overlapping ticks concurrently', async () => {
    let resolveFirst!: () => void;
    notificationsService.processRetryQueue.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveFirst = resolve;
      }),
    );

    const firstTick = worker.tick();
    const secondTick = worker.tick();

    expect(notificationsService.processRetryQueue).toHaveBeenCalledTimes(1);

    resolveFirst();
    await Promise.all([firstTick, secondTick]);
  });

  it('swallows errors so a failed tick does not crash the scheduler', async () => {
    notificationsService.processRetryQueue.mockRejectedValue(new Error('boom'));
    await expect(worker.tick()).resolves.toBeUndefined();
  });

  it('allows the next tick to run after a failure', async () => {
    notificationsService.processRetryQueue.mockRejectedValueOnce(new Error('boom'));
    await worker.tick();
    await worker.tick();
    expect(notificationsService.processRetryQueue).toHaveBeenCalledTimes(2);
  });
});

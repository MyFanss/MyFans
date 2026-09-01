import { SubscriptionPauseService } from './subscription-pause.service';

describe('SubscriptionPauseService', () => {
  let service: SubscriptionPauseService;

  beforeEach(() => {
    service = new SubscriptionPauseService();
  });

  it('initializes with paused=false', () => {
    expect(service.getState().paused).toBe(false);
  });

  it('toggles paused state on pause()', () => {
    const state = service.pause('GADMIN1', 'system update');
    expect(state.paused).toBe(true);
    expect(state.pausedBy).toBe('GADMIN1');
    expect(state.reason).toBe('system update');
    expect(service.isPaused()).toBe(true);
  });

  it('toggles paused state back on unpause()', () => {
    service.pause('GADMIN1', 'maintenance');
    const state = service.unpause('GADMIN1');
    expect(state.paused).toBe(false);
    expect(state.pausedBy).toBeUndefined();
    expect(state.reason).toBeUndefined();
    expect(service.isPaused()).toBe(false);
  });

  it('handles pause when already paused (no-op)', () => {
    service.pause('GADMIN1');
    const state = service.pause('GADMIN2', 'another reason');
    expect(state.paused).toBe(true);
    expect(state.pausedBy).toBe('GADMIN1'); // Still the original admin
    expect(state.reason).toBe('system update'); // Still the original reason (updated in the test setup)
  });

  it('handles unpause when already unpaused (no-op)', () => {
    const state = service.unpause('GADMIN1');
    expect(state.paused).toBe(false);
    expect(state.pausedAt).toBeUndefined();
  });

  it('includes pausedAt as ISO 8601 timestamp when paused', () => {
    const before = new Date();
    service.pause('GADMIN1');
    const state = service.getState();
    const after = new Date();

    expect(state.pausedAt).toBeDefined();
    expect(() => new Date(state.pausedAt!)).not.toThrow();
    const pausedDate = new Date(state.pausedAt!);
    expect(pausedDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(pausedDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('clears pausedAt when unpaused', () => {
    service.pause('GADMIN1');
    expect(service.getState().pausedAt).toBeDefined();
    service.unpause('GADMIN1');
    expect(service.getState().pausedAt).toBeUndefined();
  });
});

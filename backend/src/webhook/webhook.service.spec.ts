import { WebhookService } from './webhook.service';

describe('WebhookService', () => {
  const ACTIVE = 'secret-active';
  const PREVIOUS = 'secret-previous';
  const PAYLOAD = JSON.stringify({ event: 'subscription.created' });

  let service: WebhookService;

  beforeEach(() => {
    service = new WebhookService(ACTIVE);
  });

  describe('sign & verify with active secret', () => {
    it('verifies a signature produced by sign()', () => {
      const sig = service.sign(PAYLOAD);
      expect(service.verify(PAYLOAD, sig)).toBe(true);
    });

    it('rejects a tampered payload', () => {
      const sig = service.sign(PAYLOAD);
      expect(service.verify('{"event":"tampered"}', sig)).toBe(false);
    });

    it('rejects a wrong signature', () => {
      expect(service.verify(PAYLOAD, 'deadbeef')).toBe(false);
    });
  });

  describe('rotation — active + previous within cutoff', () => {
    it('accepts a signature made with the previous secret during cutoff window', () => {
      // service starts with ACTIVE as the active secret
      // sign a payload with the current active (will become previous after rotation)
      const sigWithCurrent = service.sign(PAYLOAD);

      // rotate to a new secret — ACTIVE becomes previous
      service.rotate('new-secret', 60_000);

      // signature made with the old active (now previous) should still be accepted
      expect(service.verify(PAYLOAD, sigWithCurrent)).toBe(true);
    });

    it('accepts a signature made with the new active secret after rotation', () => {
      service.rotate('new-secret', 60_000);
      const sig = service.sign(PAYLOAD); // signs with new active
      expect(service.verify(PAYLOAD, sig)).toBe(true);
    });

    it('rejects previous secret after cutoff has passed', () => {
      // sign with current active before rotating
      const prevSig = service.sign(PAYLOAD);

      // cutoffMs = -1 ensures cutoffAt is already in the past
      service.rotate('new-secret', -1);

      expect(service.verify(PAYLOAD, prevSig)).toBe(false);
    });

    it('rejects previous secret after expirePrevious() is called', () => {
      // sign with current active (will become previous after rotation)
      const prevSig = service.sign(PAYLOAD);

      service.rotate('new-secret', 60_000);
      service.expirePrevious();

      expect(service.verify(PAYLOAD, prevSig)).toBe(false);
    });
  });

  describe('getState()', () => {
    it('returns only active when no rotation has occurred', () => {
      const state = service.getState();
      expect(state.active).toBe(ACTIVE);
      expect(state.previous).toBeUndefined();
      expect(state.cutoffAt).toBeUndefined();
    });

    it('returns active, previous, and cutoffAt after rotation', () => {
      service.rotate('new-secret', 5_000);
      const state = service.getState();
      expect(state.active).toBe('new-secret');
      expect(state.previous).toBe(ACTIVE);
      expect(state.cutoffAt).toBeGreaterThan(Date.now());
    });

    it('clears previous after expirePrevious()', () => {
      service.rotate('new-secret', 5_000);
      service.expirePrevious();
      const state = service.getState();
      expect(state.previous).toBeUndefined();
      expect(state.cutoffAt).toBeUndefined();
    });
  });
});

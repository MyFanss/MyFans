import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus, PaymentType } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

const BASE_DTO: CreatePaymentDto = {
  user_id: 'user-uuid-1',
  creator_id: 'creator-uuid-1',
  amount: 10,
  currency: 'USD',
  status: PaymentStatus.COMPLETED,
  type: PaymentType.TIP,
};

/**
 * Builds a PaymentsService backed by an in-memory store so that
 * duplicate-detection logic is exercised without a real database.
 */
function buildServiceWithStore() {
  const store = new Map<string, Payment>();
  let idCounter = 0;

  const repo = {
    findOne: jest.fn(async ({ where }: { where: { payment_reference?: string } }) => {
      if (!where.payment_reference) return null;
      for (const p of store.values()) {
        if (p.payment_reference === where.payment_reference) return p;
      }
      return null;
    }),
    create: jest.fn((dto: Partial<Payment>) => ({ ...dto } as Payment)),
    save: jest.fn(async (entity: Payment) => {
      const saved = { id: `payment-${++idCounter}`, ...entity } as Payment;
      store.set(saved.id, saved);
      return saved;
    }),
  };

  let service: PaymentsService;

  return {
    async init() {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentsService,
          { provide: getRepositoryToken(Payment), useValue: repo },
        ],
      }).compile();
      service = module.get<PaymentsService>(PaymentsService);
      return service;
    },
    get service() {
      return service;
    },
    store,
    repo,
  };
}

describe('PaymentsService – property-based tests', () => {
  // Feature: duplicate-earnings-prevention, Property 1: round-trip reference preservation
  it('Property 1: returned record preserves the payment_reference', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (ref) => {
        const ctx = buildServiceWithStore();
        const svc = await ctx.init();

        const result = await svc.recordPayment({ ...BASE_DTO, payment_reference: ref });

        expect(result.payment_reference).toBe(ref);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: duplicate-earnings-prevention, Property 2: duplicate reference rejection
  it('Property 2: second call with the same reference throws ConflictException', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (ref) => {
        const ctx = buildServiceWithStore();
        const svc = await ctx.init();

        await svc.recordPayment({ ...BASE_DTO, payment_reference: ref });

        await expect(
          svc.recordPayment({ ...BASE_DTO, payment_reference: ref }),
        ).rejects.toThrow(ConflictException);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: duplicate-earnings-prevention, Property 3: conflict message contains the reference
  it('Property 3: ConflictException message contains the duplicate reference', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (ref) => {
        const ctx = buildServiceWithStore();
        const svc = await ctx.init();

        await svc.recordPayment({ ...BASE_DTO, payment_reference: ref });

        let caught: unknown;
        try {
          await svc.recordPayment({ ...BASE_DTO, payment_reference: ref });
        } catch (e) {
          caught = e;
        }

        expect(caught).toBeInstanceOf(ConflictException);
        expect((caught as ConflictException).message).toContain(ref);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: duplicate-earnings-prevention, Property 4: null reference allows multiple records
  it('Property 4: N payments without a reference all succeed', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 10 }), async (n) => {
        const ctx = buildServiceWithStore();
        const svc = await ctx.init();

        const results = await Promise.all(
          Array.from({ length: n }, () => svc.recordPayment({ ...BASE_DTO })),
        );

        expect(results).toHaveLength(n);
        results.forEach((r) => expect(r).toBeDefined());
      }),
      { numRuns: 100 },
    );
  });
});

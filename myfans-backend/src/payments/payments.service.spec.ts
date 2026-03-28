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

const makePaymentRepo = (existing: Payment | null = null) => ({
  findOne: jest.fn().mockResolvedValue(existing),
  create: jest.fn((dto) => ({ ...dto })),
  save: jest.fn().mockImplementation(async (e) => ({ id: 'payment-uuid-1', ...e })),
});

async function buildService(repoOverrides: Partial<ReturnType<typeof makePaymentRepo>> = {}) {
  const repo = { ...makePaymentRepo(), ...repoOverrides };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PaymentsService,
      { provide: getRepositoryToken(Payment), useValue: repo },
    ],
  }).compile();

  return { service: module.get<PaymentsService>(PaymentsService), repo };
}

describe('PaymentsService', () => {
  describe('recordPayment', () => {
    it('returns the saved record with the same payment_reference (Property 1)', async () => {
      const { service } = await buildService();
      const dto = { ...BASE_DTO, payment_reference: 'ref-abc-123' };

      const result = await service.recordPayment(dto);

      expect(result.payment_reference).toBe('ref-abc-123');
    });

    it('throws ConflictException when the same reference is used twice (Property 2)', async () => {
      const existingPayment = { id: 'existing-uuid', payment_reference: 'ref-dup' } as Payment;
      const { service } = await buildService({
        findOne: jest.fn().mockResolvedValue(existingPayment),
      });
      const dto = { ...BASE_DTO, payment_reference: 'ref-dup' };

      await expect(service.recordPayment(dto)).rejects.toThrow(ConflictException);
    });

    it('ConflictException message contains the duplicate reference (Property 3)', async () => {
      const ref = 'ref-conflict-xyz';
      const existingPayment = { id: 'existing-uuid', payment_reference: ref } as Payment;
      const { service } = await buildService({
        findOne: jest.fn().mockResolvedValue(existingPayment),
      });
      const dto = { ...BASE_DTO, payment_reference: ref };

      await expect(service.recordPayment(dto)).rejects.toThrow(
        `Duplicate payment_reference: ${ref}`,
      );
    });

    it('succeeds when no payment_reference is provided (Property 4 - edge case)', async () => {
      const { service, repo } = await buildService();
      const dto = { ...BASE_DTO };

      const result = await service.recordPayment(dto);

      expect(repo.findOne).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('allows multiple payments without a reference (Property 4 - edge case)', async () => {
      const { service, repo } = await buildService();
      const dto = { ...BASE_DTO };

      const first = await service.recordPayment(dto);
      const second = await service.recordPayment(dto);

      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(repo.findOne).not.toHaveBeenCalled();
    });
  });
});

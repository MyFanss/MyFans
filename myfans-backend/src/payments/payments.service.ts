import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
  ) {}

  async recordPayment(dto: CreatePaymentDto): Promise<Payment> {
    const payment = this.paymentsRepository.create({
      ...dto,
      amount: dto.amount.toString(),
    });
    return this.paymentsRepository.save(payment);
  }

  async findById(id: string): Promise<Payment | null> {
    return this.paymentsRepository.findOne({ where: { id } });
  }

  async findByUser(userId: string): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findByCreator(creatorId: string): Promise<Payment[]> {
    return this.paymentsRepository.find({
      where: { creator_id: creatorId },
      order: { created_at: 'DESC' },
    });
  }
}

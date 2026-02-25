import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EarningsService } from './earnings.service';
import { EarningsController } from './earnings.controller';
import { Payment } from '../payments/entities/payment.entity';
import { Withdrawal } from './entities/withdrawal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Withdrawal])],
  providers: [EarningsService],
  controllers: [EarningsController],
  exports: [EarningsService],
})
export class EarningsModule {}

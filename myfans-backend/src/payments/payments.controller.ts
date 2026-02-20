import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  // POST /payments (internal/webhook): record payment (add API key or internal-only guard later)
  recordPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.recordPayment(dto);
  }

  @Get()
  @UseGuards(AuthGuard)
  // GET /payments (auth): list current user's payments
  getMyPayments(@CurrentUser() user: User) {
    return this.paymentsService.findByUser(user.id);
  }
}

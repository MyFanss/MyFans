import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { InMemoryIdempotencyStore } from './checkout.controller';
import { IDEMPOTENCY_STORE } from './checkout.controller';

@Module({
  controllers: [CheckoutController],
  providers: [
    {
      provide: IDEMPOTENCY_STORE,
      useClass: InMemoryIdempotencyStore,
    },
  ],
})
export class CheckoutModule {}

import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { RPC_BALANCE_ADAPTER, MockRpcAdapter } from './rpc-adapter';

@Module({
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    {
      provide: RPC_BALANCE_ADAPTER,
      useClass: MockRpcAdapter,
    },
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}

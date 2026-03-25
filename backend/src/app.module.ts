import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CreatorsModule } from './creators/creators.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [AuthModule, CreatorsModule, SubscriptionsModule, HealthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

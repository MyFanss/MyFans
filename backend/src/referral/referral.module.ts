import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralCode } from './entities/referral-code.entity';
import { ReferralRedemption } from './entities/referral-redemption.entity';
import { ReferralReward } from './entities/referral-reward.entity';
import { ReferralService } from './referral.service';
import { ReferralController } from './referral.controller';
import { ReferralAttributionConsumer } from './referral-attribution.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReferralCode,
      ReferralRedemption,
      ReferralReward,
    ]),
  ],
  controllers: [ReferralController],
  providers: [ReferralService, ReferralAttributionConsumer],
  exports: [ReferralService],
})
export class ReferralModule {}

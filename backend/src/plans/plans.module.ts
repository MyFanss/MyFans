import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PlanMetadata } from './entities/plan-metadata.entity';
import { PlansService } from './plans.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlanMetadata])],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}

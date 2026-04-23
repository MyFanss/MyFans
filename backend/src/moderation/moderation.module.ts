import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationFlag } from './entities/moderation-flag.entity';
import { ModerationAuditLog } from './entities/moderation-audit-log.entity';
import { ModerationService } from './moderation.service';
import { ModerationSlaService } from './moderation-sla.service';
import { ModerationController } from './moderation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ModerationFlag, ModerationAuditLog])],
  controllers: [ModerationController],
  providers: [ModerationService, ModerationSlaService],
  exports: [ModerationService, ModerationSlaService],
})
export class ModerationModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationFlag } from './entities/moderation-flag.entity';
import { ModerationAuditLog } from './entities/moderation-audit-log.entity';
import { ModerationService } from './moderation.service';
import { ModerationSlaService } from './moderation-sla.service';
import { ModerationController } from './moderation.controller';
import { AdminAuditModule } from '../admin-audit/admin-audit.module';
import { LoggingModule } from '../common/logging.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModerationFlag, ModerationAuditLog]),
    AdminAuditModule,
    LoggingModule,
  ],
  controllers: [ModerationController],
  providers: [ModerationService, ModerationSlaService],
  exports: [ModerationService, ModerationSlaService],
})
export class ModerationModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditAdminController } from './audit.admin.controller';
import { AuditAdminGuard } from './audit-admin.guard';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';
import { LoggingModule } from '../common/logging.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), LoggingModule],
  controllers: [AuditAdminController],
  providers: [AuditService, AuditAdminGuard],
  exports: [AuditService],
})
export class AuditModule {}

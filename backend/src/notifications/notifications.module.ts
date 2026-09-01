import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { Notification } from './entities/notification.entity';
import { EmailOutboxEntry } from './entities/email-outbox-entry.entity';
import { NotificationRetryJobEntity } from './entities/notification-retry-job.entity';
import { NotificationDigestWindowEntity } from './entities/notification-digest-window.entity';
import { NotificationsController } from './notifications.controller';
import { SubscriptionLifecycleNotifierService } from './subscription-lifecycle-notifier.service';
import { NotificationsService } from './notifications.service';
import { NotificationRetryStoreService } from './notification-retry-store.service';
import { NotificationDigestStoreService } from './notification-digest-store.service';
import { EmailOutboxService } from './email-outbox.service';
import { EmailOutboxAdminController } from './email-outbox-admin.controller';
import { NotificationRetryWorkerService } from './notification-retry-worker.service';
import { EMAIL_ADAPTER } from './adapters/email-adapter.interface';
import { ConsoleEmailAdapter } from './adapters/console-email.adapter';
import { SmtpEmailAdapter } from './adapters/smtp-email.adapter';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    ScheduleModule,
    TypeOrmModule.forFeature([
      Notification,
      EmailOutboxEntry,
      NotificationRetryJobEntity,
      NotificationDigestWindowEntity,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController, EmailOutboxAdminController],
  providers: [
    NotificationsService,
    SubscriptionLifecycleNotifierService,
    NotificationRetryStoreService,
    NotificationDigestStoreService,
    EmailOutboxService,
    NotificationRetryWorkerService,
    ConsoleEmailAdapter,
    SmtpEmailAdapter,
    {
      // Real mail delivery only when SMTP_HOST is explicitly configured;
      // otherwise fall back to logging emails to the console (dev/test default).
      provide: EMAIL_ADAPTER,
      useFactory: (consoleAdapter: ConsoleEmailAdapter, smtpAdapter: SmtpEmailAdapter) =>
        process.env.SMTP_HOST ? smtpAdapter : consoleAdapter,
      inject: [ConsoleEmailAdapter, SmtpEmailAdapter],
    },
  ],
  exports: [NotificationsService, EmailOutboxService],
})
export class NotificationsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { UsersModule } from './users/users.module';
import { CreatorsModule } from './creators/creators.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PostsModule } from './posts/posts.module';
import { MessagesModule } from './messages/messages.module';
import { PaymentsModule } from './payments/payments.module';
import { CommentsModule } from './comments/comments.module';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        if (configService.get<string>('NODE_ENV') === 'test') {
          return {};
        }
        const store = await redisStore({
          url: configService.get<string>('redis.url'),
          ttl: (configService.get<number>('cache.creators_ttl') ?? 300) * 1000,
        });

        return { store };
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.get<string>('NODE_ENV') === 'test'
          ? {
            type: 'better-sqlite3',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
          }
          : {
            type: 'postgres',
            host: configService.get<string>('DB_HOST'),
            port: parseInt(configService.get<string>('DB_PORT', '5432'), 10),
            username: configService.get<string>('DB_USERNAME'),
            password: configService.get<string>('DB_PASSWORD'),
            database: configService.get<string>('DB_DATABASE'),
            autoLoadEntities: true,
            synchronize:
              configService.get<string>('NODE_ENV') !== 'production',
          },
    }),
    UsersModule,
    CreatorsModule,
    SubscriptionsModule,
    PostsModule,
    MessagesModule,
    PaymentsModule,
    CommentsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

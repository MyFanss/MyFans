import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
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
              synchronize: configService.get<string>('NODE_ENV') !== 'production',
            },
    }),
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

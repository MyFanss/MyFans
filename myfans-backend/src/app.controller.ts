import { Body, Controller, Get, Post, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { TestValidationDto } from './app/dto/test-validation.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health/redis')
  async getHealthRedis() {
    try {
      // @ts-ignore - store.client might not be in types but exists in redis-yet
      const client = (this.cacheManager.store as any).client;
      if (client) {
        await client.ping();
      } else {
        // Fallback check
        await this.cacheManager.set('health-check', 'ok', 1000);
        await this.cacheManager.del('health-check');
      }
      return { status: 'ok', redis: 'connected' };
    } catch (error: any) {
      return {
        status: 'error',
        redis: 'disconnected',
        message: error?.message || 'Unknown error',
      };
    }
  }

  @Get('health/db')
  async getHealthDb() {
    try {
      if (!this.dataSource.isInitialized) {
        return { status: 'error', db: 'disconnected', message: 'DataSource not initialized' };
      }
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', db: 'connected' };
    } catch (error: any) {
      return {
        status: 'error',
        db: 'disconnected',
        message: error?.message || 'Unknown error',
      };
    }
  }

  @Post('validate-test')
  validateTest(@Body() dto: TestValidationDto) {
    return { received: dto };
  }
}

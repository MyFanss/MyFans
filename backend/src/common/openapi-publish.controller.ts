import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import type { Response } from 'express';
import { AppModule } from '../app.module';
import { Public } from './decorators/public.decorator';
import { buildOpenApiConfig } from './openapi.config';

@ApiTags('system')
@Controller({ path: 'system', version: '1' })
export class OpenAPIController {
  @Get('openapi.json')
  @Public()
  @ApiOperation({ summary: 'Get the raw OpenAPI JSON specification' })
  @ApiResponse({ status: 200, description: 'OpenAPI specification' })
  async getOpenApi(@Res() res: Response) {
    const app = await NestFactory.create(AppModule, { logger: false });
    const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
    await app.close();
    return res.json(document);
  }
}

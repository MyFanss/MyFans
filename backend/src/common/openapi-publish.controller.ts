import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { Response } from 'express';
import { AppModule } from '../app.module';

@ApiTags('system')
@Controller({ path: 'system', version: '1' })
export class OpenAPIController {
    @Get('openapi.json')
    @ApiOperation({ summary: 'Get the raw OpenAPI JSON specification' })
    @ApiResponse({ status: 200, description: 'OpenAPI specification' })
    async getOpenApi(@Res() res: Response) {
        const app = await NestFactory.create(AppModule, { logger: false });
        const config = new DocumentBuilder()
            .setTitle('MyFans API')
            .setDescription('MyFans backend REST API')
            .setVersion('1.0')
            .addBearerAuth()
            .build();
        const document = SwaggerModule.createDocument(app, config);
        await app.close();
        return res.json(document);
    }
}

import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { TestValidationDto } from './app/dto/test-validation.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('validate-test')
  validateTest(@Body() dto: TestValidationDto) {
    return { received: dto };
  }
}

import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { CreatorsService } from './creators.service';

@Controller('creators')
export class CreatorsController {
  constructor(private creatorsService: CreatorsService) {}

  @Post('plans')
  createPlan(@Body() body: { creator: string; asset: string; amount: string; intervalDays: number }) {
    return this.creatorsService.createPlan(body.creator, body.asset, body.amount, body.intervalDays);
  }

  @Get(':address/plans')
  getPlans(@Param('address') address: string) {
    return this.creatorsService.getCreatorPlans(address);
  }
}

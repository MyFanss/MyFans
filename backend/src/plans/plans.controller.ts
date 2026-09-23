import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePlanMetadataDto } from './dto/create-plan-metadata.dto';
import { UpdatePlanMetadataDto } from './dto/update-plan-metadata.dto';
import { PlanMetadata } from './entities/plan-metadata.entity';
import { PlansService } from './plans.service';

interface AuthenticatedRequest extends Request {
  user: { id: string; address?: string };
}

@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create plan metadata linked to an on-chain plan_id' })
  @ApiResponse({ status: HttpStatus.CREATED, type: PlanMetadata })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'plan_id already has metadata' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Caller is not the plan creator' })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePlanMetadataDto,
  ): Promise<PlanMetadata> {
    return this.plansService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Publicly list plan metadata, optionally filtered by creator' })
  @ApiQuery({ name: 'creator', required: false, description: 'Creator id or wallet address' })
  @ApiResponse({ status: HttpStatus.OK, type: [PlanMetadata] })
  list(@Query('creator') creator?: string): Promise<PlanMetadata[]> {
    return this.plansService.listByCreator(creator);
  }

  @Get(':planId')
  @ApiOperation({ summary: 'Read plan metadata by on-chain plan_id' })
  @ApiParam({ name: 'planId', description: 'On-chain plan_id' })
  @ApiResponse({ status: HttpStatus.OK, type: PlanMetadata })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  findOne(@Param('planId') planId: string): Promise<PlanMetadata> {
    return this.plansService.findByPlanId(planId);
  }

  @Put(':planId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update plan metadata (creator only)' })
  @ApiParam({ name: 'planId', description: 'On-chain plan_id' })
  @ApiResponse({ status: HttpStatus.OK, type: PlanMetadata })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Caller is not the plan creator' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('planId') planId: string,
    @Body() dto: UpdatePlanMetadataDto,
  ): Promise<PlanMetadata> {
    return this.plansService.update(req.user.id, planId, dto);
  }

  @Delete(':planId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete plan metadata (creator only)' })
  @ApiParam({ name: 'planId', description: 'On-chain plan_id' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Caller is not the plan creator' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('planId') planId: string,
  ): Promise<void> {
    return this.plansService.remove(req.user.id, planId);
  }
}

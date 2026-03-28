import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreatorsService } from './creators.service';
import { CreatorDashboardService } from './creator-dashboard.service';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { PlanDto } from './dto/plan.dto';
import { SearchCreatorsDto } from './dto/search-creators.dto';
import { PublicCreatorDto } from './dto/public-creator.dto';
import { DashboardQueryDto } from './dto/creator-dashboard.dto';

@ApiTags('creators')
@Controller({ path: 'creators', version: '1' })
export class CreatorsController {
  constructor(
    private creatorsService: CreatorsService,
    private dashboardService: CreatorDashboardService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search creators by display name or username' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of creators matching search query',
    type: PaginatedResponseDto<PublicCreatorDto>,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  searchCreators(
    @Query() searchDto: SearchCreatorsDto,
  ): Promise<PaginatedResponseDto<PublicCreatorDto>> {
    return this.creatorsService.searchCreators(searchDto);
  }

  @Post('plans')
  @ApiOperation({ summary: 'Create a new subscription plan' })
  @ApiResponse({ status: 201, description: 'Plan created successfully' })
  createPlan(
    @Body()
    body: {
      creator: string;
      asset: string;
      amount: string;
      intervalDays: number;
    },
  ) {
    return this.creatorsService.createPlan(
      body.creator,
      body.asset,
      body.amount,
      body.intervalDays,
    );
  }

  @Get('plans')
  @ApiOperation({ summary: 'List all plans (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated plans list' })
  getAllPlans(
    @Query() pagination: PaginationDto,
  ): PaginatedResponseDto<PlanDto> {
    return this.creatorsService.findAllPlans(pagination);
  }

  @Get(':address/plans')
  @ApiOperation({ summary: 'List creator plans (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated creator plans list' })
  getPlans(
    @Param('address') address: string,
    @Query() pagination: PaginationDto,
  ): PaginatedResponseDto<PlanDto> {
    return this.creatorsService.findCreatorPlans(address, pagination);
  }

  @Get(':address/dashboard')
  @ApiOperation({ summary: 'Creator revenue and subscriber metrics dashboard' })
  @ApiResponse({ status: 200, description: 'Aggregated creator dashboard metrics' })
  getDashboard(
    @Param('address') address: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getDashboard(address, query);
  }
}

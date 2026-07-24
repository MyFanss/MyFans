import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CreatorsService } from './creators.service';
import { CreatorDashboardService } from './creator-dashboard.service';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { PlanDto } from './dto/plan.dto';
import { SearchCreatorsDto } from './dto/search-creators.dto';
import { PublicCreatorDto } from './dto/public-creator.dto';
import { DashboardQueryDto } from './dto/creator-dashboard.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('creators')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Controller({ path: 'creators', version: '1' })
export class CreatorsController {
  constructor(
    private creatorsService: CreatorsService,
    private dashboardService: CreatorDashboardService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Search creators by display name or username',
    description:
      'Cursor-paginated creator search. Pass `cursor` and `limit` query params; responses include `data`, `limit`, `nextCursor`, and `hasMore`.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor (`nextCursor` from the previous page)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (default 20, max 100)',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search by display name or handle (username) prefix',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Alias for q — search by display name or handle prefix',
  })
  @ApiResponse({
    status: 200,
    description:
      'Cursor-paginated list of creators matching search query (`data`, `limit`, `nextCursor`, `hasMore`)',
    type: PaginatedResponseDto<PublicCreatorDto>,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
    schema: {
      example: { statusCode: 400, message: 'Invalid query parameters' },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: { example: { statusCode: 500, message: 'Internal server error' } },
  })
  searchCreators(
    @Query() searchDto: SearchCreatorsDto,
  ): Promise<PaginatedResponseDto<PublicCreatorDto>> {
    return this.creatorsService.searchCreators(searchDto);
  }

  @Get('username/:username')
  @ApiOperation({
    summary: 'Get a single public creator profile by exact username',
    description:
      'Used by the creator profile page. Returns 404 when the username does not belong to a creator.',
  })
  @ApiResponse({
    status: 200,
    description: 'Public creator profile',
    type: PublicCreatorDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Creator not found',
    schema: { example: { statusCode: 404, message: 'Creator not found' } },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: { example: { statusCode: 500, message: 'Internal server error' } },
  })
  async getCreatorByUsername(
    @Param('username') username: string,
  ): Promise<PublicCreatorDto> {
    const creator = await this.creatorsService.getCreatorByUsername(username);
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }
    return creator;
  }

  @Get('list')
  @ApiOperation({
    summary: 'List all creator plans, optionally merged with on-chain state',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of plans with optional chain sync status',
    type: [PlanDto],
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: { example: { statusCode: 500, message: 'Internal server error' } },
  })
  listCreators(@Query('chain') chain?: string): Promise<PlanDto[]> {
    return this.creatorsService.listCreators(chain === 'true');
  }

  @Post('plans')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new subscription plan' })
  @ApiResponse({ status: 201, description: 'Plan created successfully' })
  createPlan(@Body() planDto: CreatePlanDto) {
    return this.creatorsService.createPlan(
      planDto.creator,
      planDto.asset,
      planDto.amount,
      planDto.intervalDays,
    );
  }

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'List all plans (paginated)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated plans list',
    type: PaginatedResponseDto<PlanDto>,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid pagination parameters',
    schema: {
      example: { statusCode: 400, message: 'Invalid pagination parameters' },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: { example: { statusCode: 500, message: 'Internal server error' } },
  })
  getAllPlans(
    @Query() pagination: PaginationDto,
  ): PaginatedResponseDto<PlanDto> {
    return this.creatorsService.findAllPlans(pagination);
  }

  @Get(':address/plans')
  @Public()
  @ApiOperation({ summary: 'List creator plans (paginated)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated creator plans list',
    type: PaginatedResponseDto<PlanDto>,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid pagination parameters',
    schema: {
      example: { statusCode: 400, message: 'Invalid pagination parameters' },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: { example: { statusCode: 500, message: 'Internal server error' } },
  })
  getPlans(
    @Param('address') address: string,
    @Query() pagination: PaginationDto,
  ): PaginatedResponseDto<PlanDto> {
    return this.creatorsService.findCreatorPlans(address, pagination);
  }

  @Get(':address/dashboard')
  @ApiOperation({ summary: 'Creator revenue and subscriber metrics dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Aggregated creator dashboard metrics',
  })
  @ApiResponse({
    status: 404,
    description: 'Creator not found',
    schema: { example: { statusCode: 404, message: 'Creator not found' } },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: { example: { statusCode: 500, message: 'Internal server error' } },
  })
  getDashboard(
    @Param('address') address: string,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getDashboard(address, query);
  }
}

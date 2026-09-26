import { Controller, Get, Param, Query, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { CreatorsService } from './creators.service';
import { CreatorAuthGuard } from '../auth/creator-auth.guard';

interface DashboardSummary {
  creatorId: string;
  subscribers: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  currency: string;
  updatedAt: string;
}

interface CreatorListItem {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  subscriberCount: number;
  isVerified: boolean;
}

interface CreatorsListResponse {
  creators: CreatorListItem[];
  total: number;
  updatedAt: string;
}

interface CreatorPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
  isActive: boolean;
}

interface CreatorPlansResponse {
  creatorId: string;
  plans: CreatorPlan[];
  updatedAt: string;
}

interface CreatorAccessResponse {
  creatorId: string;
  hasAccess: boolean;
  subscriptionStatus: string;
  planId: string | null;
  teaser: string | null;
  contentCid: string | null;
  updatedAt: string;
}

@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get()
  async listCreators(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('q') q?: string,
  ): Promise<CreatorsListResponse> {
    const parsedLimit = Number.parseInt(limit ?? '', 10);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 50)
      : 12;

    // Trim and cap the search term; ignore tiny queries so the landing page
    // only issues a live search once the user has typed something meaningful.
    const rawQuery = (q ?? '').trim();
    const searchQuery = rawQuery.length >= 2 ? rawQuery.slice(0, 100) : null;

    const creators = await this.creatorsService.listCreators({
      limit: safeLimit,
      cursor: cursor ?? null,
      query: searchQuery,
    });

    return {
      creators: creators.map((creator) => ({
        id: creator.id,
        handle: creator.handle,
        displayName: creator.displayName,
        avatarUrl: creator.avatarUrl ?? null,
        bio: creator.bio ?? null,
        subscriberCount: creator.subscriberCount ?? 0,
        isVerified: creator.isVerified ?? false,
      })),
      total: creators.length,
      updatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/plans')
  async getCreatorPlans(@Param('id') id: string): Promise<CreatorPlansResponse> {
    const plans = await this.creatorsService.getCreatorPlans(id);

    return {
      creatorId: id,
      plans: plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description ?? null,
        price: plan.price ?? 0,
        currency: plan.currency ?? 'USD',
        interval: plan.interval ?? 'month',
        isActive: plan.isActive ?? true,
      })),
      updatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/access')
  async getCreatorAccess(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<CreatorAccessResponse> {
    const viewerId = (req as Request & { user?: { id: string } }).user?.id ?? null;

    const access = await this.creatorsService.getCreatorAccess(id, viewerId);

    // Never ship the full content CID to a viewer without access; only a teaser.
    const hasAccess = access.hasAccess === true;

    return {
      creatorId: id,
      hasAccess,
      subscriptionStatus: access.subscriptionStatus ?? 'none',
      planId: access.planId ?? null,
      teaser: access.teaser ?? null,
      contentCid: hasAccess ? access.contentCid ?? null : null,
      updatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/dashboard-summary')
  @UseGuards(CreatorAuthGuard)
  async getDashboardSummary(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('simulateError') simulateError?: string,
  ): Promise<DashboardSummary> {
    const creatorId = (req as Request & { creator?: { id: string } }).creator?.id;
    if (!creatorId || creatorId !== id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    // Error-simulate flags are test-only and must never activate in production.
    if (simulateError === 'true' && process.env.NODE_ENV === 'test') {
      throw new HttpException('Simulated dashboard failure', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const summary = await this.creatorsService.getDashboardSummary(id);

    return {
      creatorId: id,
      subscribers: summary.subscribers ?? 0,
      activeSubscriptions: summary.activeSubscriptions ?? 0,
      monthlyRevenue: summary.monthlyRevenue ?? 0,
      currency: summary.currency ?? 'USD',
      updatedAt: new Date().toISOString(),
    };
  }
}

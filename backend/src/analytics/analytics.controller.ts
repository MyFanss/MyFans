import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { PaymentAnalyticsQueryDto } from './dto/payment-analytics-query.dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { RolesGuard } from '../auth-module/guards/roles.guard';
import { Roles } from '../auth-module/decorators/roles.decorator';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /v1/analytics/payments
   * Paginated list of completed payments, filterable by creator and date range.
   * Non-admins are always scoped to their own aggregates (see `scopeToOwner`).
   */
  @Get('payments')
  @Roles(UserRole.ADMIN, UserRole.CREATOR)
  @ApiOperation({ summary: 'List completed payments with optional filters' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: { example: { statusCode: 401, message: 'Unauthorized' } },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden – non-admins may only view their own aggregates',
    schema: {
      example: {
        statusCode: 403,
        message: 'You can only view your own analytics',
      },
    },
  })
  getPayments(
    @Query() query: PaymentAnalyticsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.scopeToOwner(user, query);
    return this.analyticsService.getPayments(query);
  }

  /**
   * GET /v1/analytics/earnings
   * Aggregated earnings per creator (gross, fees, net), filterable by creator and date range.
   * Non-admins are always scoped to their own aggregates (see `scopeToOwner`).
   */
  @Get('earnings')
  @Roles(UserRole.ADMIN, UserRole.CREATOR)
  @ApiOperation({ summary: 'Aggregated creator earnings' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    schema: { example: { statusCode: 401, message: 'Unauthorized' } },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden – non-admins may only view their own aggregates',
    schema: {
      example: {
        statusCode: 403,
        message: 'You can only view your own analytics',
      },
    },
  })
  getEarnings(
    @Query() query: PaymentAnalyticsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.scopeToOwner(user, query);
    return this.analyticsService.getEarnings(query);
  }

  /**
   * Admins may query any (or no) creator filter. Everyone else is confined
   * to their own aggregates: an explicit `creator` filter for someone else
   * is rejected with 403, and an omitted filter is auto-scoped to the
   * caller so cross-creator data is never returned.
   */
  private scopeToOwner(
    user: AuthenticatedUser,
    query: PaymentAnalyticsQueryDto,
  ): void {
    if (user.role === UserRole.ADMIN) {
      return;
    }
    if (query.creator && query.creator !== user.userId) {
      throw new ForbiddenException('You can only view your own analytics');
    }
    query.creator = user.userId;
  }
}

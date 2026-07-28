import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EarningsService } from './earnings.service';
import { EarningsQueryDto } from './dto/earnings-query.dto';
import { WithdrawalRequestDto } from './dto/withdrawal-request.dto';
import { WithdrawalResponseDto } from './dto/withdrawal-response.dto';
import { JwtAuthGuard } from '../auth-module/guards/jwt-auth.guard';
import { RolesGuard } from '../auth-module/guards/roles.guard';
import { Roles } from '../auth-module/decorators/roles.decorator';
import { CurrentUser } from '../auth-module/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthenticatedUser {
  userId: string;
  role: UserRole;
}

const UNAUTHORIZED_RESPONSE = {
  status: 401,
  description: 'Unauthorized',
  schema: { example: { statusCode: 401, message: 'Unauthorized' } },
} as const;

const FORBIDDEN_RESPONSE = {
  status: 403,
  description: 'Forbidden – only creators may access their own earnings',
  schema: { example: { statusCode: 403, message: 'Forbidden resource' } },
} as const;

/**
 * Creator-facing earnings endpoints. Always scoped to the authenticated
 * creator — there is no admin/cross-creator query surface here (see
 * AnalyticsController for the admin aggregation view).
 */
@ApiTags('earnings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CREATOR)
@Controller({ path: 'earnings', version: '1' })
export class EarningsController {
  constructor(private readonly earningsService: EarningsService) {}

  @Get('summary')
  @ApiOperation({ summary: "Aggregated summary of the caller's earnings, per asset" })
  @ApiResponse(UNAUTHORIZED_RESPONSE)
  @ApiResponse(FORBIDDEN_RESPONSE)
  getSummary(
    @Query() query: EarningsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.earningsService.getSummary(user.userId, query);
  }

  @Get('breakdown')
  @ApiOperation({ summary: "Paginated per-payment breakdown of the caller's earnings" })
  @ApiResponse(UNAUTHORIZED_RESPONSE)
  @ApiResponse(FORBIDDEN_RESPONSE)
  getBreakdown(
    @Query() query: EarningsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.earningsService.getBreakdown(user.userId, query);
  }

  @Post('withdraw')
  @ApiOperation({
    summary: 'Request a withdrawal (stub)',
    description:
      'Records a withdrawal request for manual review. Automated payout ' +
      'processing is not yet implemented — this endpoint exists so ' +
      'frontend integration can proceed against a stable contract.',
  })
  @ApiResponse({ status: 201, description: 'Withdrawal request recorded', type: WithdrawalResponseDto })
  @ApiResponse(UNAUTHORIZED_RESPONSE)
  @ApiResponse(FORBIDDEN_RESPONSE)
  requestWithdrawal(
    @Body() request: WithdrawalRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): WithdrawalResponseDto {
    return this.earningsService.requestWithdrawal(user.userId, request);
  }
}

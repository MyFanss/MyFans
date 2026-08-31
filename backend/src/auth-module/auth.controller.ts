import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req: any) {
    return this.authService.findById(req.user.userId);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] List users (paginated)' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor (nextCursor from previous page)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page (default 20, max 100)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-based, default 1)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of users',
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async getUsers(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<any>> {
    return this.authService.findAllUsers(pagination);
  }
}

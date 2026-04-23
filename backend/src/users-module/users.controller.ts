import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto';
import { UserProfileDto } from './user-profile.dto';
import { PaginatedUsersResponseDto } from './paginated-users-response.dto';

@ApiTags('Users')
@Controller({ path: 'users', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // POST /users
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created', type: UserProfileDto })
  @ApiResponse({ status: 409, description: 'Email or username already in use' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  create(@Body() dto: CreateUserDto): Promise<UserProfileDto> {
    return this.usersService.create(dto);
  }

  // GET /users
  @Get()
  @ApiOperation({ summary: 'List all users (paginated)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated users list (cursor-based)',
    type: PaginatedUsersResponseDto,
  })
  findAll(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<UserProfileDto>> {
    return this.usersService.findAll(pagination);
  }

  // GET /users/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get a single user by ID' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User profile', type: UserProfileDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserProfileDto> {
    return this.usersService.findOne(id);
  }

  // PATCH /users/:id
  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'Updated user profile', type: UserProfileDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email or username already in use' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserProfileDto> {
    return this.usersService.update(id, dto);
  }

  // DELETE /users/:id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 204, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}

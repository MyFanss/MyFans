export * from './create-user.dto';
export * from './update-user.dto';
export * from './update-onboarding.dto';
export * from './user-profile.dto';
export * from './delete-account.dto';
import type { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import type { UserProfileDto } from './user-profile.dto';

export type PaginatedUsersDto = PaginatedResponseDto<UserProfileDto>;

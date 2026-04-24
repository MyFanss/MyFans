export * from './user-profile.dto';
export * from './paginated-users-response.dto';

import { PaginatedResponseDto } from '../common/dto';
import { UserProfileDto } from './user-profile.dto';

/** Alias for compatibility with frontend alignment request */
export type PaginatedUsersDto = PaginatedResponseDto<UserProfileDto>;

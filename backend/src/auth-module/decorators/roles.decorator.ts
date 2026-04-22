import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../common/enums';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
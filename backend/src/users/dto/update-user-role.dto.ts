import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole, description: 'New role to assign to the user' })
  @IsEnum(UserRole)
  role: UserRole;
}

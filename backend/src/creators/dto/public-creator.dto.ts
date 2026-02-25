import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { Creator } from '../entities/creator.entity';

export class PublicCreatorDto {
  @ApiProperty({ description: 'Creator user ID' })
  id: string;

  @ApiProperty({ description: 'Creator display name' })
  display_name: string;

  @ApiProperty({ description: 'Creator username handle' })
  username: string;

  @ApiProperty({ description: 'Creator avatar URL', nullable: true })
  avatar_url: string | null;

  @ApiProperty({ description: 'Creator bio', nullable: true })
  bio: string | null;

  constructor(user: User, creator?: Creator) {
    this.id = user.id;
    this.display_name = user.display_name;
    this.username = user.username;
    this.avatar_url = user.avatar_url;
    this.bio = creator?.bio || null;
  }
}

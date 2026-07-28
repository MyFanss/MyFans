import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class FavoriteDto {
  @ApiProperty({ description: 'Unique favorite record identifier' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'ID of the user who favorited the creator' })
  @Expose()
  userId: string;

  @ApiProperty({ description: 'ID of the favorited creator' })
  @Expose()
  creatorId: string;

  @ApiProperty({ description: 'Favorite creation timestamp' })
  @Expose()
  createdAt: Date;
}

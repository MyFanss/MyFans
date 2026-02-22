import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CommentDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  content: string;

  @ApiProperty()
  @Expose()
  authorId: string;

  @ApiProperty()
  @Expose()
  postId: string;

  @ApiPropertyOptional()
  @Expose()
  parentId: string | null;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}

export class CreateCommentDto {
  @ApiProperty()
  content: string;

  @ApiProperty()
  postId: string;

  @ApiPropertyOptional()
  parentId?: string;
}

export class UpdateCommentDto {
  @ApiPropertyOptional()
  content?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CommentDto {
  @ApiProperty({ example: 'comment-123', description: 'Unique comment identifier' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'Great post!', description: 'Comment text body' })
  @Expose()
  content: string;

  @ApiProperty({ example: 'author-456', description: 'Author user ID' })
  @Expose()
  authorId: string;

  @ApiProperty({ example: 'post-789', description: 'Post ID this comment belongs to' })
  @Expose()
  postId: string;

  @ApiPropertyOptional({ nullable: true, example: null, description: 'Parent comment ID for threaded replies' })
  @Expose()
  parentId: string | null;

  @ApiProperty({ example: '2026-06-29T10:00:00Z', description: 'Comment creation timestamp' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2026-06-29T11:00:00Z', description: 'Comment last update timestamp' })
  @Expose()
  updatedAt: Date;
}

export class CreateCommentDto {
  @ApiProperty({
    example: 'Great post!',
    description: 'Comment text body',
    minLength: 1,
    maxLength: 2000,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  @ApiProperty({ example: 'post-789', description: 'ID of the post being commented on' })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  postId: string;

  @ApiPropertyOptional({ example: 'comment-123', description: 'Parent comment ID for threaded replies' })
  @IsOptional()
  @IsString()
  @IsUUID()
  parentId?: string;
}

export class UpdateCommentDto {
  @ApiPropertyOptional({
    example: 'Updated comment text',
    description: 'New comment text body',
    minLength: 1,
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content?: string;
}

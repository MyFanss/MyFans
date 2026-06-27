import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class PostDto {
  @ApiProperty({
    example: 'post-123',
    description: 'Unique post identifier',
  })
  @Expose()
  id: string;

  @ApiProperty({
    example: 'My First Post',
    description: 'Post title',
  })
  @Expose()
  title: string;

  @ApiProperty({
    example: 'This is the content of my post',
    description: 'Post content body',
  })
  @Expose()
  content: string;

  @ApiProperty({
    example: 'author-456',
    description: 'Author user ID',
  })
  @Expose()
  authorId: string;

  @ApiProperty({
    example: true,
    description: 'Whether post is published',
  })
  @Expose()
  isPublished: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether post is premium (paid subscribers only)',
  })
  @Expose()
  isPremium: boolean;

  @ApiProperty({
    example: 5,
    description: 'Number of likes',
  })
  @Expose()
  likesCount: number;

  @ApiProperty({
    example: '2026-06-26T10:30:00Z',
    description: 'Post creation timestamp',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    example: '2026-06-26T11:45:00Z',
    description: 'Post last update timestamp',
  })
  @Expose()
  updatedAt: Date;

  @ApiPropertyOptional({
    nullable: true,
    example: null,
    description: 'Post soft-delete timestamp (null if active)',
  })
  @Expose()
  deletedAt: Date | null;
}

export class CreatePostDto {
  @ApiProperty({
    example: 'My First Post',
    description: 'Post title',
    minLength: 1,
    maxLength: 500,
  })
  title: string;

  @ApiProperty({
    example: 'This is the content of my post',
    description: 'Post content body',
    minLength: 1,
    maxLength: 10000,
  })
  content: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether to publish post immediately (default: false)',
  })
  isPublished?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this is a premium post (default: false)',
  })
  isPremium?: boolean;
}

export class UpdatePostDto {
  @ApiPropertyOptional({
    example: 'My Updated Post Title',
    description: 'Post title',
    minLength: 1,
    maxLength: 500,
  })
  title?: string;

  @ApiPropertyOptional({
    example: 'Updated post content',
    description: 'Post content body',
    minLength: 1,
    maxLength: 10000,
  })
  content?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether to publish post',
  })
  isPublished?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether this is a premium post',
  })
  isPremium?: boolean;
}

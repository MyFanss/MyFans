import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ContentType } from '../entities/content.entity';

export class CreateContentDto {
  @ApiProperty({ description: 'Content title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Content description' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'IPFS CID of the content' })
  @IsString()
  @IsNotEmpty()
  ipfs_cid: string;

  @ApiPropertyOptional({ description: 'Full IPFS gateway URL' })
  @IsOptional()
  @IsString()
  ipfs_url?: string;

  @ApiPropertyOptional({ enum: ContentType, default: ContentType.IMAGE })
  @IsOptional()
  @IsEnum(ContentType)
  content_type?: ContentType;

  @ApiPropertyOptional({ description: 'Subscription tier required to access this content' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subscription_tier?: string;

  @ApiPropertyOptional({ description: 'Whether the content is published', default: false })
  @IsOptional()
  is_published?: boolean;
}

export class UpdateContentDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipfs_cid?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipfs_url?: string;

  @ApiPropertyOptional({ enum: ContentType })
  @IsOptional()
  @IsEnum(ContentType)
  content_type?: ContentType;

  @ApiPropertyOptional({ description: 'Subscription tier required to access this content' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subscription_tier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  is_published?: boolean;
}

export class ContentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() creator_id: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional() description: string | null;
  @ApiProperty() ipfs_cid: string;
  @ApiPropertyOptional() ipfs_url: string | null;
  @ApiProperty({ enum: ContentType }) content_type: ContentType;
  @ApiPropertyOptional() subscription_tier: string | null;
  @ApiProperty() is_published: boolean;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

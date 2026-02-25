import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsDecimal,
  MaxLength,
} from 'class-validator';
import { PostType } from '../entities/post.entity';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @IsOptional()
  @IsDecimal()
  price?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  media_urls?: string[];

  @IsOptional()
  published_at?: Date;
}

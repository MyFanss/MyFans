import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsDecimal,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { PostType } from '../entities/post.entity';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsEnum(PostType)
  type!: PostType;

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

import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsUrl,
} from 'class-validator';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (value === '' || value === null) return undefined;
  return value;
}

export class UpdateUserProfileDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  display_name?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/^[a-zA-Z0-9._]{3,30}$/, {
    message: 'username must be 3–30 chars: letters, numbers, dots, underscores',
  })
  username?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  avatar_url?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  website_url?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/^@?[a-zA-Z0-9_]{1,15}$/, {
    message: 'invalid X handle',
  })
  x_handle?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/^@?[a-zA-Z0-9._]{1,30}$/, {
    message: 'invalid Instagram handle',
  })
  instagram_handle?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  other_url?: string;
}

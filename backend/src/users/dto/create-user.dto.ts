import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username must contain only alphanumeric characters and underscores',
  })
  username: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

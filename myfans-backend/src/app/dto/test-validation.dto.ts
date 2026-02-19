import { IsInt, IsString, MaxLength, Min } from 'class-validator';

export class TestValidationDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsInt()
  @Min(0)
  age!: number;
}

import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';

export enum CreatorCurrency {
  XLM = 'XLM',
  USDC = 'USDC',
}

export class OnboardCreatorDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  subscription_price?: number = 0;

  @IsOptional()
  @IsEnum(CreatorCurrency)
  currency?: CreatorCurrency = CreatorCurrency.XLM;
}

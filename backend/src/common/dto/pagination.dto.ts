import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ 
    description: 'Cursor for pagination (ID of last item)', 
    nullable: true 
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ 
    description: 'Number of items per page', 
    default: 20, 
    minimum: 1, 
    maximum: 100 
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

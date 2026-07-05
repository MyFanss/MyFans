import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  FeatureFlagsService,
  FeatureFlagsSnapshot,
} from './feature-flags.service';
import { FeatureFlagsResponseDto } from './dto/feature-flags-response.dto';

@ApiTags('feature-flags')
@Controller({ path: 'feature-flags', version: '1' })
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all feature flags and their current state',
    description:
      'Returns the currently enabled backend feature flags exposed to clients.',
  })
  @ApiResponse({
    status: 200,
    description: 'Feature flags and their current enabled state.',
    type: FeatureFlagsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  getFlags(): FeatureFlagsSnapshot {
    return this.featureFlagsService.getAllFlags();
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FeatureFlagsService } from './feature-flags.service';

@ApiTags('feature-flags')
@Controller({ path: 'feature-flags', version: '1' })
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @ApiOperation({ summary: 'List all feature flags and their current state' })
  @ApiResponse({ status: 200, description: 'Feature flags map' })
  getFlags() {
    return this.featureFlagsService.getAllFlags();
  }
}

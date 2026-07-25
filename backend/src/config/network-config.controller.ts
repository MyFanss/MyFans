import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { NetworkConfigService } from './network-config.service';
import { NetworkConfigDto } from './dto/network-config.dto';

/**
 * NetworkConfigController
 *
 * Public, unauthenticated Stellar network discovery endpoint so clients
 * (web, mobile, wallets) can learn which network/passphrase/RPC/Horizon
 * endpoints to use without hardcoding them.
 *
 * @Controller config
 * @version 1
 * @tags config
 */
@ApiTags('config')
@Public()
@Controller({ path: 'config', version: '1' })
export class NetworkConfigController {
  constructor(private readonly networkConfigService: NetworkConfigService) {}

  @Get('network')
  @ApiOperation({
    summary: 'Stellar network discovery',
    description:
      'Returns the Stellar network name, passphrase, Horizon URL, and ' +
      'Soroban RPC URL the backend is configured against. Public — no ' +
      'secrets are included.',
  })
  @ApiResponse({
    status: 200,
    description: 'Network configuration',
    type: NetworkConfigDto,
  })
  getNetworkConfig(): NetworkConfigDto {
    return this.networkConfigService.getNetworkConfig();
  }
}

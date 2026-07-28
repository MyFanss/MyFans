import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class NetworkConfigDto {
  @ApiProperty({
    example: 'testnet',
    description: 'Stellar network the backend is configured against',
    enum: ['testnet', 'futurenet', 'mainnet'],
  })
  @Expose()
  network: string;

  @ApiProperty({
    example: 'Test SDF Network ; September 2015',
    description: 'Stellar network passphrase clients must sign transactions with',
  })
  @Expose()
  networkPassphrase: string;

  @ApiProperty({
    example: 'https://horizon-testnet.stellar.org',
    description: 'Horizon endpoint for this network',
  })
  @Expose()
  horizonUrl: string;

  @ApiProperty({
    example: 'https://soroban-testnet.stellar.org',
    description: 'Soroban RPC endpoint for this network',
  })
  @Expose()
  rpcUrl: string;
}

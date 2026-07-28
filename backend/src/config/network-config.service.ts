import { Injectable } from '@nestjs/common';
import { Networks } from '@stellar/stellar-sdk';
import { NetworkConfigDto } from './dto/network-config.dto';

const PASSPHRASE_BY_NETWORK: Record<string, string> = {
  testnet: Networks.TESTNET,
  futurenet: Networks.FUTURENET,
  mainnet: Networks.PUBLIC,
};

const HORIZON_URL_BY_NETWORK: Record<string, string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  futurenet: 'https://horizon-futurenet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};

const RPC_URL_BY_NETWORK: Record<string, string> = {
  testnet: 'https://soroban-testnet.stellar.org',
  futurenet: 'https://rpc-futurenet.stellar.org',
  mainnet: 'https://mainnet.sorobanrpc.com',
};

@Injectable()
export class NetworkConfigService {
  /** Public network discovery info derived from env; never includes secrets. */
  getNetworkConfig(): NetworkConfigDto {
    const network = (process.env.STELLAR_NETWORK ?? 'testnet')
      .trim()
      .toLowerCase();

    const networkPassphrase =
      process.env.STELLAR_NETWORK_PASSPHRASE?.trim() ||
      PASSPHRASE_BY_NETWORK[network] ||
      Networks.TESTNET;

    const horizonUrl =
      process.env.HORIZON_URL?.trim() ||
      HORIZON_URL_BY_NETWORK[network] ||
      HORIZON_URL_BY_NETWORK.testnet;

    const rpcUrl =
      process.env.SOROBAN_RPC_URL?.trim() ||
      RPC_URL_BY_NETWORK[network] ||
      RPC_URL_BY_NETWORK.testnet;

    return { network, networkPassphrase, horizonUrl, rpcUrl };
  }
}

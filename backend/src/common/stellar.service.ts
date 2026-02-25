import { Injectable } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';

@Injectable()
export class StellarService {
  private server: StellarSdk.Server;
  private networkPassphrase: string;
  private subscriptionContractId: string;

  constructor() {
    const network = process.env.STELLAR_NETWORK || 'testnet';
    const horizonUrl = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
    this.subscriptionContractId = process.env.SUBSCRIPTION_CONTRACT_ID || '';
    
    this.server = new StellarSdk.Server(horizonUrl);
    this.networkPassphrase = network === 'testnet' 
      ? StellarSdk.Networks.TESTNET 
      : StellarSdk.Networks.PUBLIC;
  }

  async isSubscriber(fanAddress: string, creatorAddress: string): Promise<boolean> {
    try {
      // Query contract state
      const result = await this.server.getContractData(
        this.subscriptionContractId,
        StellarSdk.xdr.ScVal.scvVec([
          StellarSdk.nativeToScVal(fanAddress, { type: 'address' }),
          StellarSdk.nativeToScVal(creatorAddress, { type: 'address' }),
        ])
      );
      return StellarSdk.scValToBool(result);
    } catch {
      return false;
    }
  }

  async getSubscriptionExpiry(fanAddress: string, creatorAddress: string): Promise<number | null> {
    try {
      const result = await this.server.getContractData(
        this.subscriptionContractId,
        StellarSdk.xdr.ScVal.scvVec([
          StellarSdk.nativeToScVal(fanAddress, { type: 'address' }),
          StellarSdk.nativeToScVal(creatorAddress, { type: 'address' }),
        ])
      );
      return StellarSdk.scValToNative(result).expiry;
    } catch {
      return null;
    }
  }

  async getAccountBalance(address: string, assetCode: string = 'XLM'): Promise<string> {
    try {
      const account = await this.server.loadAccount(address);
      const balance = account.balances.find(b => 
        b.asset_type === 'native' && assetCode === 'XLM' ||
        (b.asset_type !== 'native' && b.asset_code === assetCode)
      );
      return balance?.balance || '0';
    } catch {
      return '0';
    }
  }
}

import { Injectable } from '@nestjs/common';
import { Horizon } from '@stellar/stellar-sdk';

@Injectable()
export class StellarService {
  private server: Horizon.Server;
  private subscriptionContractId: string;

  constructor() {
    const horizonUrl = process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org';
    this.subscriptionContractId = process.env.SUBSCRIPTION_CONTRACT_ID || '';
    this.server = new Horizon.Server(horizonUrl);
  }

  async isSubscriber(fanAddress: string, creatorAddress: string): Promise<boolean> {
    // Mock implementation - replace with actual Soroban RPC call
    return false;
  }

  async getSubscriptionExpiry(fanAddress: string, creatorAddress: string): Promise<number | null> {
    // Mock implementation - replace with actual Soroban RPC call
    return null;
  }

  async getAccountBalance(address: string, assetCode: string = 'XLM'): Promise<string> {
    try {
      const account = await this.server.loadAccount(address);
      const balance = account.balances.find(b => 
        (b.asset_type === 'native' && assetCode === 'XLM') ||
        (b.asset_type !== 'native' && 'asset_code' in b && b.asset_code === assetCode)
      );
      return balance?.balance || '0';
    } catch {
      return '0';
    }
  }
}

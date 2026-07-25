import { Injectable } from '@nestjs/common';
import { StellarService } from '../common/stellar.service';

export const RPC_BALANCE_ADAPTER = 'RPC_BALANCE_ADAPTER';

export interface RpcBalanceAdapter {
  getBalance(fanAddress: string, assetCode: string): Promise<string>;
}

/**
 * Deterministic balances for local dev/tests. Selected when
 * SUBSCRIPTIONS_USE_MOCK_RPC=true or NODE_ENV=test — see subscriptions.module.ts.
 */
@Injectable()
export class MockRpcAdapter implements RpcBalanceAdapter {
  async getBalance(fanAddress: string, assetCode: string): Promise<string> {
    void fanAddress;
    if (assetCode === 'XLM') {
      return '1000.0000000';
    }

    if (assetCode === 'USDC') {
      return '50.0000000';
    }

    return '0.0000000';
  }
}

/** Real Horizon-backed balance lookups, used outside of tests/local mock mode. */
@Injectable()
export class HorizonRpcAdapter implements RpcBalanceAdapter {
  constructor(private readonly stellarService: StellarService) {}

  getBalance(fanAddress: string, assetCode: string): Promise<string> {
    return this.stellarService.getAccountBalance(fanAddress, assetCode);
  }
}

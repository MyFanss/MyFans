import { Injectable } from '@nestjs/common';

export const RPC_BALANCE_ADAPTER = 'RPC_BALANCE_ADAPTER';

export interface RpcBalanceAdapter {
  getBalance(fanAddress: string, assetCode: string): string;
}

@Injectable()
export class MockRpcAdapter implements RpcBalanceAdapter {
  getBalance(fanAddress: string, assetCode: string): string {
    if (assetCode === 'XLM') {
      return '1000.0000000';
    }

    if (assetCode === 'USDC') {
      return '50.0000000';
    }

    return '0.0000000';
  }
}

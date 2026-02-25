/**
 * Wallet type definitions for Stellar/Soroban integration
 */

/** Supported wallet types */
export type WalletType = 'freighter' | 'lobstr' | 'walletconnect';

/** Wallet connection status */
export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Wallet connection state */
export type WalletConnectionState =
  | { status: 'disconnected' }
  | { status: 'connecting'; walletType: WalletType }
  | {
      status: 'connected';
      address: string;
      walletType: WalletType;
      network: string;
    }
  | { status: 'error'; error: string; walletType: WalletType };

/** Wallet info */
export interface WalletInfo {
  type: WalletType;
  name: string;
  description: string;
  icon: string;
  installUrl?: string;
}

/** Connected wallet details */
export interface ConnectedWallet {
  address: string;
  walletType: WalletType;
  network: string;
  balance?: string;
}

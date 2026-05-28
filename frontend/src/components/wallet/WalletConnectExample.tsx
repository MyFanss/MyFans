'use client';

import { WalletSelectionModal } from '@/components/wallet/WalletSelectionModal';
import { useWallet } from '@/hooks/useWallet';
import Button from '@/components/Button';

/**
 * Example component demonstrating the enhanced wallet connection system
 * with resilience features, install/missing-wallet states, and multiple wallet support.
 */
export function WalletConnectExample() {
  const {
    connectionState,
    isConnected,
    address,
    walletType,
    connect,
    disconnect,
    reconnect,
    isModalOpen,
    openModal,
    closeModal,
    isWalletInstalled,
    getInstallUrl,
    isReconnecting,
  } = useWallet({
    autoReconnect: true,
    reconnectAttempts: 3,
    reconnectDelay: 1000,
  });

  const handleConnect = (walletAddress: string, type: string) => {
    console.log('Wallet connected:', { walletAddress, type });
  };

  const handleDisconnect = () => {
    console.log('Wallet disconnected');
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">Wallet Connection Demo</h1>
      
      {/* Connection Status */}
      <div className="mb-6 p-4 rounded-lg border bg-slate-50 dark:bg-slate-800">
        <h2 className="font-semibold mb-2">Connection Status</h2>
        <div className="space-y-1 text-sm">
          <p>Status: <span className="font-medium">{connectionState.status}</span></p>
          {isConnected && (
            <>
              <p>Address: <span className="font-mono text-xs">{address}</span></p>
              <p>Wallet: <span className="font-medium">{walletType}</span></p>
            </>
          )}
          {isReconnecting && (
            <p className="text-amber-600 dark:text-amber-400">
              🔄 Attempting to reconnect...
            </p>
          )}
          {connectionState.status === 'error' && (
            <p className="text-red-600 dark:text-red-400">
              Error: {connectionState.error}
            </p>
          )}
        </div>
      </div>

      {/* Wallet Availability */}
      <div className="mb-6 p-4 rounded-lg border bg-slate-50 dark:bg-slate-800">
        <h2 className="font-semibold mb-2">Wallet Availability</h2>
        <div className="space-y-2 text-sm">
          {(['freighter', 'lobstr', 'walletconnect'] as const).map((wallet) => (
            <div key={wallet} className="flex items-center justify-between">
              <span className="capitalize">{wallet}</span>
              <div className="flex items-center gap-2">
                {isWalletInstalled(wallet) ? (
                  <span className="text-green-600 dark:text-green-400">✓ Installed</span>
                ) : (
                  <>
                    <span className="text-amber-600 dark:text-amber-400">✗ Not Installed</span>
                    {getInstallUrl(wallet) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => window.open(getInstallUrl(wallet)!, '_blank')}
                      >
                        Install
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        {isConnected ? (
          <div className="space-y-3">
            <Button
              variant="secondary"
              onClick={disconnect}
              className="w-full"
            >
              Disconnect Wallet
            </Button>
            <Button
              variant="secondary"
              onClick={reconnect}
              disabled={isReconnecting}
              className="w-full"
            >
              {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
            </Button>
          </div>
        ) : (
          <Button
            onClick={openModal}
            disabled={isReconnecting}
            className="w-full"
          >
            {isReconnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        )}
      </div>

      {/* Wallet Selection Modal */}
      <WalletSelectionModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        isWalletInstalled={isWalletInstalled}
        getInstallUrl={getInstallUrl}
      />

      {/* Instructions */}
      <div className="mt-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm">
        <h3 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">Features Demo:</h3>
        <ul className="space-y-1 text-blue-800 dark:text-blue-200">
          <li>• Automatic reconnection with exponential backoff</li>
          <li>• Install/missing-wallet state detection</li>
          <li>• Multiple Stellar wallet support</li>
          <li>• Resilient error handling</li>
          <li>• Wallet event listening</li>
          <li>• Comprehensive testing coverage</li>
        </ul>
      </div>
    </div>
  );
}

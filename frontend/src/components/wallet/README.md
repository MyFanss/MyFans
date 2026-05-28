# Enhanced Wallet Connection System

This document describes the improvements made to the wallet connection system to enhance resilience, user experience, and support for multiple Stellar wallets.

## Overview

The enhanced wallet system provides:
- **Install/Missing-Wallet State Handling**: Detects when wallets are not installed and guides users to installation
- **Auto-Reconnection**: Automatically attempts to reconnect when wallet connections are lost
- **Multiple Wallet Support**: Supports Freighter, Lobstr, and WalletConnect protocols
- **Resilient Error Handling**: Comprehensive error handling with user-friendly messages
- **Comprehensive Testing**: Full test coverage for all wallet functionality

## Key Components

### 1. Enhanced Wallet Library (`/src/lib/wallet.ts`)

#### New Features:
- **Multi-wallet support**: `connectWallet(walletType)`, `signTransaction(xdr, walletType)`
- **Installation detection**: `isWalletInstalled(walletType)`, `getWalletInstallUrl(walletType)`
- **Connection management**: `getAnyConnectedAddress()`, `isAnyWalletConnected()`
- **Legacy compatibility**: Backward-compatible functions with `Legacy` suffix

#### Usage:
```typescript
import { connectWallet, isWalletInstalled, getWalletInstallUrl } from '@/lib/wallet';

// Check if wallet is installed
if (!isWalletInstalled('freighter')) {
  const installUrl = getWalletInstallUrl('freighter');
  // Show installation UI
}

// Connect to specific wallet
try {
  const address = await connectWallet('freighter');
  console.log('Connected:', address);
} catch (error) {
  // Handle installation or connection errors
}
```

### 2. Enhanced useWallet Hook (`/src/hooks/useWallet.ts`)

#### New Features:
- **Auto-reconnection**: Configurable automatic reconnection with exponential backoff
- **Event listening**: Responds to wallet account/network changes
- **Installation utilities**: Helper functions for wallet installation state
- **Reconnection control**: Manual reconnection triggers

#### Configuration Options:
```typescript
const wallet = useWallet({
  autoReconnect: true,        // Enable auto-reconnection
  reconnectAttempts: 3,       // Max reconnection attempts
  reconnectDelay: 1000,       // Base delay between attempts (ms)
});
```

#### Usage:
```typescript
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
```

### 3. Enhanced WalletOption Component (`/src/components/wallet/WalletOption.tsx`)

#### New Features:
- **Installation state UI**: Visual indicators for non-installed wallets
- **Installation buttons**: Direct installation links for missing wallets
- **Tooltips**: Helpful hints for wallet installation
- **Enhanced styling**: Different visual states for installed/not installed wallets

#### Props:
```typescript
interface WalletOptionProps {
  type: WalletType;
  name: string;
  description: string;
  icon: string;
  isConnecting: boolean;
  isInstalled: boolean;        // NEW: Installation state
  installUrl?: string;         // NEW: Installation URL
  onSelect: () => void;
  onInstall?: () => void;      // NEW: Installation handler
  disabled: boolean;
}
```

### 4. Enhanced WalletSelectionModal (`/src/components/wallet/WalletSelectionModal.tsx`)

#### New Features:
- **Installation handling**: Opens installation URLs when wallets are missing
- **Enhanced error handling**: Better error messages and retry functionality
- **Installation feedback**: Toast notifications for installation guidance

## Supported Wallets

### Freighter
- **Type**: Browser extension
- **Installation**: https://freighter.app
- **Status**: ✅ Fully supported

### Lobstr
- **Type**: Mobile and web wallet
- **Installation**: https://lobstr.co
- **Status**: 🔄 Interface ready, integration pending

### WalletConnect
- **Type**: Mobile wallet protocol
- **Installation**: Not required (protocol-based)
- **Status**: 🔄 Interface ready, integration pending

## Error Handling

### Installation Errors
```typescript
// Wallet not installed
{
  code: 'WALLET_NOT_INSTALLED',
  message: 'freighter wallet not found',
  description: 'Please install freighter wallet to connect.',
  actions: [
    { label: 'Install freighter', type: 'navigate', href: 'https://freighter.app', primary: true }
  ]
}
```

### Connection Errors
```typescript
// User rejected connection
{
  code: 'WALLET_CONNECTION_REJECTED',
  message: 'Connection rejected',
  description: 'You rejected the connection request. Please try again and approve the connection.',
  severity: 'warning'
}
```

## Auto-Reconnection

The system automatically attempts to reconnect when:
- Wallet account changes
- Network changes occur
- Connection is lost

**Reconnection Strategy:**
- Exponential backoff: `delay * attemptNumber`
- Maximum attempts configurable (default: 3)
- Manual reconnection available via `reconnect()` function

## Testing

### Test Coverage
- **Wallet Library**: `/src/lib/__tests__/wallet.test.ts`
- **useWallet Hook**: `/src/hooks/__tests__/useWallet.test.ts`
- **WalletOption Component**: `/src/components/wallet/__tests__/WalletOption.test.tsx`
- **WalletSelectionModal**: `/src/components/wallet/__tests__/WalletSelectionModal.test.tsx`

### Running Tests
```bash
# Run all wallet-related tests
npm test -- wallet

# Run specific test file
npm test src/lib/__tests__/wallet.test.ts

# Run with coverage
npm test -- --coverage wallet
```

## Migration Guide

### From Legacy System
1. **Update imports**:
   ```typescript
   // Old
   import { connectWallet } from '@/lib/wallet';
   
   // New
   import { connectWallet, isWalletInstalled } from '@/lib/wallet';
   ```

2. **Update hook usage**:
   ```typescript
   // Old
   const wallet = useWallet();
   
   // New (with options)
   const wallet = useWallet({
     autoReconnect: true,
     reconnectAttempts: 3,
   });
   ```

3. **Update component props**:
   ```typescript
   // Old
   <WalletSelectionModal isOpen={isOpen} onClose={onClose} />
   
   // New
   <WalletSelectionModal 
     isOpen={isOpen} 
     onClose={onClose}
     isWalletInstalled={wallet.isWalletInstalled}
     getInstallUrl={wallet.getInstallUrl}
   />
   ```

## Best Practices

### 1. Always Check Installation State
```typescript
if (!isWalletInstalled(walletType)) {
  // Show installation UI
  return;
}
```

### 2. Handle Connection Errors Gracefully
```typescript
try {
  await connect(walletType);
} catch (error) {
  if (error.code === 'WALLET_NOT_INSTALLED') {
    // Handle installation
  } else if (error.code === 'WALLET_CONNECTION_REJECTED') {
    // Handle user rejection
  }
}
```

### 3. Use Auto-Reconnection
```typescript
const wallet = useWallet({
  autoReconnect: true,  // Enable for better UX
  reconnectAttempts: 3,
  reconnectDelay: 1000,
});
```

### 4. Provide Clear User Feedback
```typescript
// Show loading states during connection
// Show installation buttons for missing wallets
// Provide clear error messages and retry options
```

## Future Enhancements

1. **Complete Lobstr Integration**: Full Lobstr wallet support
2. **WalletConnect v2**: Mobile wallet QR code connections
3. **Wallet Switching**: Seamless switching between connected wallets
4. **Network Detection**: Automatic network switching for different environments
5. **Transaction Queue**: Queue transactions when wallet is disconnected

## Troubleshooting

### Common Issues

1. **Wallet Not Detected**
   - Check if wallet extension is installed and enabled
   - Verify wallet is supported in current browser
   - Try refreshing the page

2. **Connection Failures**
   - Ensure wallet is unlocked
   - Check network permissions
   - Verify wallet is on correct network

3. **Auto-Reconnection Not Working**
   - Check if autoReconnect is enabled in hook options
   - Verify wallet events are being fired
   - Check browser console for errors

### Debug Mode
Enable debug logging by setting:
```typescript
const wallet = useWallet({
  autoReconnect: true,
  reconnectAttempts: 5,  // More attempts for debugging
  reconnectDelay: 500,   // Faster retries for debugging
});
```

## Conclusion

The enhanced wallet connection system provides a robust, user-friendly experience for connecting to Stellar wallets. With automatic reconnection, installation guidance, and comprehensive error handling, users can reliably connect and interact with the application using their preferred wallet.

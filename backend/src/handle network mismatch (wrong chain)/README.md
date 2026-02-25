# Stellar Network Guard

A React-based solution for detecting and managing Stellar/Soroban network connections in wallet-integrated applications.

## Features

- ✅ Automatic network detection from connected wallet
- ✅ Clear UI prompt for network switching
- ✅ Optional action blocking until correct network
- ✅ Support for Stellar testnet and mainnet
- ✅ Freighter wallet integration
- ✅ Fully tested with Vitest
- ✅ TypeScript support

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```env
VITE_STELLAR_NETWORK=testnet
VITE_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

For mainnet:

```env
VITE_STELLAR_NETWORK=mainnet
VITE_STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
```

## Usage

### Basic Usage

Wrap components that require network validation with `NetworkGuard`:

```tsx
import { NetworkGuard } from "./components/NetworkGuard";

function App() {
  return (
    <NetworkGuard blockActions={true} showPrompt={true}>
      <button onClick={handleSubscribe}>Subscribe</button>
      <button onClick={handlePay}>Pay</button>
    </NetworkGuard>
  );
}
```

### Using the Hook

For more control, use the `useNetworkGuard` hook directly:

```tsx
import { useNetworkGuard } from "./hooks/useNetworkGuard";

function MyComponent() {
  const { networkStatus, isCorrectNetwork, checkNetwork } = useNetworkGuard();

  if (!isCorrectNetwork) {
    return <div>Please switch to the correct network</div>;
  }

  return <div>Connected to correct network!</div>;
}
```

### Props

#### NetworkGuard

- `children`: React nodes to wrap
- `blockActions` (optional, default: `true`): Whether to disable wrapped content when on wrong network
- `showPrompt` (optional, default: `true`): Whether to show the network switch prompt

#### useNetworkGuard Options

- `autoCheck` (optional, default: `true`): Automatically check network on mount
- `checkInterval` (optional, default: `5000`): Interval in ms for automatic network checks

## Testing

Run tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## CI/CD

The project includes GitHub Actions workflow that:

- Runs on Node.js 18.x and 20.x
- Executes linting
- Runs type checking
- Executes all tests
- Uploads coverage reports

## Architecture

### Components

- `NetworkGuard`: Wrapper component that manages network validation UI
- `NetworkSwitchPrompt`: Alert component showing network mismatch

### Hooks

- `useNetworkGuard`: Hook for network detection and validation

### Utils

- `networkDetection`: Core logic for detecting wallet network
- `config/network`: Network configuration and constants

## Acceptance Criteria

✅ Wrong network detected - Automatically detects when wallet is on incorrect network
✅ User sees switch prompt - Clear UI prompt with network information
✅ Actions blocked or warned - Optional blocking of actions until network switch
✅ All tests pass - Comprehensive test coverage with Vitest
✅ CI tests pass - GitHub Actions workflow validates all checks

## Browser Support

Requires a browser with Freighter wallet extension installed.

## License

MIT

# Component Documentation

## Button

Reusable button component with multiple variants, sizes, and states.

### Props

- `variant`: 'primary' | 'secondary' | 'tertiary' | 'wallet' (default: 'primary')
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `loading`: boolean (default: false)
- `disabled`: boolean (default: false)
- `fullWidth`: boolean (default: false)

### Variants

- **Primary**: Blue background, white text
- **Secondary**: Gray background, dark text
- **Tertiary**: Transparent background, blue text
- **Wallet**: Gradient purple-to-blue background

### Accessibility

- Keyboard navigation support
- Focus visible ring indicators
- `aria-busy` attribute when loading
- Disabled state prevents interaction
- Semantic button element

### Usage

```tsx
import Button from '@/components/Button';

<Button variant="primary" size="md">Click me</Button>
<Button variant="wallet" loading>Connecting...</Button>
<Button fullWidth disabled>Disabled</Button>
```

## WalletDisplay

Displays connected wallet information with copy and disconnect functionality.

### Props

- `address`: string (wallet address)
- `network`: string (default: 'Mainnet')
- `onDisconnect`: () => void (callback for disconnect action)

### Features

- Formatted address display (0x1234...5678)
- Copy to clipboard with visual feedback
- Network indicator
- Disconnect button
- Handles disconnected state

### Accessibility

- `aria-label` for address and actions
- `role="status"` for disconnected state
- `aria-live="polite"` for state changes
- Keyboard accessible buttons
- Focus visible indicators

### Usage

```tsx
import WalletDisplay from '@/components/WalletDisplay';

<WalletDisplay 
  address="0x1234567890abcdef1234567890abcdef12345678"
  network="Mainnet"
  onDisconnect={() => console.log('Disconnected')}
/>
```

### Handling Extension Disconnect

The component automatically shows a disconnected state when `address` is empty or undefined. Listen for wallet extension disconnect events and update the address prop accordingly.

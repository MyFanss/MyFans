# Components

## Button

The `Button` component is a flexible, accessible button component with support for multiple variants, sizes, and states.

### Props

- `variant`: 'primary' | 'secondary' | 'tertiary' | 'wallet' (default: 'primary')
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `isLoading`: boolean - Shows spinner and disables the button
- `disabled`: boolean - Disables the button
- `fullWidth`: boolean - Makes the button full width
- All standard HTML button attributes

### Usage

```tsx
import Button from '@/components/Button';

// Primary button
<Button>Click me</Button>

// Secondary with loading
<Button variant="secondary" isLoading={isLoading}>
  Processing...
</Button>

// Wallet variant, full width
<Button variant="wallet" fullWidth>
  Connect Wallet
</Button>

// Disabled tertiary
<Button variant="tertiary" disabled>
  Unavailable
</Button>
```

### Accessibility

- Focus ring support (ring-2 ring-offset-2 ring-blue-500)
- Proper ARIA attributes: aria-busy, aria-disabled
- Semantic button element
- Loading spinner is hidden from screen readers

---

## WalletDisplay

The `WalletDisplay` component displays wallet information and provides copy/disconnect functionality.

### Props

- `address`: string (required) - The wallet address
- `network`: string (optional, default: 'Stellar') - Network name/identifier
- `onDisconnect`: () => void | Promise<void> (optional) - Disconnect handler
- `className`: string (optional) - Additional CSS classes

### Usage

```tsx
import WalletDisplay from "@/components/WalletDisplay";
import { disconnectWallet } from "@/lib/wallet";

<WalletDisplay
  address="GDZNT3XVCDTUJ76ZAV2HA72KYXM4Y5XYVXYVPYVU5PXII5MQV6E2XPO3"
  network="Stellar (Mainnet)"
  onDisconnect={async () => {
    await disconnectWallet();
    // Clear local state
  }}
/>;
```

### Accessibility

- Semantic structure with proper labels
- ARIA labels for all interactive elements
- Extension detection with alert role
- Copy status feedback
- Keyboard accessible

---

## Running Storybook

```bash
npm run storybook
```

Visit http://localhost:6006 to view all component stories and documentation.

import type { Meta, StoryObj } from '@storybook/react';
import WalletDisplay from './WalletDisplay';

const meta = {
  title: 'Components/WalletDisplay',
  component: WalletDisplay,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    address: {
      control: { type: 'text' },
    },
    network: {
      control: { type: 'text' },
    },
    onDisconnect: {
      action: 'disconnected',
    },
  },
} satisfies Meta<typeof WalletDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockAddress = 'GDZNT3XVCDTUJ76ZAV2HA72KYXM4Y5XYVXYVPYVU5PXII5MQV6E2XPO3';

export const Default: Story = {
  args: {
    address: mockAddress,
    network: 'Stellar',
  },
};

export const DifferentNetwork: Story = {
  args: {
    address: mockAddress,
    network: 'Stellar Testnet',
  },
};

export const WithLongAddress: Story = {
  args: {
    address: 'GDZNT3XVCDTUJ76ZAV2HA72KYXM4Y5XYVXYVPYVU5PXII5MQV6E2XPO3GDZNT3XVCDTUJ76ZAV2HA72KYXM4Y5X',
    network: 'Stellar',
  },
};

export const WithDisconnectHandler: Story = {
  args: {
    address: mockAddress,
    network: 'Stellar',
    onDisconnect: async () => {
      console.log('Disconnecting wallet...');
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log('Wallet disconnected');
    },
  },
};

export const CopyFunctionality: Story = {
  parameters: {
    layout: 'padded',
  },
  args: {
    address: mockAddress,
    network: 'Stellar',
  },
  render: (args) => (
    <div className="max-w-md">
      <p className="text-sm text-gray-600 mb-4">
        Click the copy button next to the address to copy it to the clipboard.
      </p>
      <WalletDisplay {...args} />
    </div>
  ),
};

export const AccessibilityDemo: Story = {
  parameters: {
    layout: 'padded',
  },
  args: {
    address: mockAddress,
    network: 'Stellar',
  },
  render: (args) => (
    <div className="max-w-md">
      <div className="space-y-2 mb-4 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-sm">Accessibility Features:</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>✓ Semantic HTML with proper roles</li>
          <li>✓ ARIA labels for screen readers</li>
          <li>✓ Button focus indicators</li>
          <li>✓ Copy button announces state change</li>
          <li>✓ Alert role for extension detection</li>
        </ul>
      </div>
      <WalletDisplay {...args} />
    </div>
  ),
};

export const NetworkDisplay: Story = {
  parameters: {
    layout: 'padded',
  },
  render: () => (
    <div className="max-w-md space-y-4">
      <WalletDisplay address={mockAddress} network="Stellar (Mainnet)" />
      <WalletDisplay address={mockAddress} network="Stellar (Testnet)" />
      <WalletDisplay address={mockAddress} network="Custom Network" />
    </div>
  ),
};

export const AddressFormatting: Story = {
  parameters: {
    layout: 'padded',
  },
  render: () => (
    <div className="max-w-md space-y-4">
      <div>
        <h4 className="text-sm font-semibold mb-2">Standard Address:</h4>
        <WalletDisplay
          address="GDZNT3XVCDTUJ76ZAV2HA72KYXM4Y5XYVXYVPYVU5PXII5MQV6E2XPO3"
          network="Stellar"
        />
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-2">Very Long Address (wrapped):</h4>
        <WalletDisplay
          address="GDZNT3XVCDTUJ76ZAV2HA72KYXM4Y5XYVXYVPYVU5PXII5MQV6E2XPO3GDZNT3XVCDTUJ76ZAV2HA72KYXM4Y5XYVXYVPYVU5PXII5MQVABCDEFGHIJK"
          network="Stellar"
        />
      </div>
    </div>
  ),
};

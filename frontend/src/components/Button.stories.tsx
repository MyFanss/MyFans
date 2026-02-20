import type { Meta, StoryObj } from '@storybook/react';
import Button from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'tertiary', 'wallet'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    isLoading: {
      control: { type: 'boolean' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
    fullWidth: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Variants
export const Primary: Story = {
  args: {
    children: 'Primary Button',
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Secondary Button',
    variant: 'secondary',
  },
};

export const Tertiary: Story = {
  args: {
    children: 'Tertiary Button',
    variant: 'tertiary',
  },
};

export const Wallet: Story = {
  args: {
    children: 'Connect Wallet',
    variant: 'wallet',
  },
};

// Sizes
export const Small: Story = {
  args: {
    children: 'Small Button',
    size: 'sm',
  },
};

export const Medium: Story = {
  args: {
    children: 'Medium Button',
    size: 'md',
  },
};

export const Large: Story = {
  args: {
    children: 'Large Button',
    size: 'lg',
  },
};

// States
export const Loading: Story = {
  args: {
    children: 'Loading',
    isLoading: true,
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
  },
};

export const FullWidth: Story = {
  parameters: {
    layout: 'padded',
  },
  args: {
    children: 'Full Width Button',
    fullWidth: true,
  },
};

// Combined examples
export const LoadingPrimary: Story = {
  args: {
    children: 'Processing',
    variant: 'primary',
    isLoading: true,
  },
};

export const DisabledWallet: Story = {
  args: {
    children: 'Connect Wallet',
    variant: 'wallet',
    disabled: true,
  },
};

// All Variants in Sizes
export const AllVariantsSmall: Story = {
  args: {},
  parameters: {
    layout: 'padded',
  },
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="primary" size="sm">
        Primary
      </Button>
      <Button variant="secondary" size="sm">
        Secondary
      </Button>
      <Button variant="tertiary" size="sm">
        Tertiary
      </Button>
      <Button variant="wallet" size="sm">
        Wallet
      </Button>
    </div>
  ),
};

export const AllVariantsMedium: Story = {
  args: {},
  parameters: {
    layout: 'padded',
  },
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="primary" size="md">
        Primary
      </Button>
      <Button variant="secondary" size="md">
        Secondary
      </Button>
      <Button variant="tertiary" size="md">
        Tertiary
      </Button>
      <Button variant="wallet" size="md">
        Wallet
      </Button>
    </div>
  ),
};

export const AllVariantsLarge: Story = {
  parameters: {
    layout: 'padded',
  },
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="primary" size="lg">
        Primary
      </Button>
      <Button variant="secondary" size="lg">
        Secondary
      </Button>
      <Button variant="tertiary" size="lg">
        Tertiary
      </Button>
      <Button variant="wallet" size="lg">
        Wallet
      </Button>
    </div>
  ),
};

// Accessibility demo
export const AccessibilityFocusStates: Story = {
  parameters: {
    layout: 'padded',
  },
  render: () => (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">With focus ring (press Tab)</h3>
        <Button>Tab to focus me</Button>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">Disabled (no focus)</h3>
        <Button disabled>Disabled button</Button>
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">Loading with aria-busy</h3>
        <Button isLoading>Processing...</Button>
      </div>
    </div>
  ),
};

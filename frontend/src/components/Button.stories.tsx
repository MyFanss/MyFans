import Button from './Button';

export default {
  title: 'Components/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary', 'wallet']
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg']
    },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    fullWidth: { control: 'boolean' }
  }
};

export const Primary = {
  args: {
    children: 'Primary Button',
    variant: 'primary'
  }
};

export const Secondary = {
  args: {
    children: 'Secondary Button',
    variant: 'secondary'
  }
};

export const Tertiary = {
  args: {
    children: 'Tertiary Button',
    variant: 'tertiary'
  }
};

export const Wallet = {
  args: {
    children: 'Connect Wallet',
    variant: 'wallet'
  }
};

export const Loading = {
  args: {
    children: 'Loading...',
    loading: true
  }
};

export const Disabled = {
  args: {
    children: 'Disabled Button',
    disabled: true
  }
};

export const Sizes = {
  render: () => (
    <div className="flex gap-4 items-center">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  )
};

export const FullWidth = {
  args: {
    children: 'Full Width Button',
    fullWidth: true
  }
};

export const AllVariants = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="tertiary">Tertiary</Button>
      <Button variant="wallet">Connect Wallet</Button>
    </div>
  )
};

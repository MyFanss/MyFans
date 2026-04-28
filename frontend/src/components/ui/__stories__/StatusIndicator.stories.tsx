import type { Meta, StoryObj } from '@storybook/react';
import { StatusIndicator } from '../StatusIndicator';

const meta: Meta<typeof StatusIndicator> = {
  title: 'UI/StatusIndicator',
  component: StatusIndicator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['success', 'warning', 'error', 'info', 'neutral', 'pending'],
    },
    showDot: { control: 'boolean' },
    label: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof StatusIndicator>;

export const Success: Story = {
  args: {
    status: 'success',
    label: 'Connected',
  },
};

export const Warning: Story = {
  args: {
    status: 'warning',
    label: 'Expiring Soon',
  },
};

export const ErrorState: Story = {
  args: {
    status: 'error',
    label: 'Payment Failed',
  },
};

export const Pending: Story = {
  args: {
    status: 'pending',
    label: 'Confirming Transaction...',
  },
};

export const Info: Story = {
  args: {
    status: 'info',
    label: 'New Update',
  },
};

export const WithoutDot: Story = {
  args: {
    status: 'success',
    label: 'Success Without Dot',
    showDot: false,
  },
};

export const AutoLabel: Story = {
  args: {
    status: 'warning',
  },
};

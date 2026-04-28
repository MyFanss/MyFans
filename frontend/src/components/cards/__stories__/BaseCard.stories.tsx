import type { Meta, StoryObj } from '@storybook/react';
import { BaseCard } from '../BaseCard';
import React from 'react';

const meta: Meta<typeof BaseCard> = {
  title: 'Cards/BaseCard',
  component: BaseCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'elevated', 'outlined', 'filled'],
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
    interactive: { control: 'boolean' },
    as: {
      control: 'select',
      options: ['div', 'article', 'section', 'li'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BaseCard>;

export const Default: Story = {
  args: {
    children: (
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Card Title</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          This is a default card with standard padding and styling.
        </p>
      </div>
    ),
    variant: 'default',
    padding: 'md',
  },
};

export const Elevated: Story = {
  args: {
    ...Default.args,
    variant: 'elevated',
  },
};

export const Outlined: Story = {
  args: {
    ...Default.args,
    variant: 'outlined',
  },
};

export const Filled: Story = {
  args: {
    ...Default.args,
    variant: 'filled',
  },
};

export const Interactive: Story = {
  args: {
    ...Default.args,
    interactive: true,
  },
};

export const NoPadding: Story = {
  args: {
    children: (
      <div className="bg-primary-100 p-4 rounded-xl text-primary-800">
        This card has no inner padding applied from the component itself.
      </div>
    ),
    padding: 'none',
  },
};

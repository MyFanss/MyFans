'use client';

import React from 'react';

export type AccountStatus = 'creator' | 'fan' | 'both' | 'none';

interface AccountTypeProps {
  status: AccountStatus;
  className?: string;
}

const statusConfig = {
  creator: {
    label: 'Creator',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-800 dark:text-purple-200',
    borderColor: 'border-purple-300 dark:border-purple-700',
    icon: '✨',
  },
  fan: {
    label: 'Fan',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-800 dark:text-blue-200',
    borderColor: 'border-blue-300 dark:border-blue-700',
    icon: '💙',
  },
  both: {
    label: 'Creator & Fan',
    bgColor: 'bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30',
    textColor: 'text-purple-800 dark:text-purple-200',
    borderColor: 'border-purple-300 dark:border-purple-700',
    icon: '⭐',
  },
  none: {
    label: 'New User',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-700 dark:text-gray-300',
    borderColor: 'border-gray-300 dark:border-gray-600',
    icon: '👤',
  },
};

const instructionalText = {
  creator: 'You can create content and earn from subscriptions.',
  fan: 'You can subscribe to creators and access exclusive content.',
  both: 'You can create content and subscribe to other creators.',
  none: 'Choose to become a creator or subscribe to your favorite creators.',
};

export default function AccountType({ status, className = '' }: AccountTypeProps) {
  const config = statusConfig[status];

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Account Type
        </span>
      </div>

      <div
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor} font-medium text-sm transition-all`}
        role="status"
        aria-label={`Account type: ${config.label}`}
      >
        <span className="text-base" aria-hidden="true">{config.icon}</span>
        <span>{config.label}</span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        {instructionalText[status]}
      </p>
    </div>
  );
}

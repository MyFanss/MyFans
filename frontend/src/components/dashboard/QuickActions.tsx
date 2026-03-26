'use client';

import React from 'react';
import { BaseCard } from '@/components/cards';

export interface QuickActionItem {
  id: string;
  label: string;
  description?: string;
  onClick: () => void;
  icon: React.ReactNode;
}

export interface QuickActionsProps {
  actions: QuickActionItem[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <BaseCard className="flex flex-col" padding="lg" as="section" aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading" className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Quick actions
      </h2>
      <div className="grid grid-cols-1 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left min-h-[60px] touch-manipulation"
          >
            <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center">
              {action.icon}
            </span>
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-900 dark:text-white block">{action.label}</span>
              {action.description && (
                <span className="text-xs text-gray-500 dark:text-gray-400 block">{action.description}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </BaseCard>
  );
}

export default QuickActions;

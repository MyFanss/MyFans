import React from 'react';

export interface BaseCardProps {
  /**
   * Card content
   */
  children: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Click handler
   */
  onClick?: () => void;
  /**
   * Whether the card is interactive (adds hover effects)
   */
  interactive?: boolean;
  /**
   * Card variant style
   */
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  /**
   * Card padding size
   */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /**
   * HTML element to render as
   */
  as?: 'div' | 'article' | 'section' | 'li';
}

const variantStyles: Record<string, string> = {
  default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
  elevated: 'bg-white dark:bg-gray-800 shadow-lg dark:shadow-gray-900/30',
  outlined: 'bg-transparent border-2 border-gray-300 dark:border-gray-600',
  filled: 'bg-gray-100 dark:bg-gray-900',
};

const paddingStyles: Record<string, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const interactiveStyles = 'cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg dark:hover:shadow-gray-900/40 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900';

/**
 * BaseCard - A foundational card component with dark mode support
 * 
 * This component serves as the building block for all specialized card variants.
 * It provides consistent styling, dark mode support, and grid-safe layout.
 * 
 * @example
 * ```tsx
 * <BaseCard variant="elevated" interactive onClick={() => console.log('clicked')}>
 *   <h3>Card Title</h3>
 *   <p>Card content goes here</p>
 * </BaseCard>
 * ```
 */
export const BaseCard: React.FC<BaseCardProps> = ({
  children,
  className = '',
  onClick,
  interactive = false,
  variant = 'default',
  padding = 'md',
  as: Component = 'div',
}) => {
  const baseStyles = 'rounded-xl overflow-hidden grid-safe';
  
  const combinedStyles = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${paddingStyles[padding]}
    ${interactive ? interactiveStyles : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <Component
      className={combinedStyles}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </Component>
  );
};

export default BaseCard;

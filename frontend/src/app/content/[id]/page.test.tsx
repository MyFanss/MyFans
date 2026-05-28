/* eslint-disable @next/next/no-img-element */
import type { ComponentProps, ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContentPage from '@/app/content/[id]/page';
import { ToastProvider } from '@/contexts/ToastContext';

vi.mock('next/image', () => ({
  default: (props: ComponentProps<'img'> & { fill?: boolean; priority?: boolean }) => {
    const sanitizedProps = { ...props };
    delete sanitizedProps.fill;
    delete sanitizedProps.priority;

    return <img {...sanitizedProps} alt={props.alt ?? ''} />;
  },
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('ContentPage', () => {
  it('shows an expired subscription badge and renewal CTA on the content page', () => {
    render(
      <ToastProvider>
        <ContentPage params={Promise.resolve({ id: '1' })} />
      </ToastProvider>,
    );

    expect(
      screen.getAllByRole('status', { name: 'Subscription status: expired' }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Renew subscription' }),
    ).toBeInTheDocument();
  });

  it('updates the badge to active after subscribing again', () => {
    render(
      <ToastProvider>
        <ContentPage params={Promise.resolve({ id: '1' })} />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Renew subscription' }));

    expect(
      screen.getAllByRole('status', { name: 'Subscription status: active' }),
    ).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'Renew subscription' }),
    ).not.toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OfflineBanner } from '@/components/OfflineBanner';

describe('OfflineBanner', () => {
  it('renders nothing when status is online', () => {
    const { container } = render(<OfflineBanner status="online" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when status is checking', () => {
    const { container } = render(<OfflineBanner status="checking" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows offline message when browser is offline', () => {
    render(<OfflineBanner status="offline" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('You are offline')).toBeInTheDocument();
  });

  it('shows RPC down message when RPC is unreachable', () => {
    render(<OfflineBanner status="rpc_down" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Blockchain network unavailable')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<OfflineBanner status="rpc_down" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<OfflineBanner status="offline" />);
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('has correct aria attributes for accessibility', () => {
    render(<OfflineBanner status="offline" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
  });
});

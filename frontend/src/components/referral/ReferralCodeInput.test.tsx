import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReferralCodeInput } from './ReferralCodeInput';

describe('ReferralCodeInput', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders the input and apply button', () => {
    render(<ReferralCodeInput />);
    expect(screen.getByLabelText(/referral/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
  });

  it('uppercases typed input', () => {
    render(<ReferralCodeInput />);
    const input = screen.getByLabelText(/referral/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'alice123' } });
    expect(input.value).toBe('ALICE123');
  });

  it('shows valid status on successful validation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ valid: true }),
    } as Response);

    const onValidated = vi.fn();
    render(<ReferralCodeInput onValidated={onValidated} />);

    fireEvent.change(screen.getByLabelText(/referral/i), { target: { value: 'GOOD1234' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Code applied!'));
    expect(onValidated).toHaveBeenCalledWith('GOOD1234', true);
  });

  it('shows invalid status when code is rejected', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ valid: false, reason: 'Code not found' }),
    } as Response);

    render(<ReferralCodeInput />);
    fireEvent.change(screen.getByLabelText(/referral/i), { target: { value: 'NOPE1234' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Code not found'));
  });

  it('shows error message on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<ReferralCodeInput />);
    fireEvent.change(screen.getByLabelText(/referral/i), { target: { value: 'FAIL1234' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Could not validate code'),
    );
  });
});

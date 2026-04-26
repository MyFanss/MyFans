/**
 * Unit tests: SocialLinksForm ARIA live regions and field linkage.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SocialLinksForm } from '@/components/settings/social-links-form';

describe('SocialLinksForm – ARIA live regions', () => {
  it('shows no errors before interaction', () => {
    render(<SocialLinksForm />);
    expect(screen.queryByText(/invalid/i)).toBeNull();
  });

  it('announces website error with aria-live="polite" after blur with invalid value', () => {
    render(<SocialLinksForm />);
    const websiteInput = screen.getByLabelText(/website/i);
    fireEvent.change(websiteInput, { target: { value: 'not-a-url' } });
    fireEvent.blur(websiteInput);
    const err = screen.getByText(/invalid website url/i);
    expect(err).toHaveAttribute('aria-live', 'polite');
    expect(err).toHaveAttribute('aria-atomic', 'true');
    expect(err).toHaveAttribute('id', 'website-error');
  });

  it('sets aria-invalid on website input when error is present', () => {
    render(<SocialLinksForm />);
    const websiteInput = screen.getByLabelText(/website/i);
    fireEvent.change(websiteInput, { target: { value: 'not-a-url' } });
    fireEvent.blur(websiteInput);
    expect(websiteInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('links website input to its error via aria-describedby', () => {
    render(<SocialLinksForm />);
    const websiteInput = screen.getByLabelText(/website/i);
    fireEvent.change(websiteInput, { target: { value: 'not-a-url' } });
    fireEvent.blur(websiteInput);
    expect(websiteInput).toHaveAttribute('aria-describedby', 'website-error');
  });

  it('announces x error with aria-live="polite" after blur with invalid value', () => {
    render(<SocialLinksForm />);
    const xInput = screen.getByLabelText(/x \(twitter\)/i);
    // value with a space fails the handle regex
    fireEvent.change(xInput, { target: { value: 'bad handle' } });
    fireEvent.blur(xInput);
    const err = screen.getByText(/invalid x handle/i);
    expect(err).toHaveAttribute('aria-live', 'polite');
    expect(err).toHaveAttribute('aria-atomic', 'true');
    expect(err).toHaveAttribute('id', 'x-error');
    expect(xInput).toHaveAttribute('aria-invalid', 'true');
    expect(xInput).toHaveAttribute('aria-describedby', 'x-error');
  });

  it('clears aria-invalid when x field becomes valid', () => {
    render(<SocialLinksForm />);
    const xInput = screen.getByLabelText(/x \(twitter\)/i);
    // Make it invalid first
    fireEvent.change(xInput, { target: { value: 'bad handle' } });
    fireEvent.blur(xInput);
    expect(xInput).toHaveAttribute('aria-invalid', 'true');
    // Fix it — valid handle
    fireEvent.change(xInput, { target: { value: '@validhandle' } });
    fireEvent.blur(xInput);
    expect(xInput).not.toHaveAttribute('aria-invalid', 'true');
  });
});

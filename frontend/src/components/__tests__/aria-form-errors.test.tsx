/**
 * Unit tests: ARIA live regions on form error messages.
 *
 * Verifies that every form component that surfaces inline validation errors
 * announces them to screen readers via aria-live="polite" / aria-atomic="true"
 * and that the associated input carries aria-invalid + aria-describedby.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { FileUpload } from '@/components/ui/FileUpload';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
describe('Input – ARIA live region', () => {
  it('renders error with aria-live="polite" and aria-atomic="true"', () => {
    render(<Input label="Name" error="Name is required" />);
    const err = screen.getByText('Name is required');
    expect(err).toHaveAttribute('aria-live', 'polite');
    expect(err).toHaveAttribute('aria-atomic', 'true');
  });

  it('sets aria-invalid on the input when error is present', () => {
    render(<Input label="Name" error="Name is required" />);
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('links input to error via aria-describedby', () => {
    render(<Input label="Name" error="Name is required" />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    const errorId = input.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toHaveTextContent('Name is required');
  });

  it('does not set aria-invalid when there is no error', () => {
    render(<Input label="Name" />);
    expect(screen.getByRole('textbox', { name: 'Name' })).not.toHaveAttribute('aria-invalid', 'true');
  });
});

// ---------------------------------------------------------------------------
// Textarea
// ---------------------------------------------------------------------------
describe('Textarea – ARIA live region', () => {
  it('renders error with aria-live="polite" and aria-atomic="true"', () => {
    render(<Textarea label="Bio" error="Bio is too long" />);
    const err = screen.getByText('Bio is too long');
    expect(err).toHaveAttribute('aria-live', 'polite');
    expect(err).toHaveAttribute('aria-atomic', 'true');
  });

  it('sets aria-invalid on the textarea when error is present', () => {
    render(<Textarea label="Bio" error="Bio is too long" />);
    expect(screen.getByRole('textbox', { name: 'Bio' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('links textarea to error via aria-describedby', () => {
    render(<Textarea label="Bio" error="Bio is too long" />);
    const ta = screen.getByRole('textbox', { name: 'Bio' });
    const errorId = ta.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toHaveTextContent('Bio is too long');
  });
});

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------
describe('Select – ARIA live region', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
  ];

  it('renders error with aria-live="polite" and aria-atomic="true"', () => {
    render(<Select label="Tier" options={options} error="Select a tier" />);
    const err = screen.getByText('Select a tier');
    expect(err).toHaveAttribute('aria-live', 'polite');
    expect(err).toHaveAttribute('aria-atomic', 'true');
  });

  it('sets aria-invalid on the select when error is present', () => {
    render(<Select label="Tier" options={options} error="Select a tier" />);
    expect(screen.getByRole('combobox', { name: 'Tier' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('links select to error via aria-describedby', () => {
    render(<Select label="Tier" options={options} error="Select a tier" />);
    const sel = screen.getByRole('combobox', { name: 'Tier' });
    const errorId = sel.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toHaveTextContent('Select a tier');
  });
});

// ---------------------------------------------------------------------------
// FileUpload
// ---------------------------------------------------------------------------
describe('FileUpload – ARIA live region', () => {
  it('renders error with aria-live="polite" and aria-atomic="true"', () => {
    render(<FileUpload label="Avatar" error="File too large" />);
    const err = screen.getByText('File too large');
    expect(err).toHaveAttribute('aria-live', 'polite');
    expect(err).toHaveAttribute('aria-atomic', 'true');
  });

  it('sets aria-invalid on the drop zone when error is present', () => {
    render(<FileUpload label="Avatar" error="File too large" />);
    const zone = screen.getByRole('button');
    expect(zone).toHaveAttribute('aria-invalid', 'true');
  });

  it('links drop zone to error via aria-describedby', () => {
    render(<FileUpload label="Avatar" error="File too large" />);
    const zone = screen.getByRole('button');
    const errorId = zone.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toHaveTextContent('File too large');
  });
});

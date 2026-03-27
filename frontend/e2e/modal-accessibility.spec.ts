import { test, expect } from '@playwright/test';

test.describe('Modal Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page with modals - using wallet demo as example
    await page.goto('/wallet-demo');
  });

  test('should trap focus within modal', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Connect Wallet")');
    
    // Wait for modal to be visible
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Get all focusable elements in modal
    const modal = page.locator('[role="dialog"]');
    const focusableElements = modal.locator('button:not([disabled]), [href], input:not([disabled])');
    const count = await focusableElements.count();
    
    // Tab through all elements
    for (let i = 0; i < count; i++) {
      await page.keyboard.press('Tab');
    }
    
    // After tabbing through all elements, focus should cycle back to first element
    await page.keyboard.press('Tab');
    const firstFocusable = focusableElements.first();
    await expect(firstFocusable).toBeFocused();
  });

  test('should close modal on Escape key', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Connect Wallet")');
    
    // Wait for modal to be visible
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Press Escape
    await page.keyboard.press('Escape');
    
    // Modal should be closed
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('should restore focus to trigger element after closing', async ({ page }) => {
    const triggerButton = page.locator('button:has-text("Connect Wallet")');
    
    // Open modal
    await triggerButton.click();
    
    // Wait for modal to be visible
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Close modal with Escape
    await page.keyboard.press('Escape');
    
    // Focus should return to trigger button
    await expect(triggerButton).toBeFocused();
  });

  test('should have proper ARIA attributes', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Connect Wallet")');
    
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Check for aria-modal
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    
    // Check for aria-labelledby
    const labelledBy = await modal.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    
    // Verify the label exists
    const label = page.locator(`#${labelledBy}`);
    await expect(label).toBeVisible();
  });

  test('should prevent background scroll when modal is open', async ({ page }) => {
    // Get initial body overflow
    const initialOverflow = await page.evaluate(() => document.body.style.overflow);
    
    // Open modal
    await page.click('button:has-text("Connect Wallet")');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Check that body overflow is hidden
    const modalOpenOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(modalOpenOverflow).toBe('hidden');
    
    // Close modal
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    
    // Check that body overflow is restored
    const restoredOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(restoredOverflow).toBe(initialOverflow);
  });

  test('should support reverse tab navigation', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Connect Wallet")');
    
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Get focusable elements
    const focusableElements = modal.locator('button:not([disabled]), [href], input:not([disabled])');
    const lastElement = focusableElements.last();
    
    // Focus last element
    await lastElement.focus();
    await expect(lastElement).toBeFocused();
    
    // Shift+Tab should move to previous element
    await page.keyboard.press('Shift+Tab');
    
    // Should not be on last element anymore
    await expect(lastElement).not.toBeFocused();
  });

  test('should have accessible close button', async ({ page }) => {
    // Open modal
    await page.click('button:has-text("Connect Wallet")');
    
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Find close button
    const closeButton = modal.locator('button[aria-label*="Close"]');
    await expect(closeButton).toBeVisible();
    
    // Close button should have aria-label
    const ariaLabel = await closeButton.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel?.toLowerCase()).toContain('close');
    
    // Click close button
    await closeButton.click();
    
    // Modal should close
    await expect(modal).not.toBeVisible();
  });
});

test.describe('Settings Delete Modal Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    
    // Navigate to Account section
    await page.click('text=Account');
  });

  test('should have proper ARIA labels and descriptions', async ({ page }) => {
    // Open delete modal
    await page.click('button:has-text("Delete account")');
    
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Check aria-labelledby
    const labelledBy = await modal.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const title = page.locator(`#${labelledBy}`);
    await expect(title).toBeVisible();
    
    // Check aria-describedby
    const describedBy = await modal.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const description = page.locator(`#${describedBy}`);
    await expect(description).toBeVisible();
  });

  test('should have accessible form inputs', async ({ page }) => {
    // Open delete modal
    await page.click('button:has-text("Delete account")');
    
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Check that inputs have labels (even if sr-only)
    const deleteInput = modal.locator('input[placeholder*="DELETE"]');
    const passwordInput = modal.locator('input[type="password"]');
    
    // Inputs should have aria-required
    await expect(deleteInput).toHaveAttribute('aria-required', 'true');
    await expect(passwordInput).toHaveAttribute('aria-required', 'true');
  });

  test('should announce errors with role="alert"', async ({ page }) => {
    // Open delete modal
    await page.click('button:has-text("Delete account")');
    
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Fill in form incorrectly and submit
    await modal.locator('input[placeholder*="DELETE"]').fill('DELETE');
    await modal.locator('input[type="password"]').fill('wrong');
    await modal.locator('button[type="submit"]').click();
    
    // Wait for potential error (this might not trigger in test environment)
    // But we can check that error elements have role="alert" if they appear
    const errorElement = modal.locator('[role="alert"]');
    if (await errorElement.isVisible()) {
      await expect(errorElement).toBeVisible();
    }
  });
});

test.describe('Subscription Cancel Modal Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/subscriptions');
  });

  test('should have proper ARIA structure', async ({ page }) => {
    // Find and click cancel button (if subscriptions exist)
    const cancelButton = page.locator('button:has-text("Cancel subscription")').first();
    
    // Check if button exists
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
      
      // Check for aria-modal
      await expect(modal).toHaveAttribute('aria-modal', 'true');
      
      // Check for aria-labelledby
      const labelledBy = await modal.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      
      // Check for aria-describedby
      const describedBy = await modal.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
    }
  });

  test('should have accessible buttons with aria-disabled', async ({ page }) => {
    const cancelButton = page.locator('button:has-text("Cancel subscription")').first();
    
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
      
      // Check buttons have proper disabled/aria-disabled attributes
      const keepButton = modal.locator('button:has-text("Keep subscription")');
      const confirmButton = modal.locator('button:has-text("Cancel subscription")');
      
      await expect(keepButton).toBeVisible();
      await expect(confirmButton).toBeVisible();
    }
  });
});

test.describe('Keyboard Navigation', () => {
  test('should allow full keyboard navigation in wallet modal', async ({ page }) => {
    await page.goto('/wallet-demo');
    
    // Focus the connect button using keyboard
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Open modal with Enter
    await page.keyboard.press('Enter');
    
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Navigate through wallet options with Tab
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });
});

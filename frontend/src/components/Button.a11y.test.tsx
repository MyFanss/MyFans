import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { testAccessibility } from '@/test/utils/a11y';
import Button from '@/components/Button';

describe('Button Component', () => {
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      await testAccessibility(<Button>Click me</Button>);
    });

    it('should have proper ARIA attributes when loading', async () => {
      await testAccessibility(<Button loading>Loading</Button>);
    });

    it('should have proper ARIA attributes when disabled', async () => {
      await testAccessibility(<Button disabled>Disabled</Button>);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should be focusable', async () => {
      const user = userEvent.setup();
      render(<Button>Click me</Button>);

      const button = screen.getByRole('button', { name: /click me/i });
      await user.tab();

      expect(button).toHaveFocus();
    });

    it('should trigger onClick when Enter is pressed', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole('button', { name: /click me/i });
      button.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should trigger onClick when Space is pressed', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole('button', { name: /click me/i });
      button.focus();
      await user.keyboard(' ');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce loading state', () => {
      render(<Button loading>Loading...</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('should announce disabled state', () => {
      render(<Button disabled>Disabled</Button>);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
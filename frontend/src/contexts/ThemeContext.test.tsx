import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';
import { ReactNode } from 'react';

const STORAGE_KEY = 'myfans-theme-preference';

// Test component that uses the hook
function TestComponent() {
  const { theme, preference, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="preference">{preference}</span>
      <button onClick={() => setTheme('light')} data-testid="set-light">
        Light
      </button>
      <button onClick={() => setTheme('dark')} data-testid="set-dark">
        Dark
      </button>
      <button onClick={() => setTheme('system')} data-testid="set-system">
        System
      </button>
      <button onClick={toggleTheme} data-testid="toggle">
        Toggle
      </button>
    </div>
  );
}

function renderWithTheme(component: ReactNode) {
  return render(<ThemeProvider>{component}</ThemeProvider>);
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('throws error when useTheme used outside provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow(
      'useTheme must be used within a ThemeProvider'
    );
    spy.mockRestore();
  });

  it('initializes with system preference', () => {
    renderWithTheme(<TestComponent />);
    expect(screen.getByTestId('preference')).toHaveTextContent('system');
  });

  it('persists theme preference to localStorage', async () => {
    renderWithTheme(<TestComponent />);
    fireEvent.click(screen.getByTestId('set-dark'));
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    });
  });

  it('applies theme to document element', async () => {
    renderWithTheme(<TestComponent />);
    fireEvent.click(screen.getByTestId('set-dark'));
    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  it('toggles between light and dark', async () => {
    renderWithTheme(<TestComponent />);
    fireEvent.click(screen.getByTestId('set-light'));
    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
    });

    fireEvent.click(screen.getByTestId('toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    fireEvent.click(screen.getByTestId('toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
    });
  });

  it('restores theme from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    renderWithTheme(<TestComponent />);
    expect(screen.getByTestId('preference')).toHaveTextContent('dark');
  });

  it('sets color-scheme on document', async () => {
    renderWithTheme(<TestComponent />);
    fireEvent.click(screen.getByTestId('set-dark'));
    await waitFor(() => {
      expect(document.documentElement.style.colorScheme).toBe('dark');
    });
  });

  it('handles all theme options', async () => {
    renderWithTheme(<TestComponent />);

    fireEvent.click(screen.getByTestId('set-light'));
    await waitFor(() => {
      expect(screen.getByTestId('preference')).toHaveTextContent('light');
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
    });

    fireEvent.click(screen.getByTestId('set-dark'));
    await waitFor(() => {
      expect(screen.getByTestId('preference')).toHaveTextContent('dark');
      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    fireEvent.click(screen.getByTestId('set-system'));
    await waitFor(() => {
      expect(screen.getByTestId('preference')).toHaveTextContent('system');
    });
  });
});

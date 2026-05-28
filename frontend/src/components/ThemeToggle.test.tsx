import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeToggle, ThemeSelect, ThemeToggleWithLabel } from './ThemeToggle';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ReactNode } from 'react';

function renderWithTheme(component: ReactNode) {
  return render(<ThemeProvider>{component}</ThemeProvider>);
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders toggle button', () => {
    renderWithTheme(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('shows moon icon in light mode', () => {
    localStorage.setItem('myfans-theme-preference', 'light');
    renderWithTheme(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
  });

  it('shows sun icon in dark mode', () => {
    localStorage.setItem('myfans-theme-preference', 'dark');
    renderWithTheme(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
  });

  it('toggles theme on click', async () => {
    localStorage.setItem('myfans-theme-preference', 'light');
    renderWithTheme(<ThemeToggle />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(localStorage.getItem('myfans-theme-preference')).toBe('dark');
      expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
    });
  });

  it('has accessible button type', () => {
    renderWithTheme(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('has proper hover styles applied', () => {
    renderWithTheme(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('hover:bg-slate-100', 'dark:hover:bg-slate-800');
  });
});

describe('ThemeSelect', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders select dropdown', () => {
    renderWithTheme(<ThemeSelect />);
    expect(screen.getByLabelText('Theme')).toBeInTheDocument();
  });

  it('shows all three theme options', () => {
    renderWithTheme(<ThemeSelect />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options.length).toBe(3);
    expect(select.options[0].value).toBe('light');
    expect(select.options[1].value).toBe('dark');
    expect(select.options[2].value).toBe('system');
  });

  it('displays current preference', () => {
    localStorage.setItem('myfans-theme-preference', 'dark');
    renderWithTheme(<ThemeSelect />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('dark');
  });

  it('changes theme on selection', async () => {
    renderWithTheme(<ThemeSelect />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'dark' } });

    await waitFor(() => {
      expect(localStorage.getItem('myfans-theme-preference')).toBe('dark');
    });
  });

  it('shows descriptions for each option', () => {
    renderWithTheme(<ThemeSelect />);
    expect(screen.getByText('Always use light mode')).toBeInTheDocument();
    expect(screen.getByText('Always use dark mode')).toBeInTheDocument();
    expect(screen.getByText('Follow system preference')).toBeInTheDocument();
  });
});

describe('ThemeToggleWithLabel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders with label and current state', () => {
    renderWithTheme(<ThemeToggleWithLabel />);
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('shows system preference message', () => {
    localStorage.setItem('myfans-theme-preference', 'system');
    renderWithTheme(<ThemeToggleWithLabel />);
    expect(screen.getByText('Following system preference')).toBeInTheDocument();
  });

  it('shows explicit theme mode when not system', () => {
    localStorage.setItem('myfans-theme-preference', 'light');
    renderWithTheme(<ThemeToggleWithLabel />);
    expect(screen.getByText('Using light mode')).toBeInTheDocument();
  });

  it('toggles theme on button click', async () => {
    localStorage.setItem('myfans-theme-preference', 'light');
    renderWithTheme(<ThemeToggleWithLabel />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Using dark mode')).toBeInTheDocument();
    });
  });
});

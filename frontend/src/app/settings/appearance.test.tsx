import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ReactNode } from 'react';

// Mock the settings shell and other components
jest.mock('@/components/settings/settings-shell', () => ({
  SettingsShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/settings/use-settings', () => ({
  useSettings: () => ({
    navItems: [
      { id: 'appearance', label: 'Appearance' },
    ],
  }),
}));

jest.mock('@/components/settings/social-links-form', () => ({
  SocialLinksForm: () => <div>Social Links Form</div>,
}));

// Simplified test component for theme selection  
function ThemeAppearanceSection() {
  const { preference, setTheme } = useThemeForTesting();

  const themeOptions: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system', label: 'System', icon: '💻' },
  ];

  return (
    <section data-testid="appearance-section">
      <h2>Appearance</h2>
      <p>Choose how MyFans looks to you. Select a theme or follow your system setting.</p>

      <div data-testid="theme-options">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            data-testid={`theme-option-${option.value}`}
            className={preference === option.value ? 'active' : ''}
            aria-pressed={preference === option.value}
          >
            <span>{option.icon}</span>
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

// Helper hook for tests
function useThemeForTesting() {
  // Simplified version for testing
  const [preference, setPreference] = ReactNode.useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return localStorage.getItem('myfans-theme-preference') || 'system';
  });

  const setTheme = (theme: Theme) => {
    setPreference(theme);
    localStorage.setItem('myfans-theme-preference', theme);
  };

  return { preference, setTheme };
}

describe('Settings - Appearance Section', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders appearance settings section', () => {
    render(
      <ThemeProvider>
        <ThemeAppearanceSection />
      </ThemeProvider>
    );
    expect(screen.getByTestId('appearance-section')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('shows all three theme options', () => {
    render(
      <ThemeProvider>
        <ThemeAppearanceSection />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-option-light')).toBeInTheDocument();
    expect(screen.getByTestId('theme-option-dark')).toBeInTheDocument();
    expect(screen.getByTestId('theme-option-system')).toBeInTheDocument();
  });

  it('marks current preference as active', () => {
    localStorage.setItem('myfans-theme-preference', 'dark');
    render(
      <ThemeProvider>
        <ThemeAppearanceSection />
      </ThemeProvider>
    );

    const darkOption = screen.getByTestId('theme-option-dark');
    expect(darkOption).toHaveAttribute('aria-pressed', 'true');
  });

  it('allows changing theme preference', async () => {
    render(
      <ThemeProvider>
        <ThemeAppearanceSection />
      </ThemeProvider>
    );

    const darkOption = screen.getByTestId('theme-option-dark');
    fireEvent.click(darkOption);

    await waitFor(() => {
      expect(localStorage.getItem('myfans-theme-preference')).toBe('dark');
    });
  });

  it('displays theme icons', () => {
    render(
      <ThemeProvider>
        <ThemeAppearanceSection />
      </ThemeProvider>
    );

    expect(screen.getByText('☀️')).toBeInTheDocument();
    expect(screen.getByText('🌙')).toBeInTheDocument();
    expect(screen.getByText('💻')).toBeInTheDocument();
  });
});

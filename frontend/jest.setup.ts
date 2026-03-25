import '@testing-library/jest-dom';

// Mock next/navigation globally so components using useRouter work in jsdom
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), back: jest.fn(), push: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

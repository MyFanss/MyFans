// Jest setup file to handle UUID module issues
import { v4 as uuidv4 } from 'uuid';

// Mock UUID for tests — return unique v4-shaped values so correlation ID tests pass
let mockUuidCounter = 0;
const nextMockUuid = (): string => {
  mockUuidCounter += 1;
  return `00000000-0000-4000-8000-${String(mockUuidCounter).padStart(12, '0')}`;
};

jest.mock('uuid', () => ({
  v4: jest.fn(() => nextMockUuid()),
  __esModule: true,
  default: {
    v4: jest.fn(() => nextMockUuid()),
  },
}));

// Export mock for use in tests if needed
export { uuidv4 };

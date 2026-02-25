// Jest setup file to handle UUID module issues
import { v4 as uuidv4 } from 'uuid';

// Mock UUID for tests with a valid UUID v4 pattern
const mockUUID = '123e4567-e89b-42d3-a456-426614174000';

jest.mock('uuid', () => ({
  v4: jest.fn(() => mockUUID),
  __esModule: true,
  default: {
    v4: jest.fn(() => mockUUID),
  },
}));

// Export the mock for use in tests if needed
export { uuidv4 };

// Mock for server/index.ts — intercepted by jest.mock('../index.ts') in tests
// Provides mockDb and mockRedis that tests can control

export const mockQuery = jest.fn();
export const mockConnect = jest.fn();
export const mockClientQuery = jest.fn();
export const mockClientRelease = jest.fn();

const mockClient = {
  query: mockClientQuery,
  release: mockClientRelease
};

export const db = {
  query: mockQuery,
  connect: mockConnect
};

mockConnect.mockResolvedValue(mockClient);

export const redis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  publish: jest.fn(),
  incr: jest.fn(),
  decr: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined)
};

export const io = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn()
};

export const messageService = {};
export const notificationService = {};

// Auto-mock for server/index.ts
// Jest picks this up when jest.mock('../index') is called from tests

export const mockQuery = jest.fn();
export const mockConnect = jest.fn();

const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();

const mockClient = {
  query: mockClientQuery,
  release: mockClientRelease
};

mockConnect.mockResolvedValue(mockClient);

export const db = {
  query: mockQuery,
  connect: mockConnect
};

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

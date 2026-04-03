/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Map all imports of server/index (with or without .ts) to the mock
    '<rootDir>/server/index(\\.ts)?$': '<rootDir>/server/__mocks__/index.ts',
    '(.*)/server/index(\\.ts)?$': '<rootDir>/server/__mocks__/index.ts'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      diagnostics: false,
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
        skipLibCheck: true,
        allowImportingTsExtensions: false,
        noEmit: false,
        resolveJsonModule: true
      }
    }]
  },
  clearMocks: true,
  testTimeout: 10000
};

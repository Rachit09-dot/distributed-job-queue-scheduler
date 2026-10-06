import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Only run tests under tests/ from the root — server/src and worker/src
  // have their own jest configs and no test files at root level.
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    // Allow tests to import from server and worker source without path hacks
    '^@server/(.*)$': '<rootDir>/server/src/$1',
    '^@worker/(.*)$': '<rootDir>/worker/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          strict: false,
          esModuleInterop: true,
          module: 'commonjs',
          target: 'ES2020',
          skipLibCheck: true,
          // Allow importing from outside rootDir (server/src, worker/src)
          rootDir: '.',
        },
      },
    ],
  },
  // Global timeout for all tests
  testTimeout: 30000,
  forceExit: true,
  clearMocks: true,
};

export default config;

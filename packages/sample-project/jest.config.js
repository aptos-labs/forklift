module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  reporters: ['default'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/tests/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        types: ['jest', 'node']
      }
    }],
  },
  testTimeout: 120000 // 120 seconds for integration tests
};

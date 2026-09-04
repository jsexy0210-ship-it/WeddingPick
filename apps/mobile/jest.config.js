module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  forceExit: true,
  openHandlesTimeout: 0,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};

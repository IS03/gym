module.exports = {
  preset: 'jest-expo',
  clearMocks: true,
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
};

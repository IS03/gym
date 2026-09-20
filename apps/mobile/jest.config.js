module.exports = {
  preset: 'jest-expo',
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
};

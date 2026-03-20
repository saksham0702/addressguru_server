export default {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__tests__/setup.js'],
  transform: {}
};

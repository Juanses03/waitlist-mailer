module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    setupFiles: ['dotenv/config'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/lib/$1',
    },
  };
  
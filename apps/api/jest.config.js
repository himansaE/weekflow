/**
 * Unit tests: pure domain logic, guards and services with fakes. No database.
 * Integration tests live in ./test and run under test/jest-integration.json.
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    // Compile the shared package from source so a change there is visible to tests
    // without a rebuild step; the runtime build still consumes its dist output.
    '^@weekflow/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
    '^@weekflow/shared/(.*)$': '<rootDir>/../../../packages/shared/src/$1',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
};

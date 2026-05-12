import config from './jest.config';

describe('Jest configuration', () => {
  test('exports a valid Jest Config object', () => {
    expect(typeof config).toBe('object');
    expect(config).not.toBeNull();
  });

  test('has clearMocks set to true', () => {
    expect(config.clearMocks).toBe(true);
  });

  test('has collectCoverage enabled', () => {
    expect(config.collectCoverage).toBe(true);
  });

  test('defines coverageDirectory', () => {
    expect(config.coverageDirectory).toBe('coverage');
  });

  test('sets testMatch pattern correctly', () => {
    expect(Array.isArray(config.testMatch)).toBe(true);
    expect(config.testMatch).toContainEqual("**/src/**/*.test.?([mc])[jt]s?(x)");
  });

  test('excludes node_modules and dist in testPathIgnorePatterns', () => {
    expect(Array.isArray(config.testPathIgnorePatterns)).toBe(true);
    expect(config.testPathIgnorePatterns).toContainEqual('\\\\node_modules\\\\');
    expect(config.testPathIgnorePatterns).toContainEqual('\\\\dist\\\\');
  });
  });

  test('configures transform for TypeScript files with ts-jest and ESM', () => {
    expect(config.transform).toHaveProperty('^.+\\.tsx?$');
    const tsTransform = config.transform['^.+\\.tsx?$'];
    expect(Array.isArray(tsTransform)).toBe(true);
    expect(tsTransform[0]).toBe('ts-jest');
    expect(tsTransform[1]).toHaveProperty('useESM', true);
  });

  test('moduleNameMapper strips .js extension from relative imports', () => {
    expect(config.moduleNameMapper).toHaveProperty('^(\\.{1,2}/.*)\\.js$');
    expect(config.moduleNameMapper['^(\\.{1,2}/.*)\\.js$']).toBe('$1');
  });

  test('extensionsToTreatAsEsm includes .ts', () => {
    expect(Array.isArray(config.extensionsToTreatAsEsm)).toBe(true);
    expect(config.extensionsToTreatAsEsm).toContain('.ts');
  });

  test('roots defaults to <rootDir> when not overridden', () => {
    // roots is commented out in the source, so it should be undefined
    expect(config.roots).toBeUndefined();
  });

  test('testEnvironment is not set (defaults to jest-environment-node)', () => {
    expect(config.testEnvironment).toBeUndefined();
  });
});
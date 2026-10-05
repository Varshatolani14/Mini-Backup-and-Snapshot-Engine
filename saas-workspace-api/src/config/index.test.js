'use strict';

/**
 * Config is validated at module load time, so each test resets the module
 * registry and sets process.env before requiring it fresh.
 */

const REQUIRED_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

function loadConfigWithEnv(overrides = {}) {
  jest.resetModules();
  const originalEnv = process.env;
  const merged = { ...originalEnv, ...REQUIRED_ENV, ...overrides };
  process.env = merged;
  // Explicitly delete keys whose override value is undefined, since object
  // spread otherwise keeps them as the literal string "undefined".
  Object.entries(overrides).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
  });
  try {
    return require('./index');
  } finally {
    process.env = originalEnv;
  }
}

describe('config JWT secret validation', () => {
  it('loads successfully with valid secrets of sufficient length', () => {
    const config = loadConfigWithEnv();
    expect(config.jwt.accessSecret).toBe(REQUIRED_ENV.JWT_ACCESS_SECRET);
    expect(config.jwt.refreshSecret).toBe(REQUIRED_ENV.JWT_REFRESH_SECRET);
  });

  it('throws if JWT_ACCESS_SECRET is not set', () => {
    expect(() =>
      loadConfigWithEnv({ JWT_ACCESS_SECRET: undefined })
    ).toThrow('Missing required environment variable: JWT_ACCESS_SECRET');
  });

  it('throws if JWT_REFRESH_SECRET is not set', () => {
    expect(() =>
      loadConfigWithEnv({ JWT_REFRESH_SECRET: undefined })
    ).toThrow('Missing required environment variable: JWT_REFRESH_SECRET');
  });

  it('throws if JWT_ACCESS_SECRET is shorter than 32 characters', () => {
    expect(() =>
      loadConfigWithEnv({ JWT_ACCESS_SECRET: 'too-short' })
    ).toThrow(/JWT_ACCESS_SECRET must be at least 32 characters/);
  });

  it('throws if JWT_REFRESH_SECRET is shorter than 32 characters', () => {
    expect(() =>
      loadConfigWithEnv({ JWT_REFRESH_SECRET: 'short' })
    ).toThrow(/JWT_REFRESH_SECRET must be at least 32 characters/);
  });

  it('accepts a secret exactly 32 characters long', () => {
    const exact32 = 'c'.repeat(32);
    const config = loadConfigWithEnv({ JWT_ACCESS_SECRET: exact32 });
    expect(config.jwt.accessSecret).toBe(exact32);
  });
});

// jest.config.ts
//
// Purpose:
// - Configure Jest to run TypeScript tests in a Next.js environment.
// - Map "@/..." imports to real paths (so tests can import route handlers).
// - Load test setup file for global config.
//
// Notes:
// - testEnvironment "node" because we call route handlers directly (no DOM).
// - moduleNameMapper resolves "@/lib/*" to "<rootDir>/lib/*" etc.
// - setupFilesAfterEnv is used to reset mocks and set globals.

import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testMatch: ["**/tests/**/*.test.ts"],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};

export default config;

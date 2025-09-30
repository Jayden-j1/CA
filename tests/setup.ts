// tests/setup.ts
//
// Purpose:
// - Set up global mocks before each test run.
// - Reset Jest module cache / mocks between tests for isolation.
// - You can place shared helpers or global polyfills here if needed.
//
// Notes:
// - We rely on jest.resetModules inside individual tests to reload route handlers
//   after changing mocks for prisma or getServerSession.

beforeEach(() => {
  jest.clearAllMocks();
});

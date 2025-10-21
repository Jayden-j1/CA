// __mock__/lib/prisma.ts
//
// Purpose
// -------
// Provide a lightweight Prisma client mock for tests without breaking
// production builds (where `jest` is not present).
//
// What changed & why it fixes the build
// -------------------------------------
// - Removed ALL references to the `jest` namespace types (e.g. jest.MockedFunction),
//   which caused “Cannot find namespace 'jest'” during `next build`.
// - Declared a minimal ambient `jest` *value* shape (no types from Jest), then
//   implemented a runtime-safe fallback for `jest.fn()` so importing this file
//   outside tests won’t crash.
// - Kept the same call patterns your tests likely use: `.mockResolvedValue()`
//   and `.mockReturnValue()`.
//
// Pillars implemented
// -------------------
// ✅ Efficiency  : Tiny shim, no extra dev deps.
// ✅ Robustness  : Works in test & non-test environments.
// ✅ Simplicity  : Minimal code, clear comments.
// ✅ Ease of mgmt: Drop-in replacement; extend if your tests need more.
// ✅ Security    : No side effects; local-only mock.

// ------------------------------------------------------------
// 1) Define a tiny generic "mock function" type we control.
//    This avoids importing or referencing any Jest namespace types.
// ------------------------------------------------------------
type MockFn<T extends (...args: any[]) => any> = ((
  ...args: Parameters<T>
) => ReturnType<T>) & {
  mockResolvedValue?: (value: any) => MockFn<T>;
  mockReturnValue?: (value: any) => MockFn<T>;
};

// ------------------------------------------------------------
// 2) Declare a minimal ambient `jest` value (OPTIONAL at runtime).
//    It’s just enough for TypeScript to know that `jest?.fn` *might* exist.
//    We do NOT reference any `jest.*` types here.
// ------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const jest:
  | {
      fn: <T extends (...args: any[]) => any>(impl?: T) => MockFn<T>;
    }
  | undefined;

// ------------------------------------------------------------
// 3) Runtime-safe factory: use the real `jest.fn` if present;
//    otherwise provide a no-op stub that exposes the tiny API
//    commonly used in tests (mockResolvedValue/mockReturnValue).
// ------------------------------------------------------------
function makeSafeFn<T extends (...args: any[]) => any>(impl?: T): MockFn<T> {
  const realJestFn = (globalThis as any)?.jest?.fn as
    | (<U extends (...args: any[]) => any>(impl?: U) => MockFn<U>)
    | undefined;

  if (typeof realJestFn === "function") {
    return realJestFn<T>(impl);
  }

  // Fallback stub when Jest isn't running (e.g., during `next build`)
  let currentImpl: T | ((...a: any[]) => any) = impl ?? ((..._a: any[]) => undefined);

  const stub: any = (...args: Parameters<T>) => (currentImpl as any)(...args);

  stub.mockResolvedValue = (val: any) => {
    currentImpl = (() => Promise.resolve(val)) as T;
    return stub as MockFn<T>;
  };
  stub.mockReturnValue = (val: any) => {
    currentImpl = (() => val) as T;
    return stub as MockFn<T>;
  };

  return stub as MockFn<T>;
}

// ------------------------------------------------------------
// 4) Prisma mock shape you rely on in tests.
//    Extend with new models/methods as your tests require.
// ------------------------------------------------------------
export const prisma = {
  payment: {
    findMany: makeSafeFn<(...args: any[]) => any>(),
    findFirst: makeSafeFn<(...args: any[]) => any>(),
    create: makeSafeFn<(...args: any[]) => any>(),
    update: makeSafeFn<(...args: any[]) => any>(),
  },
  user: {
    findMany: makeSafeFn<(...args: any[]) => any>(),
    findUnique: makeSafeFn<(...args: any[]) => any>(),
    create: makeSafeFn<(...args: any[]) => any>(),
    update: makeSafeFn<(...args: any[]) => any>(),
  },
};

// Optional: convenient exported type for tests
export type PrismaMock = typeof prisma;

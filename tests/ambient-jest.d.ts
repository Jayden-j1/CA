// tests/ambient-jest.d.ts
//
// Purpose
// -------
// Provide editor IntelliSense for Jest in the /tests folder WITHOUT declaring
// globals ourselves (which can conflict if @types/jest is present elsewhere).
//
// How it works
// ------------
// - The triple-slash reference pulls in Jest's own type declarations *if* they
//   are installed in the repo (directly or via another dependency).
// - We do NOT declare any globals here, so there is nothing to conflict with.
// - `export {}` marks this file as a module to avoid polluting the global scope.
// - The /tests folder is excluded from the production tsconfig, so Next.js build
//   never type-checks this file anyway; it's for editor DX only.

/// <reference types="jest" />
export {};

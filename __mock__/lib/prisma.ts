// __mocks__/lib/prisma.ts
//
// Purpose:
// - Provide a Jest mock for "@/lib/prisma" so tests can control DB responses.
// - Exposes jest.fn() handlers for each Prisma call used by the route under test.

export const prisma = {
  payment: {
    findMany: jest.fn(), // We’ll set return values in each test
  },
  user: {
    findMany: jest.fn(), // Used by ADMIN "distinct users" list
  },
} as any;

# Testing

## Current State
**No tests exist.** Zero test files in source code (confirmed by exhaustive search).

## What's Missing
- No test framework installed (no jest, vitest, playwright, cypress in package.json)
- No test scripts in any package.json
- No test directories (no `__tests__`, `*.test.ts`, `*.spec.ts` files outside node_modules)

## Recommendation
Given Vite-based frontend: **Vitest** is natural fit for unit/integration tests.
For E2E: **Playwright** aligns with the React + TypeScript stack.

## What Should Be Tested (Priority Order)
1. Backend service layer — tenant isolation, business logic (orders, invoices, cost calculation)
2. API routes — request validation, auth middleware, error responses
3. Frontend API client — error handling, refresh token flow
4. Key UI flows — create order, generate invoice, calendar sync

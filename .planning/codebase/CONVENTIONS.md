# Code Conventions

## File Naming
- Components: `PascalCase.tsx` (e.g., `InvoiceDialog.tsx`)
- API modules: `kebab-case.api.ts` (e.g., `invoices.api.ts`)
- Backend modules: `module.routes.ts` / `module.service.ts` / `module.schema.ts`
- Shared types: `module.types.ts`

## Frontend Component Pattern
- Named exports (not default)
- Page components use `useQuery` + `useMutation` from TanStack Query
- Dialog/form components use `useForm` + `zodResolver`
- No local state for server data — all via TanStack Query

## Frontend API Pattern
```ts
export const entityApi = {
  list: () => apiClient.get<Entity[]>('/entities'),
  getById: (id: number) => apiClient.get<Entity>(`/entities/${id}`),
  create: (data: CreateEntity) => apiClient.post<Entity>('/entities', data),
  update: (id: number, data: UpdateEntity) => apiClient.put<Entity>(`/entities/${id}`, data),
  delete: (id: number) => apiClient.delete(`/entities/${id}`),
}
```

## Backend Module Pattern
- Fastify plugin per module (routes file exports plugin)
- Class-based service singletons with tenant-scoped methods
- `errors.notFound()` factory for 404s
- Route params typed via Fastify generics (frequent `as any` workaround)

## Error Handling
- Backend: `AppError` class with HTTP status
- Frontend: `onError` callback → toast notification; 401 interceptor triggers token refresh

## TypeScript
- Strict mode on both frontend and backend
- `@/*` path alias on frontend only
- Shared types imported from `packages/shared`

## Imports
- Frontend: `@/components/...`, `@/lib/...`, `@/hooks/...`
- Backend: relative imports
- Shared package imported as `@werkstatt/shared`

---
target: frontend/src/App.tsx
total_score: 21
p0_count: 1
p1_count: 3
timestamp: 2026-06-26T22-48-09Z
slug: frontend-src-app-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | No error boundary — a runtime throw produces a blank white screen |
| 2 | Match System / Real World | 4 | Route paths clean and domain-correct throughout |
| 3 | User Control and Freedom | 2 | Wildcard * → /dashboard silently swallows bad URLs |
| 4 | Consistency and Standards | 3 | Routing structure follows React Router conventions |
| 5 | Error Prevention | 1 | No error boundary — single throw crashes entire app |
| 6 | Recognition Rather Than Recall | 2 | No 404 page — bad URL looks like successful navigation |
| 7 | Flexibility and Efficiency | 2 | No lazy loading; 20+ pages in initial bundle |
| 8 | Aesthetic and Minimalist Design | 3 | Clean structure; n/a for visual design |
| 9 | Error Recovery | 1 | No error boundary + no 404 = two unrecoverable paths |
| 10 | Help and Documentation | 2 | ReactQueryDevtools ships to production (no NODE_ENV guard) |
| **Total** | | **21/40** | **Acceptable — two P0-class reliability gaps** |

## Priority Issues
[P0] No error boundary — any component throw = blank white screen, no recovery.
[P1] ReactQueryDevtools ships to production — no import.meta.env.DEV guard.
[P1] Wildcard * → /dashboard silently swallows bad URLs instead of 404.
[P1] Toaster not rendered on public routes — login/register errors silently vanish.
[P2] No code splitting — 20+ static imports, all in initial bundle.

# M6 — Global History / Calendar / Day

M6 is implemented as one unit. Physical QA must pass before CLOSED. M7 has not started.

## Scope and reads

- Progreso → Historial → Calendario → `/history/day/[date]`.
- `/api/mobile/v1/history/calendar`: server Córdoba today; default last30; explicit paired from/to ≤62; future end trimmed; wholly future rejected. Dense rows, source availability and minimal facts only.
- `/api/mobile/v1/history/days/[date]`: one composed response, completed total plus ≤3-session preview, active canonical log_date separate, pure persisted Nutrition snapshot, exact Body, recorded Metrics.
- `/api/mobile/v1/body/days/[date]`: reusable exact-date baseline; `/body/measurements/[id]` GET supports recovery when a measurement moved date.
- Authenticated security-invoker RPCs, explicit owner predicates and existing RLS. No new writer/table/materialization. Metrics archived with today values remain visible and read-only today.
- Calendar has five fixed grouped source queries per range. No per-day detail requests. Existing indexes retained after database plans; no speculative cache.

## Device QA for Nacho

1. Progreso → Historial: recent days; Calendario: previous/next month, activity indicators, both active and empty dates, future disabled.
2. Check Training-only, Nutrition-only, Body-only, Metrics-only and mixed dates when available. Raw day rows/config alone must not mark activity.
3. Global Day: four sections; missing ≠0; persisted targets/balance; Body only that date; archived metric values. Today says “Hoy · en curso”; active Training is separate and follows canonical log_date across midnight.
4. Open each domain, use its existing editor, then “Volver al día”: same original date/month and refreshed server truth. Training session → correction/discard preserves return context.
5. Delete the final fact on a test date. Global Day becomes empty; History/Calendar activity disappears after returning/focus refresh.
6. Open an old Body date beyond first pages. Edit/conflict/review: baseline comes from exact-date/measurement identity; absence in a page cannot imply deletion.
7. Archived historical metric remains correctable under existing rules; archived with today value is visible but has no editable control today.
8. Background/foreground and phone in another timezone: selected date stays fixed, server Córdoba today updates.
9. Network loss: same-date stale truth may remain, never another date/user; partial source failures preserve other sections; retry.
10. Regression: original Training history/calendar/exercise detail, Nutrition/Reports, paginated Body and Daily Metrics still work.

## Automated checks

Mobile `npm run validate`; iOS/Android exports; root typecheck/build; focused API tests. Database assertions in `supabase/tests/mobile_global_history.sql` use authenticated RLS, >1000 facts, each unavailable source, and transaction rollback. Two root baseline tests already fail on main: stale atomic-migration filename and PR73 expectation of a removed direct metric writer. M6 does not modify these sources.

Database verification passed on gym: 62-day range with 1002 completed sessions and 1001 metric values, complete aggregate RPC 9.943 ms; grouped queries 0.05–2.97 ms using existing indexes. Every availability probe and RLS assertion passed. All fixture users/rows rolled back. Migration ledger version: `20261004215505`. These are database fixture timings, not device/network latency.

## Rollout

Tests → commit/PR → Supabase EXPAND → SQL assertions and query plans → merge → Vercel Production verification → physical QA. No CONTRACT. Production publication does not replace device QA.

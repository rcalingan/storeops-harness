# Skill: sprint-decomposition

**Purpose.** How the Planner turns a one-line StoreOps feature request into `spec.md` plus a set of sprint contracts that the Generator can implement and the Evaluator can grade without asking a human anything. Read by the **Planner**. The Evaluator also reads the "AC quality" rules, so that untestable criteria can be reported as planning defects.

---

## PLAN-01 Ground the spec in the code first

Before writing anything, read the modules the feature touches: the `types`, `service`, `routes` and the existing integration test. Then check `app-context` §6 (known gaps). The spec must say:

- which existing types, service methods and events are reused;
- which known gaps the feature runs into, and whether it fixes them (in scope) or works around them (out of scope);
- which ARCH rules are **at risk**. For example, a bulk endpoint risks ARCH-06.5 and ARCH-12. A new cross-module read risks ARCH-02/03/09.

If the request is ambiguous on a point that changes behaviour (who may do it, what happens on partial failure, what gets notified), **do not guess silently**. Choose the option most consistent with existing behaviour, record it under `## Decisions & assumptions` with a one-line rationale, and mark it `[CONFIRM]` so the developer sees it at approval.

## PLAN-02 Sprint sizing

| Constraint | Limit |
|---|---|
| Sprints per spec | 1–5. If more are needed, split the feature and say so in the spec. |
| Acceptance criteria per sprint | 3–8 |
| Source files created or modified per sprint (excluding tests) | ≤ 8 |
| Modules whose **service** changes per sprint | ≤ 2 |
| New domain events per sprint | ≤ 1 |

One sprint should fit in a single Generator context and be reviewable in one Evaluator pass. If a sprint needs more than about 400 changed lines of non-test code, split it.

## PLAN-03 Every sprint ends green and shippable

`npm run check` must pass at the end of **every** sprint, not just the last one. So:

- Each sprint is a **vertical slice**: types + repository + service + route + tests, for the slice it delivers. Do not plan a "types only" sprint followed by a "tests" sprint. Tests ship with the code they cover (TEST-01).
- No sprint may leave dead code that coverage would punish, such as a repository method nothing calls yet.
- No sprint may leave a half-wired feature reachable over HTTP, such as a route mounted before its authorisation exists.

## PLAN-04 Ordering

1. Domain and service behaviour, plus the core happy-path endpoint.
2. Authorisation and store-scoping hardening, if large enough to deserve its own sprint. Otherwise fold it into sprint 1. Never defer it past the sprint that exposes the endpoint, because an exposed endpoint without authorisation is a BLOCKER (GRADE severity table).
3. Cross-module effects: new domain events, alert types, report metrics.
4. Polish: extra filters, edge cases the developer marked as nice-to-have.

Sprint N may depend only on sprints < N. State the dependency explicitly in each contract.

## PLAN-05 Acceptance criteria format

Every AC uses GIVEN / WHEN / THEN and has an ID `AC-<sprint>.<n>`:

```
AC-1.3  Cross-store update is forbidden
GIVEN an ASSOCIATE in store-002 and an activity in a store-001 programme
WHEN they PATCH /api/activities/bulk including that activity's id
THEN the response is 403 with error.code "FORBIDDEN"
AND no activity in the request is modified
Verify: integration test in tests/integration/activities.test.ts
```

AC quality rules (the Evaluator flags violations as `PLAN-05` planning defects in its notes):

- **Observable.** THEN asserts an HTTP status plus a body field, a persisted state you can read back over the API or service, an emitted event payload, or an alert visible via `GET /api/alerts`. "Code is clean" or "handles errors gracefully" are not ACs.
- **Concrete.** Name the role, the store, the exact path, the status code and the `error.code`. Use the seeded test fixtures from `how-to-test` (`users.manager`, `users.otherStore`, ...).
- **One behaviour per AC.** Use `AND` only for consequences of the same action, such as "and nothing was persisted".
- **Error paths are first-class.** Every new endpoint needs ACs for each relevant row:

| Case | Status / code | Required when |
|---|---|---|
| Happy path | 200 / 201 / 204 | always |
| Invalid body/query (assert `error.details[0].path`) | 400 `VALIDATION_ERROR` | endpoint takes input |
| Wrong role / not owner | 403 `FORBIDDEN` | endpoint has role rules |
| Other store's resource | 403 `FORBIDDEN` | endpoint touches store-owned data (ARCH-12) |
| Missing resource | 404 `NOT_FOUND` | endpoint takes an id |
| State conflict / duplicate | 409 `CONFLICT` | resource has state or uniqueness |
| Event or alert emitted (or *not* emitted when nothing changed) | — | feature changes assignment/status/membership |

The 401 path is covered globally by `tests/integration/app.test.ts`. Only add a 401 AC if the sprint mounts a router outside `authenticate`.

## PLAN-06 Contract scope

Each contract lists:

- **Files in scope**: every file the Generator may create or modify, with the reason. The Evaluator treats any edit outside this list as a scope violation (check C-08), unless it is a one-line knock-on such as an export, and the Generator declared it in "Known gaps".
- **Out of scope**: what is explicitly not being done, especially nearby known gaps.
- **Protected-file exceptions**: normally `None`. Any entry also needs a `[CONFIRM]` in the spec.
- **ARCH rules at risk**: so the Generator reads those sections closely and the Evaluator checks them first.

## PLAN-07 Spec approval gate

`spec.md` must end with the literal line `STATUS: AWAITING APPROVAL`. The Planner never writes `APPROVED`. Only the orchestrator does, after the developer types `APPROVED`. On a revision request, the Planner rewrites the affected sections, adds a `## Revision log` entry, and resets the status line to `STATUS: AWAITING APPROVAL`.

---

## Worked example: "Add shift handover bulk update to tasks"

Interpretation. At shift change, a department lead hands over a batch of open activities to the incoming shift. They reassign them and optionally set status and priority in one call. "Task" = activity (app-context §3).

Decisions & assumptions:

- `PATCH /api/activities/bulk`, body `{ activityIds: string[1..100], assigneeId?: string | null, status?, priority? }`, at least one change field. `[CONFIRM]`
- All-or-nothing: if any id is missing (404), cross-store (403) or the assignee is invalid (404), nothing is written. This follows MOD-05 and the in-memory store has no transactions. `[CONFIRM]`
- Allowed roles: `STORE_MANAGER`, `DEPARTMENT_LEAD`, and `REGIONAL_MANAGER` for any store. `ASSOCIATE` gets 403. `[CONFIRM]`
- Each activity whose assignee actually changes emits its own `activity.assigned`, so the incoming staff member receives one `TASK_ASSIGNED` alert per activity (ARCH-06.5/6).
- GAP-1 and GAP-2 on the *single-item* endpoints stay out of scope.

| Sprint | Title | Delivers | ARCH at risk |
|---|---|---|---|
| 1 | Bulk reassign endpoint | Route + zod schema, `ActivitiesService.bulkUpdate`, role + store checks, all-or-nothing validation, `activity.assigned` per changed item | 01, 06, 11, 12, 13, 15 |
| 2 | Bulk status/priority with handover audit | `status`/`priority` in bulk, `activity.status_changed` per changed item, response summary `{ updated, unchanged }` | 06, 13 |

Sprint 1 ACs (abridged): AC-1.1 happy path reassigns 3 activities → 200 and each shows the new `assigneeId`. AC-1.2 the assignee receives 3 `TASK_ASSIGNED` alerts. AC-1.3 an activity already assigned to the target produces no alert. AC-1.4 `activityIds: []` → 400 with details path `activityIds`. AC-1.5 one unknown id → 404 and no activity changed. AC-1.6 cross-store id → 403 and no activity changed. AC-1.7 ASSOCIATE → 403. AC-1.8 101 ids → 400.

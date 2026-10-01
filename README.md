# StoreOps — Retail Store Operations Management REST API

> **Capstone reference codebase — do not use in production.**
> Stub implementations backed by in-memory storage (no database). Credential handling and auth are deliberately simplistic.

## Stack

TypeScript 5.x (strict) · Express 4.x · zod · Jest + supertest · ESLint 9 + typescript-eslint · dependency-cruiser · Node ≥ 18.18

## Getting started

```bash
npm install
npm run dev          # tsx watch on http://localhost:3000 (seeds dev staff)
npm run check        # tsc --noEmit && eslint . && depcruise && jest --coverage
```

| Script | Purpose |
|---|---|
| `npm run dev` | Start with hot reload (`PORT`, `SEED=false`, `LOG_LEVEL`, `SLA_CHECK_INTERVAL_MS`) |
| `npm run build` / `npm start` | Compile to `dist/` and run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (type-aware) |
| `npm run lint:deps` | dependency-cruiser architecture rules |
| `npm test` / `npm run test:coverage` | Jest (coverage thresholds enforced) |
| `npm run check` | All of the above — the auto-check gate |

Seeded accounts (store `store-001`, region `region-north`, password `Password123!`):
`regional@`, `manager@`, `lead@`, `associate@storeops.local`.

```bash
TOKEN=$(curl -s localhost:3000/api/staff/login -H 'content-type: application/json' \
  -d '{"email":"manager@storeops.local","password":"Password123!"}' | jq -r .token)
curl -s localhost:3000/api/programmes -H "authorization: Bearer $TOKEN"
```

## Project layout

```
src/
  app.ts                  Express app: mounts routers, auth, error handling
  container.ts            Composition root: wires repositories → services, event subscriptions
  server.ts / seed.ts     Process entrypoint, SLA scheduler stub, dev seed data
  shared/
    errors/               AppError hierarchy (code, message, statusCode)
    events/               Typed EventBus + DomainEventMap catalogue
    http/                 asyncHandler, zod parseOrThrow, error/404 handlers
    clock.ts, logger.ts
  modules/<module>/
    <module>.types.ts       Entities, enums, inputs
    <module>.repository.ts  Data access (interface + in-memory implementation)
    <module>.service.ts     Business logic
    <module>.routes.ts      HTTP + validation
    <module>.events.ts      Event subscriptions (alerts, reports)
    staff.auth.ts           Bearer-token middleware (staff only)
tests/
  unit/                   AppError, EventBus
  integration/            One supertest suite per module
```

## Modules

| Module | Responsibility | Key types |
|---|---|---|
| `activities` | Restocking runs, planogram resets, compliance checks, general tasks | `Task`, `TaskStatus`, `TaskPriority`, `TaskCategory` |
| `programmes` | Store programmes and their staff membership | `Project`, `ProjectMember`, `ProjectRole` |
| `staff` | Registration, authentication, profiles | `User`, `UserProfile`, `StaffRole`, `AuthToken` |
| `alerts` | In-app alerts triggered by domain events | `Notification`, `NotificationChannel`, `NotificationStatus`, `AlertType` |
| `reports` | Read-only store metrics aggregated across modules | `Report`, `StoreMetrics` |

## API

All `/api/*` routes except `POST /api/staff/login` require `Authorization: Bearer <token>`.

**Base API surface**

| Method + Path | Description |
|---|---|
| `GET /api/activities` | List activities (`?programmeId=`, `?status=`) |
| `POST /api/activities` | Create an activity |
| `GET /api/activities/:id` | Get an activity |
| `PATCH /api/activities/:id` | Update `status`, `priority`, `category`, `assigneeId` |
| `DELETE /api/activities/:id` | Delete (owner or `STORE_MANAGER` only) |
| `GET /api/programmes` | List programmes for the caller's store |
| `POST /api/programmes` | Create a programme (store/regional managers) |
| `POST /api/programmes/:id/members` | Add a staff member to a programme |
| `GET /api/alerts` | Alerts for the caller (`?status=UNREAD|READ`) |

**Supporting endpoints** (beyond the base surface, so staff and reports have an HTTP layer)

| Method + Path | Description |
|---|---|
| `POST /api/staff/login` | Exchange email/password for a bearer token |
| `POST /api/staff` | Onboard staff (role-restricted) |
| `GET /api/staff/me`, `PATCH /api/staff/me` | Caller profile |
| `GET /api/reports` | Stored report snapshots (`?storeId=` for regional managers) |
| `POST /api/reports/store-summary` | Generate a STORE_SUMMARY on demand |
| `GET /health` | Liveness |

Errors always use the shape `{ "error": { "code", "message", "details?" } }`.

## Architecture rules

| Rule | Enforcement |
|---|---|
| **Layer separation** — Routes → Service → Repository, no skipping. Routes do HTTP + validation only; services are HTTP-agnostic; repositories are leaves. | dependency-cruiser: `routes-not-to-repository`, `service-not-to-http`, `repository-is-a-leaf` |
| **Module boundary** — never import another module's repository; cross-module reads go through its service. Staff is read-only to other modules. | dependency-cruiser: `no-cross-module-repository` |
| **Event bus only** — cross-module side effects use `EventBus.emit()`; nothing imports `alerts` or `reports`. | dependency-cruiser: `no-direct-alerts-import`, `no-direct-reports-import` |
| **No cycles** | dependency-cruiser: `no-circular` |
| **Error contract** — no raw `throw new Error()` in `src/`; throw `AppError` subclasses. | ESLint `no-restricted-syntax` + `@typescript-eslint/only-throw-error` |

Only `container.ts` and `app.ts` (the composition root) know about every module.

### Domain events

| Event | Producer | Consumer → effect |
|---|---|---|
| `activity.assigned` | activities | alerts → `TASK_ASSIGNED` to assignee |
| `activity.sla_breached` | activities (`checkSlaBreaches`, run by the scheduler) | alerts → `SLA_BREACH` to creator + assignee |
| `activity.status_changed` | activities | — (extension point) |
| `programme.member_added` | programmes | alerts → `PROGRAMME_MEMBER_ADDED` to new member |
| `programme.closed` | programmes (`close`) | reports → `STORE_SUMMARY` snapshot |
| `inventory.low_stock` | — (no producer yet) | alerts → `INVENTORY_LOW` to store managers |

## Agent harness

StoreOps includes a Planner → Generator ⇄ Evaluator → Monitor agent harness for Claude Code. `CLAUDE.md` is the orchestrator. Agent definitions are in `.harness/agents/`, project-specific skill files in `.harness/skills/`, handoff templates in `.harness/templates/`, and the review archive in `.harness/reviews/`.

```text
@planner Add shift handover bulk update to tasks    # Planner writes .harness/output/spec.md + sprint contracts
APPROVED                                            # Generator/Evaluator loop runs until every sprint passes or escalates
```

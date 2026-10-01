# Skill: app-context

**Purpose.** The facts every harness agent needs about StoreOps before planning, writing or reviewing anything: what the product is, who uses it, what each module owns, the domain vocabulary, and the known gaps in the current codebase. Read by **all agents**. If any other skill or a sprint contract disagrees with this file about how the system *currently* behaves, the code wins. Report the mismatch in your handoff file so the Monitor can flag this skill for an update.

---

## 1. Product

StoreOps is a REST API for running retail store operations: restocking runs, planogram resets, compliance checks, store programmes (seasonal rollouts, refits), staff onboarding, in-app alerts and store metric reports.

- **This is a capstone reference codebase.** Storage is in-memory, with no database, no migrations and no external services. Auth is a simple opaque bearer token. Keep this in mind when you plan or build. Do **not** add a database, ORM, queue, cache or auth library unless a sprint contract explicitly says to.
- Stack: TypeScript 5 (strict) · Express 4 · zod 3 · Jest 29 + ts-jest + supertest · ESLint 9 (type-aware typescript-eslint) · dependency-cruiser 16 · Node ≥ 18.18 (`.nvmrc` = 18).
- Entry points: `src/server.ts` (process, SLA scheduler stub), `src/app.ts` (Express wiring), `src/container.ts` (composition root), `src/seed.ts` (dev data).

## 2. Users and roles

Every staff member has exactly one `StaffRole`, one `storeId` and one `regionId`.

| Role | Typical person | What they can do today |
|---|---|---|
| `REGIONAL_MANAGER` | Oversees several stores in a region | Onboard any role · create programmes · manage **any** programme · view reports for **any** store (`?storeId=`) |
| `STORE_MANAGER` | Runs one store | Onboard `DEPARTMENT_LEAD` / `ASSOCIATE` for **own store only** · create programmes · manage programmes where they are a `STORE_MANAGER` member · delete any activity · view own-store reports |
| `DEPARTMENT_LEAD` | Leads a department (e.g. grocery) | Create/update activities · delete own activities · view own-store reports |
| `ASSOCIATE` | Shop-floor staff | Create/update activities · delete own activities · **cannot** view reports |

The authorisation rules live in the services: `StaffService.CAN_CREATE`, `ProgrammesService.assertCanManage`, `ActivitiesService.delete`, `ReportsService.resolveStore`. New rules must go in services too (see `architecture-principles` ARCH-11).

## 3. Modules

| Module (path) | Owns | Entity type names | Notes |
|---|---|---|---|
| `activities` | Operational tasks | `Task`, `TaskStatus` (`TODO, IN_PROGRESS, DONE, BLOCKED`), `TaskPriority` (`LOW, MEDIUM, HIGH, CRITICAL`), `TaskCategory` (`RESTOCKING, PLANOGRAM, AUDIT, COMPLIANCE, GENERAL`) | Each `Task` belongs to one programme (`programmeId`). Defaults: `TODO`, `MEDIUM`, `GENERAL`. |
| `programmes` | Store programmes and their membership | `Project`, `ProjectMember`, `ProjectRole` (`STORE_MANAGER, DEPARTMENT_LEAD, ASSOCIATE`), `ProgrammeStatus` (`ACTIVE, CLOSED`) | The creator is added as a `STORE_MANAGER` member. A programme belongs to the creator's store. A closed programme rejects new members (409). |
| `staff` | Accounts, auth tokens, profiles | `User` (has `passwordHash`), `UserProfile` (public view, no hash), `AuthUser` (request identity), `AuthToken` | Token TTL 8h. `passwordHash` never leaves the module. Other modules get `UserProfile` only. |
| `alerts` | In-app notifications | `Notification`, `AlertType` (`SLA_BREACH, TASK_ASSIGNED, PROGRAMME_MEMBER_ADDED, INVENTORY_LOW`), `NotificationStatus`, `NotificationChannel` | **Reacts to domain events only.** Nothing imports it. |
| `reports` | Store metric snapshots | `Report`, `StoreMetrics`, `ReportTrigger` | Read-only aggregation over the activities, programmes and staff services. Driven by the `programme.closed` event and `POST /api/reports/store-summary`. Nothing imports it. |

### Vocabulary: retail terms vs type names

The HTTP surface, module folders and error messages use **retail terms**. The TypeScript entity types keep their original generic names. Do not rename existing types. Use these pairs consistently:

| Say / route / error resource | Type in code |
|---|---|
| activity (`/api/activities`, `NotFoundError('Activity', id)`) | `Task` |
| programme (British spelling, everywhere: `/api/programmes`, `programmeId`, `NotFoundError('Programme', id)`) | `Project` |
| staff member (`/api/staff`, `NotFoundError('Staff member', id)`) | `User` / `UserProfile` |
| alert (`/api/alerts`) | `Notification` |

A feature request that says "task" means **activity**. A feature request that says "project" means **programme**.

## 4. Business rules already in the code

- **SLA breach:** an activity is breached when `priority === 'CRITICAL'`, `status !== 'DONE'`, `dueDate < now`, and it was not already flagged (`slaBreachedAt === null`). `checkSlaBreaches()` flags each one once and emits `activity.sla_breached`. `server.ts` runs it every `SLA_CHECK_INTERVAL_MS` (default 60 s).
- **Assignment:** creating an activity with an assignee, or changing `assigneeId` to a different non-null value, emits `activity.assigned`. Alerts turns this into a `TASK_ASSIGNED` notification.
- **Status change:** a changed `status` emits `activity.status_changed`. This event has no consumer yet.
- **Delete:** only the activity's `createdBy`, or any `STORE_MANAGER`, may delete it.
- **Programme membership:** the new member must exist, must be in the same store as the programme, and must not already be a member. The programme must be `ACTIVE`.
- **Reports:** `completionRate` = DONE / total, rounded to 4 dp. "Overdue" counts any activity that is not DONE and has `dueDate < now`, whatever its priority.

## 5. Domain events (catalogue: `src/shared/events/domain-events.ts`)

| Event | Producer | Consumer → effect |
|---|---|---|
| `activity.assigned` | `ActivitiesService.create/update` | alerts → `TASK_ASSIGNED` to assignee |
| `activity.status_changed` | `ActivitiesService.update` | *(none, extension point)* |
| `activity.sla_breached` | `ActivitiesService.checkSlaBreaches` | alerts → `SLA_BREACH` to creator + assignee |
| `programme.member_added` | `ProgrammesService.addMember` | alerts → `PROGRAMME_MEMBER_ADDED` to new member |
| `programme.closed` | `ProgrammesService.close` | reports → `STORE_SUMMARY` snapshot (`trigger: PROGRAMME_CLOSED`) |
| `inventory.low_stock` | *(none, no inventory module yet)* | alerts → `INVENTORY_LOW` to every `STORE_MANAGER` in the store |

`EventBus.emit` awaits every handler but isolates failures: a handler that throws is logged and never fails the producer.

## 6. Known gaps (do not copy these; do not fix them silently)

These are real defects or missing pieces in the baseline. A sprint may fix one only if its contract says so. Otherwise new code must **not copy** the pattern, and reviewers must not mark existing occurrences as findings against the current sprint.

| ID | Gap | Implication for new work |
|---|---|---|
| GAP-1 | `GET/PATCH/DELETE /api/activities` are **not store-scoped**. Any authenticated user can read or patch activities in another store's programmes. | New activity endpoints **must** check that the programme's `storeId` matches `actor.storeId` (unless `REGIONAL_MANAGER`). See ARCH-12. |
| GAP-2 | `PATCH /api/activities/:id` has **no authorisation** beyond authentication. Any role can change any field. | New mutation endpoints must state their role rules explicitly in the contract. |
| GAP-3 | `ProgrammesService.close` exists but has **no HTTP route**. The service is exercised directly in tests. | A "close programme" feature only needs to add the route and tests. |
| GAP-4 | `inventory.low_stock` has **no producer**. | An inventory feature should emit this event, not import alerts. |
| GAP-5 | Status transitions are **unrestricted**: any status can move to any other, e.g. `DONE → TODO`. | If a feature needs a state machine, the contract must define it. |
| GAP-6 | There is no pagination on any list endpoint. | Do not add pagination ad hoc. If needed, the contract defines `limit`/`offset` semantics. |
| GAP-7 | There is no CI pipeline config in the repo. `npm run check` is the only gate. | See CLAUDE.md, "CI/CD relationship". |

## 7. Commands

| Command | What it runs |
|---|---|
| `npm run typecheck` | `tsc --noEmit` (src + tests) |
| `npm run lint` | `eslint .` (type-aware, error-contract rule, no-console) |
| `npm run lint:deps` | `depcruise src --config .dependency-cruiser.cjs` (architecture rules) |
| `npm test` / `npm run test:coverage` | Jest; coverage thresholds in `package.json` |
| `npm run check` | All four in sequence. **This is the gate.** |
| `npx jest tests/integration/<module>.test.ts` | One suite (fast feedback while iterating) |

**Baseline (2026-10-01, commit `cbbb5a8`):** 8 suites / 59 tests passing. Coverage: statements 97.52%, branches 80.70%, functions 98.64%, lines 98.61%. Global thresholds: statements 80, branches 65, functions 75, lines 80. A full `npm run check` takes about 30–60 s on a dev laptop.

Seeded dev accounts (`npm run dev`): `regional@`, `manager@`, `lead@`, `associate@storeops.local`, all with password `Password123!`, store `store-001`, region `region-north`.

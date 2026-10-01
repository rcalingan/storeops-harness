# Skill: architecture-principles

**Purpose.** These are the binding architecture rules for StoreOps. Each rule has a stable ID (`ARCH-NN`). The Planner uses them to scope sprints, the Generator must follow them, the Evaluator cites them in findings, and the Monitor counts violations per ID to detect skill drift. Read by **all agents**.

Some rules are **tool-enforced**: `npm run lint:deps` or `npm run lint` fails on violation. Others are **review-enforced**: only the Evaluator catches them. Review-enforced rules cause most real defects, so they get the most detail below.

> Never weaken a tool-enforced rule to make a sprint pass. The rule configuration files are protected (ARCH-16).

---

## Rule index

| ID | Rule | Enforcement |
|---|---|---|
| ARCH-01 | Layering: routes → service → repository, no skipping | depcruise `routes-not-to-repository`, `service-not-to-http`, `repository-is-a-leaf` + review |
| ARCH-02 | Never import another module's repository | depcruise `no-cross-module-repository` |
| ARCH-03 | Cross-module service deps are constructor-injected and imported as types | review |
| ARCH-04 | Other modules use staff read-only | review |
| ARCH-05 | Side effects into alerts/reports go only through the event bus | depcruise `no-direct-alerts-import`, `no-direct-reports-import` |
| ARCH-06 | Event emission discipline | review |
| ARCH-07 | Composition root owns wiring; `/api` is authenticated | review |
| ARCH-08 | Shared kernel depends only on module types | depcruise `shared-not-to-modules` |
| ARCH-09 | No circular dependencies | depcruise `no-circular` |
| ARCH-10 | Error contract: AppError subclasses only, mapped centrally | ESLint `no-restricted-syntax`, `only-throw-error` + review |
| ARCH-11 | Authorisation lives in services and uses the actor | review |
| ARCH-12 | Store scoping for every new read/write path | review |
| ARCH-13 | Time comes from the injected `Clock` | review |
| ARCH-14 | Repository contract | review |
| ARCH-15 | Validate at the edge with zod | review |
| ARCH-16 | Protected files | Evaluator check C-07 |
| ARCH-17 | No new runtime dependencies without contract approval | Evaluator check C-07 (`package.json`) |

---

## ARCH-01 Layering

```
<module>.routes.ts  ──►  <module>.service.ts  ──►  <module>.repository.ts
     (HTTP + zod)          (business logic)          (data access, leaf)
```

- **Routes** parse input with `parseOrThrow`, read the actor with `getAuthUser(res)`, call **one** service method, and choose the status code. Routes contain no `if` that decides business outcomes, no authorisation checks and no event emission.
- **Services** are HTTP-agnostic. A service must not import `express`, `src/shared/http/*`, `*.routes.ts` or `*.auth.ts`. A service never receives `req`/`res`.
- **Repositories** are leaves. A repository must not import services, routes, the event bus or HTTP.
- `*.events.ts` files (alerts, reports) are subscription adapters. They call their own module's service and may read other modules' **services** (e.g. `alerts.events.ts` uses `StaffService.list`).

## ARCH-02 Module boundary

A module never imports another module's `*.repository.ts`. Cross-module reads go through the owning module's service. `ActivitiesService.create` checks that the programme exists with `this.programmes.getById(...)`, not with the programmes repository.

## ARCH-03 Cross-module service dependencies

- Inject them through the constructor. Import them with `import type { XService } from '../x/x.service'`.
- Only `src/container.ts` instantiates services and repositories (`new XService(...)`, `new InMemoryXRepository()`).
- If a new dependency would create a cycle (e.g. programmes needing activities while activities already needs programmes), **stop**. Use an event, or restructure as the contract allows. Never use lazy `require` or setter injection to dodge `no-circular`.

## ARCH-04 Staff is read-only to other modules

Outside `src/modules/staff/`, only these `StaffService` methods may be called: `getById`, `list`. HTTP code also uses `authenticate`, via `createAuthenticate` in `staff.auth.ts`. Other modules may import `getAuthUser` and the `AuthUser`/`UserProfile`/`StaffRole` types. Calling `createStaff`, `updateProfile` or `login` from another module is a violation. `passwordHash` / `User` must never appear outside the staff module.

## ARCH-05 Event bus only

Nothing outside `alerts/` imports from `src/modules/alerts/`. Nothing outside `reports/` imports from `src/modules/reports/`. To cause an alert or a report, emit a domain event. If no suitable event exists, add one to `DomainEventMap` (procedure in `module-patterns` MOD-04).

## ARCH-06 Event emission discipline

1. Only **services** call `this.events.emit(...)`. Routes and repositories never do.
2. Emit **after** the repository write succeeds, and `await` the emit. `EventBus.emit` is deterministic in tests.
3. Payloads are plain serialisable data: IDs, enums, ISO strings and display strings such as `title`. Never put whole entities, class instances, `Date` objects or functions in a payload.
4. A producer must not depend on a handler's outcome. Handler failures are swallowed and logged by design.
5. Bulk operations emit **one event per affected entity**, after **all** writes have completed. See MOD-05.
6. Only emit when something actually changed. `ActivitiesService.update` emits `activity.status_changed` only when `patch.status !== existing.status`. Copy that guard.

## ARCH-07 Composition root and authentication

- New repositories, services and event subscriptions are wired in `src/container.ts` and exposed on the `Container` interface. New routers are mounted in `src/app.ts`.
- Every `/api/*` router is mounted **behind `authenticate`**. The only exception is the existing public login router. A new public endpoint must be named as public in the sprint contract.
- Subscription registrars return an unsubscribe function, which goes in the `unsubscribers` array so that `dispose()` works.

## ARCH-08 Shared kernel

`src/shared/**` holds cross-cutting infrastructure only: errors, events, http helpers, clock, logger. It may import from `src/modules/**/*.types.ts` and nothing else in modules. Business rules never go in `shared/`.

## ARCH-09 No cycles

There must be no circular imports anywhere in `src`. Type-only imports count too (`tsPreCompilationDeps: true`).

## ARCH-10 Error contract

- Throw only `AppError` subclasses from `src/shared/errors`: `ValidationError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `InternalError` (500).
- Never write an error response by hand (`res.status(4xx).json(...)`). Throw, and let `errorHandler` produce `{ "error": { "code", "message", "details?" } }`.
- Async route handlers are wrapped in `asyncHandler` so rejections reach `errorHandler`.
- `catch` only to *translate* a failure into an `AppError`. Never swallow. Never catch just to log and continue, except in fire-and-forget scheduler code in `server.ts`.
- The `ErrorCode` union is closed. Adding a code changes `src/shared/errors/app-error.ts` and needs the contract to say so.

## ARCH-11 Authorisation in services

- Every service method that acts on behalf of a user takes `actor: AuthUser` as its **first** parameter, for example `create(actor, input)` or `update(actor, id, patch)`.
- Role and ownership checks happen inside the service and throw `ForbiddenError` with a message that names the rule ("Only the activity owner or a store manager can delete this activity").
- Look the resource up **before** checking permissions on it, so a missing resource is a 404, not a 403. This matches `ActivitiesService.delete` and `ProgrammesService.addMember`.
- Shared checks go in a `private assertCanX(actor, resource): void` helper, like `ProgrammesService.assertCanManage`.

## ARCH-12 Store scoping (multi-store tenancy)

Every **new** endpoint or service method that reads or mutates store-owned data must enforce:

- A non-`REGIONAL_MANAGER` actor may only touch resources whose `storeId` equals `actor.storeId`. For activities, the store is found through the programme: `(await this.programmes.getById(task.programmeId)).storeId`.
- Cross-store access throws `ForbiddenError` (403). This matches `ReportsService.resolveStore`.
- `REGIONAL_MANAGER` may cross stores, as in the existing reports behaviour. There is no region check today. Do not add one unless the contract asks.
- List endpoints filter to the actor's store. They do not return everything and filter on the client.

The existing activity endpoints break this rule (app-context GAP-1). That is not a precedent.

## ARCH-13 Time

- Services take `clock: Clock = systemClock` as their **last** constructor parameter and use `this.clock()` to get "now".
- `new Date()` with no argument and `Date.now()` are forbidden in services, repositories and event handlers. `new Date(someIsoString)` for parsing is fine.
- Persist timestamps as ISO-8601 strings (`this.clock().toISOString()`). Capture `now` **once** per operation, so that a bulk update gives every item the same `updatedAt`.

## ARCH-14 Repository contract

- Put an `interface XRepository` and `class InMemoryXRepository implements XRepository` in the same `<module>.repository.ts`.
- Every method returns a `Promise`, even in memory, so a real database can be swapped in later.
- Return **defensive copies** (`{ ...item }`). Never hand out the stored object.
- Filtering uses an optional typed filter object (`findAll(filter: XFilter = {})`). No business rules, authorisation or validation in repositories.
- New bulk read helpers such as `findByIds(ids)` are fine. Bulk **write** helpers must still be leaf operations with no logic.

## ARCH-15 Validate at the edge

- Every `req.body`, `req.query` and `req.params` goes through a zod schema and `parseOrThrow`, defined at the top of the routes file.
- Build enum schemas from the `as const` arrays in `*.types.ts` (`z.enum(TASK_STATUSES)`). Never re-list the literals.
- PATCH bodies use `.strict()` and reject empty objects, following `updateSchema` in `activities.routes.ts`.
- Put bounds on unbounded input: string `.max(...)` and array `.min(1).max(N)`. The contract sets N; the default bulk cap is 100.
- Services may assume a correctly typed input, but they still enforce invariants that need data: existence, state, membership, ownership.

## ARCH-16 Protected files

The Generator must **not** modify these files. Any change is an automatic BLOCKER (Evaluator check C-07), unless the sprint contract lists the file under "Protected-file exceptions" and the developer approved the spec:

- `.dependency-cruiser.cjs`, `eslint.config.mjs`, `tsconfig.json`, `tsconfig.build.json`, `.nvmrc`
- `package.json`, the `scripts`, `jest` (including `coverageThreshold`) and `dependencies`/`devDependencies` sections; `package-lock.json`
- `tests/helpers/test-app.ts`. Adding new exported helpers is allowed. Changing the behaviour of existing ones is not.
- Harness definitions: `.harness/agents/**`, `.harness/skills/**`, `.harness/templates/**`, `.harness/reviews/**`, `CLAUDE.md`, `.claude/**`
- Other agents' handoff files in `.harness/output/`. The Generator writes only `generator-summary.md`. It reads the spec, contracts, feedback, carry-over and state, but never edits them.

Disabling lint rules inline (`// eslint-disable`, `@ts-ignore`, `@ts-expect-error`) or adding `/* istanbul ignore */` counts as weakening a gate. It is a BLOCKER too.

## ARCH-17 Dependencies

Do not add npm packages. The existing stack (express, zod, node built-ins such as `node:crypto`) covers everything StoreOps needs. If a contract truly needs a package, it names the package and version, and lists `package.json` as a protected-file exception.

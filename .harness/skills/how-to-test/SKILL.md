# Skill: how-to-test

**Purpose.** How StoreOps code is tested: which harness to use, which cases every endpoint needs, how to make tests traceable to acceptance criteria, and the coverage bar a sprint must clear. Read by the **Generator** to write tests and by the **Evaluator** to judge whether a test really proves an AC. Rule IDs are `TEST-NN`.

---

## TEST-01 Tests ship with the code

Every sprint adds or extends tests for every AC in the same sprint. A sprint that adds behaviour without a test proving each AC fails, even if coverage stays above threshold.

## TEST-02 Where tests go

| Kind | Location | Use for |
|---|---|---|
| Integration (default) | `tests/integration/<module>.test.ts`, extending the existing file | Anything reachable over HTTP. Drive it with `supertest` against `ctx.app` |
| Integration, service-level | Same file, its own `describe` | Behaviour with no HTTP trigger: scheduler-driven `checkSlaBreaches`, `ProgrammesService.close` while GAP-3 is open, event-driven effects |
| Unit | `tests/unit/<subject>.test.ts` | Pure shared infrastructure (`AppError`, `EventBus`) or a pure helper function with branching logic |

Do not create a new integration file for a module that already has one. Add a `describe('<METHOD> <path>')` block to the existing file.

## TEST-03 The test harness: `tests/helpers/test-app.ts`

```ts
import request from 'supertest';
import { createProgramme, setupTestApp, type TestContext } from '../helpers/test-app';

let ctx: TestContext;
beforeEach(async () => {
  ctx = await setupTestApp();                 // fresh container per test, no shared state
});
```

- `setupTestApp(options?)` builds a **new** container and app. It returns `ctx.app`, `ctx.container` (all services plus `events`), `ctx.users` and `ctx.createUser(role, overrides?)`.
- Fixture users, with `storeId` `store-001` and region `region-north` unless stated: `ctx.users.regional`, `.manager`, `.lead`, `.associate`, and `.otherStore` (an ASSOCIATE in **`store-002`**). Each has `.profile` (the `UserProfile`), `.token` and `.auth`, which goes in `.set(user.auth)`.
- For a manager or lead in another store: `await ctx.createUser('STORE_MANAGER', { storeId: 'store-002' })`.
- `createProgramme(ctx, owner?, name?)` creates a programme over HTTP (default owner `users.manager`) and returns `{ id, name, storeId }`. To get a programme in another store, pass a store-002 manager as owner.
- **Time:** pass a mutable clock: `let now = new Date('2026-03-01T09:00:00Z'); const ctx = await setupTestApp({ clock: () => now });`. Then reassign `now` to move time. Never use `jest.useFakeTimers()` or real `setTimeout` waits.
- You may add new exported helpers to `test-app.ts`. Do not change existing helpers' behaviour (ARCH-16).

## TEST-04 Required case matrix per endpoint

For each new or changed endpoint, cover every row that applies. These mirror PLAN-05, so the ACs and tests line up.

| Case | How to assert |
|---|---|
| Happy path | `.expect(200/201/204)`, then `expect(res.body).toMatchObject({...})` on the fields the AC names. Read the state back with a GET to prove persistence. |
| Validation | `.expect(400)` and `expect(res.body.error.details[0].path).toBe('<field>')` (dotted path for nested, e.g. `activityIds.0`) |
| Role denied | `.expect(403)` and `expect(res.body.error.code).toBe('FORBIDDEN')` |
| Cross-store | Use `ctx.users.otherStore`, or a resource in a store-002 programme. Expect 403 `FORBIDDEN`. **Then read the resource back and assert it is unchanged.** |
| Not found | `.expect(404)` and `error.code` `NOT_FOUND` |
| Conflict | `.expect(409)` and `error.code` `CONFLICT` |
| All-or-nothing | After a failing bulk request, GET every item in the request and assert none changed |
| Event emitted | `const handler = jest.fn(); ctx.container.events.on('<event>', handler);` then `expect(handler).toHaveBeenCalledWith(expect.objectContaining({...}))`. Use `toHaveBeenCalledTimes(n)` for bulk. |
| Event **not** emitted | Same, with `expect(handler).not.toHaveBeenCalled()` for the no-change case |
| Alert delivered | `request(ctx.app).get('/api/alerts').set(recipient.auth)` and assert the `type`/`status`. Or use `ctx.container.alertsService.listForUser(id)` in service-level tests |

401 is covered globally in `tests/integration/app.test.ts`. Don't repeat it per endpoint (PLAN-05).

## TEST-05 AC traceability

Every AC in the sprint contract maps to at least one `it(...)` whose title **starts with the AC ID**:

```ts
it('AC-1.6 rejects a cross-store activity and modifies nothing', async () => { ... });
```

One test may cover several ACs if they come from the same action: `it('AC-1.1 AC-1.2 reassigns and alerts the assignee', ...)`. The Generator's self-check table cites the test title for each AC, and the Evaluator greps for the ID. Existing tests have no IDs. Don't rename them.

## TEST-06 Assertion style

- Use `toMatchObject` / `expect.objectContaining` for response bodies. Never snapshot tests (no `toMatchSnapshot`).
- Don't assert on generated values (UUIDs, `createdAt`) beyond their presence or type. With an injected clock you *may* assert exact timestamps.
- Assert `error.code`, not `error.message` text, unless the AC names the message.
- Each test sets up its own data. No ordering dependencies between `it` blocks, and no module-level mutable state other than `ctx`.
- No `.only`, `.skip`, `xit` or `fit` in committed tests. No `console.log`.

## TEST-07 Coverage bar

Two thresholds apply:

1. **Global (tool-enforced):** `package.json` `coverageThreshold` is statements 80 / branches 65 / functions 75 / lines 80. `npm run check` fails below it.
2. **Harness ratchet (Evaluator check C-06):**
   - Every **new** file in `src/` (except `*.types.ts` files with no runtime code) needs ≥ 90% lines and ≥ 80% branches.
   - Every **modified** file in `src/` must not drop below its baseline line or branch coverage by more than 1.0 percentage point.
   - Global coverage must not fall more than 1.0 pp below the run baseline recorded in `.harness/output/harness-state.md`.

Read per-file coverage from the text table printed by `npm run test:coverage`.

## TEST-08 Commands

| Purpose | Command |
|---|---|
| One suite while iterating | `npx jest tests/integration/activities.test.ts` |
| One test by name | `npx jest tests/integration/activities.test.ts -t "AC-1.6"` |
| Coverage table | `npm run test:coverage` |
| Full gate (must pass before handoff) | `npm run check` |

`NODE_ENV=test` silences the logger, so Jest sets it automatically. Do not add logging to make a test debuggable.

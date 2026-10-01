# Skill: module-patterns

**Purpose.** Step-by-step recipes for the changes StoreOps sprints actually make: adding an endpoint, adding a service method with authorisation and store scoping, adding a domain event and its alert, adding a bulk operation, and adding a new module. Each recipe lists every file to touch, so nothing is left unwired. Read by the **Generator**. Rule IDs are `MOD-NN`. The architecture reasons behind each step are in `architecture-principles`.

---

## MOD-01 Add an endpoint to an existing module

Files: `<module>.types.ts` (input type, if new) → `<module>.service.ts` (method) → `<module>.routes.ts` (schema + handler) → `tests/integration/<module>.test.ts`.

```ts
// <module>.routes.ts — schemas live at the top of the file, built from the `as const` arrays
const bulkUpdateSchema = z
  .object({
    activityIds: z.array(z.string().min(1)).min(1).max(100),
    assigneeId: z.string().min(1).nullable().optional(),
    status: z.enum(TASK_STATUSES).optional(),
  })
  .strict()
  .refine((b) => b.assigneeId !== undefined || b.status !== undefined, {
    message: 'At least one change field must be provided',
  });

router.patch(
  '/bulk',                                   // static segments BEFORE '/:id' (see MOD-06)
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(bulkUpdateSchema, req.body);
    res.json(await service.bulkUpdate(getAuthUser(res), input));
  }),
);
```

Status codes: `201` + created entity for POST-create (including sub-resources such as `POST /:id/members`). `200` + entity or array for GET/PATCH. `204` with `.send()` and no body for DELETE. For an action endpoint, e.g. `POST /:id/close`, return `200` and the updated entity.

## MOD-02 Service method with authorisation and store scoping

Order inside the method. Each step throws before any write:

1. **Load** the target(s) → `NotFoundError` if missing.
2. **Authorise** the role/ownership → `ForbiddenError` (ARCH-11).
3. **Scope** to the store → `ForbiddenError` (ARCH-12).
4. **Check state/conflicts** → `ConflictError` / `ValidationError`.
5. **Validate referenced entities** through their owning service (`this.staff.getById(assigneeId)`) → 404.
6. Capture `const now = this.clock().toISOString()` **once**.
7. **Write** through the repository.
8. **Emit** events for what actually changed (ARCH-06).
9. Return the persisted result.

Store resolution for activities goes through the programme:

```ts
private async assertSameStore(actor: AuthUser, task: Task): Promise<void> {
  if (actor.role === 'REGIONAL_MANAGER') return;
  const programme = await this.programmes.getById(task.programmeId);
  if (programme.storeId !== actor.storeId) {
    throw new ForbiddenError('Activities can only be changed by staff of the programme\'s store');
  }
}
```

If several items share a programme, cache programme lookups in a `Map` inside the method. This is a single in-request cache, not a module-level one.

## MOD-03 Role rules

Express a rule as a readonly constant next to the service when more than one method uses it. This follows `CAN_CREATE` in `staff.service.ts`:

```ts
const CAN_BULK_UPDATE: readonly StaffRole[] = ['REGIONAL_MANAGER', 'STORE_MANAGER', 'DEPARTMENT_LEAD'];
if (!CAN_BULK_UPDATE.includes(actor.role)) {
  throw new ForbiddenError('Only managers and department leads can bulk update activities');
}
```

## MOD-04 Add a domain event (and an alert for it)

1. `src/shared/events/domain-events.ts`: add `'<module>.<past_tense_verb>': { ...plain payload }` to `DomainEventMap`. Use ids and display strings only (ARCH-06.3). Import any enum types from `*.types.ts`. Shared may only import types (ARCH-08).
2. Producer service: `await this.events.emit('<event>', payload)` after the write.
3. If an alert is needed:
   - Add the new `AlertType` to `ALERT_TYPES` in `alerts.types.ts`.
   - Add a handler in `registerAlertSubscriptions` (`alerts.events.ts`) using `alerts.notify` (one user) or `alerts.notifyMany` (several). `metadata` is `Record<string, string>`, so stringify any numbers.
   - To resolve recipients (e.g. "all store managers"), use `staff.list({ storeId })` and filter, following the `inventory.low_stock` handler.
4. If a report needs it: add a handler in `registerReportSubscriptions` (`reports.events.ts`) and combine the returned unsubscribe functions.
5. Update the domain events table in `README.md`. This is the only README change a sprint normally makes.
6. Tests: assert the payload with `ctx.container.events.on('<event>', jest.fn())`. If there is an alert, assert it end-to-end via `GET /api/alerts` as the recipient (TEST-05).

## MOD-05 Bulk operations

StoreOps has no transactions, so bulk mutations are **validate-all-then-write** (all-or-nothing) unless the contract explicitly says partial success:

```ts
async bulkUpdate(actor: AuthUser, input: BulkUpdateActivitiesInput): Promise<Task[]> {
  this.assertCanBulkUpdate(actor);                                   // role first: no data needed
  const ids = [...new Set(input.activityIds)];                       // de-duplicate
  const tasks = await Promise.all(ids.map((id) => this.getById(id))); // 404 on first missing id
  for (const task of tasks) await this.assertSameStore(actor, task); // 403 before any write
  if (input.assigneeId) await this.staff.getById(input.assigneeId);  // 404 for bad assignee

  const now = this.clock().toISOString();
  const updated: Task[] = [];
  for (const task of tasks) {
    updated.push(await this.repository.update({ ...task, ...changesFor(task, input), updatedAt: now }));
  }
  for (const [i, task] of tasks.entries()) {                         // emit after ALL writes
    /* emit per item only if that item's assignee/status actually changed (ARCH-06.5/6) */
  }
  return updated;
}
```

Rules:

- De-duplicate ids. Preserve request order in the response.
- Cap the batch size in zod (default `.max(100)`).
- Items that need no change are still returned, but they emit nothing and do not need their `updatedAt` bumped. The contract decides; if it is silent, don't bump.
- If the contract asks for partial success, the response shape is `{ updated: Task[], failed: { id, error: { code, message } }[] }` with status `200`, and the AC must cover a mixed batch.

## MOD-06 Express route ordering

Express matches routes in registration order. Register static segments (`/bulk`, `/summary`) **before** parameterised ones (`/:id`). Otherwise `PATCH /api/activities/bulk` is handled as `PATCH /:id` with `id = "bulk"` and returns a confusing 400 or 404. Add an AC or test that proves the static route is reached.

## MOD-07 Add a list filter

1. Add the optional field to `XFilter` in `<module>.types.ts` or `<module>.repository.ts`, wherever the existing filter lives.
2. Extend the `filter` predicate in `InMemoryXRepository.findAll` with `(filter.x === undefined || t.x === filter.x)`.
3. Add it to the routes' `listQuerySchema` (query values are strings, so use `z.enum(...)` or `z.coerce.number()` as appropriate).
4. Tests: one for the filter matching, and one for an invalid value → 400.

## MOD-08 Add a new module

Create `src/modules/<name>/` with `<name>.types.ts`, `<name>.repository.ts` (interface + `InMemory…`), `<name>.service.ts`, `<name>.routes.ts`. Then:

1. `src/container.ts`: instantiate the repository and service, inject the clock and events, and add the service to the `Container` interface and the returned object.
2. `src/app.ts`: `app.use('/api/<name>', authenticate, createXRouter(container.xService))`, placed before `notFoundHandler`.
3. `tests/integration/<name>.test.ts`, using `setupTestApp()`.
4. dependency-cruiser rules apply automatically through the path patterns. Do not edit `.dependency-cruiser.cjs`.
5. Add a row to the README "Modules" and "API" tables.

A new module that other modules need to *react* to should publish events. It should not be imported (ARCH-05 spirit).

## MOD-09 Seed data

`src/seed.ts` is excluded from coverage and only used by `npm run dev`. Change it only when a contract asks for demo data. Never depend on seed data in tests. Tests build their own data through `setupTestApp`.

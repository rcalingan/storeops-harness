# Skill: coding-conventions

**Purpose.** The TypeScript conventions StoreOps code follows, so that generated code is indistinguishable from the existing modules and passes `npm run typecheck` and `npm run lint` on the first try. Read by the **Generator**. The Evaluator also reads it when grading MINOR findings. Rule IDs are `CODE-NN`.

When this file is silent, copy the nearest existing example. `src/modules/activities/` is the reference module.

---

## CODE-01 Files and names

| Thing | Convention | Example |
|---|---|---|
| Module files | `src/modules/<module>/<module>.<layer>.ts`, layer ∈ `types, repository, service, routes, events, auth` | `activities.service.ts` |
| Shared files | kebab-case under `src/shared/<area>/` | `async-handler.ts` |
| Tests | `tests/integration/<module>.test.ts`, `tests/unit/<subject>.test.ts` | `tests/unit/event-bus.test.ts` |
| Classes | PascalCase; services `XService`, repos `InMemoryXRepository` with interface `XRepository` | `ActivitiesService` |
| Factories | `createXRouter`, `createAuthenticate`, `registerXSubscriptions` | `createActivitiesRouter` |
| Module constants | UPPER_SNAKE | `TOKEN_TTL_MS`, `CAN_CREATE` |
| Enum arrays | UPPER_SNAKE plural, `as const` | `TASK_STATUSES` |
| Input types | `CreateXInput`, `UpdateXInput`, `XFilter` | `UpdateActivityInput` |
| Spelling | British: **programme**, `programmeId`. Retail terms in routes and messages; legacy type names (`Task`, `Project`, `User`, `Notification`) unchanged | — |

## CODE-02 Enumerations

Never use TypeScript `enum`. Define a readonly tuple and derive the union:

```ts
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
```

zod schemas use `z.enum(TASK_STATUSES)`. Reports use the array to zero-fill counts (`zeroCounts(TASK_STATUSES)`). Adding a value to an existing array has knock-on effects: report metrics, alert types and tests. List them in the contract.

## CODE-03 Imports

- Use `import type { ... }` for anything only used as a type. ESLint `consistent-type-imports` enforces it. A mixed import uses inline `type`: `import { buildContainer, type Container } from './container'`.
- Use relative paths only. There are no path aliases.
- Node built-ins use the `node:` prefix: `import { randomUUID } from 'node:crypto'`.
- Order: external packages first, then relative imports alphabetised by path. This is the existing style, not enforced.

## CODE-04 Types and signatures

- Exported functions and methods have explicit return types (`explicit-module-boundary-types`). Service methods return `Promise<T>`. Use `async` when you `await`. Otherwise return the repository promise directly (`list(...)` in `ActivitiesService`).
- No `any`. `recommendedTypeChecked` rejects unsafe `any` flows in `src/`. For untrusted data use `unknown` and narrow it, or parse with zod.
- No non-null assertions (`!`). Narrow with checks or optional chaining (`match?.[1]`).
- Casts (`as X`) are allowed only where the type system cannot follow and the existing code does the same: `res.locals.user as AuthUser | undefined`, `Object.fromEntries(...) as Record<K, number>`. Never cast to silence a real mismatch.
- Unused parameters are prefixed with `_` (`(_req, res) => ...`).

## CODE-05 Entity and input shapes

- Entities: `id: string` (`randomUUID()`, generated in the **service**), `createdAt`/`updatedAt: string` (ISO), optional values as `T | null` (`assigneeId: string | null`, `dueDate: string | null`). Entities never use `?:`.
- Inputs use `?:` for optional fields. A field that can be explicitly cleared uses `?: T | null` (`assigneeId?: string | null`).
- Defaults are applied in the service at creation (`priority: input.priority ?? 'MEDIUM'`). Never apply them in zod or the repository.
- Public views strip secrets with destructuring (`const toProfile = ({ passwordHash: _omit, ...profile }: User): UserProfile => profile`).

## CODE-06 Immutability

Updates build a new object: `{ ...existing, ...patch, updatedAt: now }`. Never mutate an entity received from a repository, and never mutate arrays in place (`members: [...project.members, newMember]`). Repository methods copy on the way in and on the way out (ARCH-14).

## CODE-07 Errors

Choose the subclass by meaning (full contract in ARCH-10):

| Situation | Throw | Message style (existing examples) |
|---|---|---|
| Entity id not found | `new NotFoundError('Activity', id)` | renders `Activity 'abc' not found` |
| Role / ownership / store denied | `new ForbiddenError('Only the activity owner or a store manager can delete this activity')` | Name the rule, not the actor |
| Duplicate or invalid state | `new ConflictError(\`Programme '${id}' is already closed\`)` | Quote the id in `'single quotes'` |
| Business-rule input error the schema can't express | `new ValidationError('Staff member belongs to a different store than the programme')` | Sentence, no trailing period |
| Bad/expired credentials | `new UnauthorizedError('Invalid or expired token')` | — |

Messages are sentences with no trailing period, safe to show to a client. Never put secrets, tokens or password hashes in a message or in `details`.

## CODE-08 Logging

Use `logger` from `src/shared/logger.ts`, with a fixed message and structured metadata: `logger.error('SLA check failed', { error: String(err) })`. `console.*` is a lint error outside `logger.ts`. Services do not log in the normal flow. Logging belongs to infrastructure (`errorHandler`, `EventBus`, `server.ts`). Never log tokens, passwords or full request bodies.

## CODE-09 Async

- Use `async`/`await`. Await every promise, because `no-floating-promises` and `no-misused-promises` are on. The only fire-and-forget is in `server.ts` and uses `.catch(...)`.
- For a sequence of writes that must be ordered (e.g. writes then emits in a bulk operation), use `for ... of` with `await`. `Promise.all` is fine for independent reads (`ReportsService.computeStoreMetrics`).

## CODE-10 Comments

- Put a one-line `/** ... */` JSDoc on exported classes and factories, and on any service method that encodes a business rule. Say *why* or *what rule*, not what the code does: "Only the activity's creator or a store manager may delete it."
- Inline `//` comments are rare. Use them for architecture intent ("Cross-module reads go through the owning module's service layer.").
- No commented-out code, and no `TODO` unless it references a known gap or a contract item (`// TODO(GAP-6): pagination`).

## CODE-11 Formatting

There is no Prettier config. Match the existing files: 2-space indent, single quotes, semicolons, trailing commas in multi-line literals and argument lists, and lines up to about 120 characters (tests go slightly longer). Use arrow-function exports for factories and helpers, and classes for services and repositories. Strict equality only (`eqeqeq`).

## CODE-12 Constructors

Constructor parameter order: `repository`, then other module services (alphabetical by role in the call), then `events`, then `clock = systemClock` last. Use `private readonly` parameter properties. Example:

```ts
constructor(
  private readonly repository: ActivitiesRepository,
  private readonly programmes: ProgrammesService,
  private readonly staff: StaffService,
  private readonly events: EventBus,
  private readonly clock: Clock = systemClock,
) {}
```

If you add a constructor parameter, update `src/container.ts` in the same sprint. Never construct services anywhere else.

## CODE-13 What lint will reject (fix before handing off)

| Lint/TS error | Usual cause in StoreOps | Fix |
|---|---|---|
| `no-restricted-syntax` "Raw Error throws are forbidden" | `throw new Error(...)` | Throw an AppError subclass (CODE-07) |
| `@typescript-eslint/consistent-type-imports` | Importing a service class for a constructor type | `import type` |
| `@typescript-eslint/no-unsafe-*` in `src/` | Reading `req.body` without parsing | `parseOrThrow(schema, req.body)` |
| `@typescript-eslint/no-misused-promises` | Async function passed to `router.get` without `asyncHandler` | Wrap in `asyncHandler` |
| `@typescript-eslint/require-await` | `async` method with no `await` | Drop `async`, return the promise (`Promise.resolve(...)` in repos) |
| `noUnusedLocals` / `noUnusedParameters` | Leftover variables | Delete, or prefix with `_` |
| depcruise `no-circular` | New service-to-service dependency in both directions | Use an event instead (ARCH-03) |

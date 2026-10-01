# Sprint <N> contract: <title>

- **Run ID:** <run-id>
- **Depends on:** <Sprint k (must be PASS/CONDITIONAL PASS) | none>
- **Goal:** <one sentence: the observable capability this sprint ships>

## Files in scope

| File | Change | Why |
|---|---|---|
| `src/modules/activities/activities.types.ts` | modify | add `BulkUpdateActivitiesInput` |
| `tests/integration/activities.test.ts` | modify | AC tests |

## Out of scope

- <things the Generator must not do in this sprint, including nearby known gaps>

## Protected-file exceptions

None.

## Architecture rules at risk

- ARCH-NN: <why>

## Acceptance criteria

### AC-<N>.1 <short title>
GIVEN <precondition with concrete role/store/fixture>
WHEN <exact HTTP call or service call>
THEN <observable result: status + body field / persisted state / event / alert>
AND <consequence of the same action, optional>
Verify: <test file>

### AC-<N>.2 …

## Definition of done

- [ ] Every AC above has a passing test whose title starts with its AC ID (TEST-05)
- [ ] `npm run check` passes
- [ ] Coverage ratchet holds (TEST-07)
- [ ] No files outside "Files in scope" changed, except declared one-line knock-ons
- [ ] `generator-summary.md` written with `STATUS: COMPLETE`

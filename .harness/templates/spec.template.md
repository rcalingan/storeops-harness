# Spec: <Feature title>

- **Run ID:** <YYYY-MM-DD>-<feature-slug>
- **Feature request (verbatim):** "<developer prompt after @planner>"
- **Author:** Planner agent
- **Sprints:** <n>

## 1. Problem and outcome

<2–4 sentences: who (role) needs what, in which store-operations situation, and what is observably different afterwards.>

## 2. Grounding in the current code

| Area | Existing element reused | Notes |
|---|---|---|
| Types | `Task`, `TASK_STATUSES` … | |
| Services | `ActivitiesService.update` … | |
| Events | `activity.assigned` … | |
| Known gaps hit (app-context §6) | GAP-n | In scope / out of scope + why |

## 3. API changes

| Method + Path | Roles allowed | Request | Success response | Error cases |
|---|---|---|---|---|
| | | | | 400 / 403 / 404 / 409 |

## 4. Domain and event changes

<New/changed types, new DomainEventMap entries (payload shape), new AlertTypes, report metric changes. Write "None" if there are none.>

## 5. Decisions and assumptions

| # | Decision | Rationale | Confirm? |
|---|---|---|---|
| D-1 | | | [CONFIRM] / — |

## 6. Architecture rules at risk

<ARCH-NN list with one line each on why this feature is exposed to that rule.>

## 7. Sprint plan

| Sprint | Title | Delivers | Depends on | Contract |
|---|---|---|---|---|
| 1 | | | — | `sprint-1-contract.md` |

## 8. Out of scope

- <explicit exclusions, including adjacent known gaps>

## 9. Protected-file exceptions

None. <Or: file, reason, sprint. Each needs a [CONFIRM] row in §5.>

## Revision log

| Rev | Date | Change requested by developer | Sections changed |
|---|---|---|---|

STATUS: AWAITING APPROVAL

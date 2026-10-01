# ESCALATION: <run-id>, Sprint <N>

| Field | Value |
|---|---|
| Sprint | <N>: <title> |
| Iterations used | <k> / 3 |
| Trigger | E-1 iteration limit / E-2 Generator BLOCKED / E-3 no progress / E-4 Evaluator ESCALATE / E-5 baseline red |
| Last verdict | FAIL |
| Branch | harness/<feature-slug> (last good commit: <sha>) |
| Raised at | <ISO timestamp> |

## Blocking issue

<One paragraph: what is stopping the sprint, in product terms, not just a rule ID.>

## Unresolved findings

| Finding | Severity | Rule | Location | Seen in iterations |
|---|---|---|---|---|
| F-n <title> | MAJOR | ARCH-12 | file:line | 1, 2, 3 |

## What was tried

1. Iteration 1: <summary>
2. Iteration 2: <summary>
3. Iteration 3: <summary>

## Decision needed from the developer

<The specific question, e.g. "Should a DEPARTMENT_LEAD be allowed to bulk-reassign activities in programmes they are not a member of?">

## How to resume

Reply with one of:

- `RETRY <guidance>`: the orchestrator appends your guidance to the feedback and grants **one** more Generator iteration.
- `REPLAN <guidance>`: the Planner revises the spec and the remaining contracts. You approve again with `APPROVED`.
- `ABORT`: stop the run. Work stays on branch `harness/<feature-slug>` and the handoff files are archived.

You can also fix the code yourself and reply `RETRY`. The Evaluator then grades your changes like any other iteration.

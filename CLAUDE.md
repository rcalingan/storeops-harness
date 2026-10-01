# CLAUDE.md: StoreOps harness orchestrator

This file is the orchestration brain of the StoreOps agent harness. When Claude Code starts in this repository, the main session **is the orchestrator**. It does not plan, write code or review code. It invokes the four harness agents as subagents, passes context between them through handoff files in `.harness/output/`, reads their verdicts, and routes.

StoreOps itself (TypeScript/Express REST API, in-memory, capstone reference) is described in `README.md` and `.harness/skills/app-context/SKILL.md`.

---

## 1. Components

| Component | Definition (source of truth) | Claude Code subagent | Writes |
|---|---|---|---|
| Planner | `.harness/agents/planner.agent.md` | `planner` | `.harness/output/spec.md`, `.harness/output/sprint-<N>-contract.md` |
| Generator | `.harness/agents/generator.agent.md` | `generator` | `src/**`, `tests/**`, `.harness/output/generator-summary.md` |
| Evaluator | `.harness/agents/evaluator.agent.md` | `evaluator` | `.harness/output/evaluator-feedback.md` |
| Monitor | `.harness/agents/monitor.agent.md` | `monitor` | `.harness/reviews/<run-id>/sprint-<N>-run-log.md`, `.harness/reviews/index.md` |
| Orchestrator | this file | main session | `.harness/output/harness-state.md`, `history/`, `carry-over.md`, `escalation.md`, git branch and commits |

`.claude/agents/<name>.md` are thin wrappers so Claude Code can invoke each agent with `subagent_type: "<name>"`. They point at `.harness/agents/<name>.agent.md`, which holds the full definition.

Skill files (`.harness/skills/<skill>/SKILL.md`), and who reads them:

| Skill | Rule IDs | Planner | Generator | Evaluator | Monitor |
|---|---|---|---|---|---|
| app-context | GAP-n | ✔ | ✔ | ✔ (§6) | ✔ |
| architecture-principles | ARCH-01…17 | ✔ | ✔ | ✔ | — |
| sprint-decomposition | PLAN-01…07 | ✔ | — | (PLAN-05 via REV-09) | — |
| coding-conventions | CODE-01…13 | — | ✔ | (MINOR grading) | — |
| module-patterns | MOD-01…09 | — | ✔ | (via REV-05) | — |
| how-to-test | TEST-01…08 | — | ✔ | ✔ | — |
| how-to-review | REV-00…10 | — | — | ✔ | — |
| grading-criteria | C-01…08, severities, verdict table | — | — | ✔ | — |

Handoff formats are fixed by `.harness/templates/*.template.md`.

> `.harness/` is used instead of `.github/` on purpose, to keep harness files separate from CI/CD configuration.

---

## 2. Developer entry prompts

The developer has only two required steps: start a run with `@planner …`, then type `APPROVED`. Everything else is optional or happens at escalation points.

| Developer types | Valid in phase | Orchestrator action |
|---|---|---|
| `@planner <feature request>` | none / COMPLETE / ABORTED | Start a new run (§3, Phases 0–1) |
| `APPROVED` | AWAITING_APPROVAL | Phase 2, then run the sprint loop autonomously |
| anything else | AWAITING_APPROVAL | Treat it as revision feedback. Re-invoke the Planner in revision mode and stay in AWAITING_APPROVAL. |
| `RETRY <guidance>` | ESCALATED | §5.2 |
| `REPLAN <guidance>` | ESCALATED | §5.2 |
| `ABORT` | any | §5.2 |
| `HARNESS STATUS` | any | Print PHASE, sprint/iteration, and the sprint results table from `harness-state.md`. No other action. |
| `HARNESS RESUME` | SPRINTING / AWAITING_APPROVAL / ESCALATED | Rebuild position from `harness-state.md` and continue from the last completed step. Use this after a crash or in a fresh session. |

Example: `@planner Add shift handover bulk update to tasks`

If the developer @-mentions the `planner` agent directly instead of the orchestrator, still treat the request as Phase 0 + 1. Make sure `harness-state.md` exists before the Planner runs.

---

## 3. Sequence

```
@planner <feature>
   │
   ▼
Phase 0 Preflight ─► Phase 1 Planner ─► spec.md "STATUS: AWAITING APPROVAL" ─► STOP, wait for developer
                                               ▲             │ revision feedback
                                               └─────────────┘
APPROVED
   │
   ▼
Phase 2 Baseline + branch ─► Phase 3 for each sprint N:
                               ┌──────────────────────────────────────────────────────────┐
                               │ Generator(N,K) ─► Evaluator(N,K) ─► archive ─► route       │
                               │   ▲                                        │               │
                               │   └──────── FAIL and K < 3 (K := K+1) ◄────┤               │
                               │        PASS / CONDITIONAL PASS ─► commit ─► Monitor ─► N+1 │
                               │        FAIL at K = 3, or E-2…E-4 ─► escalation.md ─►       │
                               │                                    Monitor ─► STOP         │
                               └──────────────────────────────────────────────────────────┘
                             ─► Phase 4 Complete
```

### Phase 0: Preflight

1. Run `git status --porcelain`. If anything outside `.harness/output/` is dirty, **stop** and ask the developer to commit or stash. Never stash on their behalf.
2. If `.harness/output/harness-state.md` exists:
   - `PHASE` is SPRINTING / AWAITING_APPROVAL / ESCALATED: ask whether to `HARNESS RESUME` that run or `ABORT` it first. Do not overwrite it.
   - `PHASE` is COMPLETE / ABORTED: it was archived already. Delete everything in `.harness/output/` except `.gitkeep` files.
3. Derive `RUN_ID` = `<today YYYY-MM-DD>-<feature-slug>`. The slug is kebab-case, at most 40 characters, from the feature request.
4. Create `.harness/output/harness-state.md` from `.harness/templates/harness-state.template.md` with `PHASE: PLANNING`.

### Phase 1: Plan

1. Invoke the Planner (prompt in §6).
2. Verify the output. `spec.md` exists and its last non-empty line is exactly `STATUS: AWAITING APPROVAL`. There is one `sprint-<N>-contract.md` per row of the spec's sprint table. If either check fails, re-invoke the Planner once, naming the defect. If it fails a second time, report it to the developer.
3. Set `PHASE: AWAITING_APPROVAL` and `TOTAL_SPRINTS`.
4. Show the developer the Planner's return message: the sprint table, the `[CONFIRM]` decisions, the risks, and the path `.harness/output/spec.md`. Ask them to review it and reply `APPROVED` or give feedback. **Stop and wait.**

### Phase 2: Approval and baseline

1. Replace the spec's status line with `STATUS: APPROVED <ISO timestamp>`.
2. **Baseline gate:** run `npm run check 2>&1 | tail -n 25`. If it fails, escalate with **E-5** (§5). The harness never builds on a red baseline.
3. Record the baseline: `npx jest --coverage --coverageReporters=text-summary 2>&1 | tail -n 8` → `BASELINE_COVERAGE`, `BASELINE_TESTS`.
4. Run `git switch -c harness/<feature-slug>`. Record `BRANCH` and `RUN_BASE_SHA` (`git rev-parse HEAD`).
5. Commit the approved plan: `git add .harness/output && git commit -m "harness(<slug>): approved spec"`.
6. Set `PHASE: SPRINTING`, `CURRENT_SPRINT: 1`, and continue straight into Phase 3. **Do not wait for the developer.**

### Phase 3: Sprint loop (autonomous)

For sprint `N`:

1. `SPRINT_BASE_SHA` = `git rev-parse HEAD`. Set `CURRENT_ITERATION: 1` and save the state file.
2. **Generator.** Invoke it (§6) and append a ledger row.
3. **Evaluator.** Invoke it (§6) and append a ledger row. The Evaluator runs even when the Generator reports `STATUS: BLOCKED`, so the block is graded and the escalation reason is recorded consistently.
4. **Archive the iteration:** copy `generator-summary.md` → `history/sprint-<N>-iter-<K>-generator-summary.md`, and `evaluator-feedback.md` → `history/sprint-<N>-iter-<K>-evaluator-feedback.md`.
5. **Read the verdict:** `grep -m3 -E '^(VERDICT|ESCALATE|REASON):' .harness/output/evaluator-feedback.md`, and `grep -m1 '^STATUS:' .harness/output/generator-summary.md`. If the verdict lines are missing or malformed, re-invoke the Evaluator once ("header malformed"). If they are still bad, escalate with E-4.
6. **Route** using §4.

### Phase 4: Complete

When the last sprint advances:

1. Run a final sanity gate on the branch: `npm run check 2>&1 | tail -n 25`. If it is red (which should be impossible after a PASS), escalate as E-4 against the last sprint.
2. Archive: copy `spec.md`, all `sprint-*-contract.md`, `carry-over.md` (if present) and `harness-state.md` to `.harness/reviews/<run-id>/handoff/`.
3. Set `PHASE: COMPLETE`. Run `git add -A .harness/output .harness/reviews && git commit -m "harness(<slug>): run complete"`.
4. Report to the developer: sprints, verdicts, iterations, commit SHAs, open carry-over items, and any drift signals the Monitor raised. Point them at the branch. **Do not push and do not open a PR** unless asked.

---

## 4. Routing logic

Evaluate the rules top-down after every Evaluator run. `K` = `CURRENT_ITERATION`. `LIMIT` = `3 + EXTRA_ITERATIONS_GRANTED`.

| # | Condition | Action |
|---|---|---|
| R-1 | `ESCALATE: YES` and generator `STATUS: BLOCKED` | Escalate **E-2** |
| R-2 | `ESCALATE: YES` | Escalate **E-4** |
| R-3 | `VERDICT: PASS` | **Advance** (below) |
| R-4 | `VERDICT: CONDITIONAL PASS` | Append the feedback's *Carry-over* items to `.harness/output/carry-over.md`, under a `## From sprint <N>` heading. Then **Advance**. |
| R-5 | `VERDICT: FAIL` and `K ≥ 2` and no progress (see E-3) | Escalate **E-3** |
| R-6 | `VERDICT: FAIL` and `K < LIMIT` | Set `K := K + 1`, save the state file, go to Phase 3 step 2 (Generator retry) |
| R-7 | `VERDICT: FAIL` and `K = LIMIT` | Escalate **E-1** |

**Advance:**

1. `git add -A src tests README.md .harness/output .harness/reviews`. This also picks up the previous sprint's Monitor output. The final sprint's Monitor output goes into the Phase 4 commit.
2. `git commit -m "harness(<slug>): sprint <N> - <contract title>"`
3. Record the verdict, iterations and commit in *Sprint results*.
4. Invoke the Monitor.
5. If `N < TOTAL_SPRINTS`, set `CURRENT_SPRINT: N+1` and loop. Otherwise go to Phase 4.

The orchestrator never asks the developer for permission between sprints.

**Escalation triggers:**

| ID | Trigger |
|---|---|
| E-1 | Iteration limit reached: three FAIL iterations, plus any granted retries |
| E-2 | The Generator reported `STATUS: BLOCKED` and the Evaluator agreed (`ESCALATE: YES`) |
| E-3 | No progress: on iteration K ≥ 2, every BLOCKER/MAJOR in the *Previous findings* table is `NOT RESOLVED` or `REGRESSED`, **and** the BLOCKER+MAJOR count did not decrease. Escalating here saves an iteration that would probably fail the same way. |
| E-4 | The Evaluator raised `ESCALATE: YES` (planning defect or product decision), or its output was unparseable twice, or the final sanity gate was red |
| E-5 | The baseline `npm run check` failed before any harness change |

---

## 5. Escalation

### 5.1 Raising an escalation

1. Write `.harness/output/escalation.md` from `.harness/templates/escalation.template.md`. It names the sprint, the iteration count, the trigger and the **blocking issue**. Fill *Unresolved findings* from the latest `evaluator-feedback.md`, and *What was tried* from the history files: read only their header and findings sections.
2. Set `PHASE: ESCALATED`. **Do not commit** the failing sprint's code. It stays in the working tree for the developer to inspect.
3. Invoke the Monitor. It records the sprint with `Escalated: YES`.
4. Tell the developer: the sprint and its title, the trigger, the one-paragraph blocking issue, the decision needed, and the resume options. **Stop and wait.**

### 5.2 Resuming

| Reply | Action |
|---|---|
| `RETRY <guidance>` | Append `## Developer guidance` with the text to `evaluator-feedback.md`. Increment `EXTRA_ITERATIONS_GRANTED`. Set `PHASE: SPRINTING`, `K := K + 1`, and continue at Phase 3 step 2. If the developer edited code themselves, the Generator still runs. It sees the guidance and the current tree. |
| `REPLAN <guidance>` | Invoke the Planner in replan mode with the guidance and `escalation.md`. Go back to `AWAITING_APPROVAL`. On `APPROVED`, re-run Phase 2 steps 1 and 5 only, with no new branch and the same baseline. Then resume at the first sprint without a PASS, with `K := 1` and a fresh `SPRINT_BASE_SHA`. |
| `ABORT` | Copy everything in `.harness/output/` to `.harness/reviews/<run-id>/handoff/`. Set `PHASE: ABORTED`. Commit only `.harness/reviews` and `.harness/output/harness-state.md`, and leave uncommitted sprint code in place. Report the branch name. |

---

## 6. Invoking agents and context scoping

### 6.1 How to invoke

Use the Agent tool with `subagent_type` = `planner` | `generator` | `evaluator` | `monitor`, `run_in_background: false`. Each loop step depends on the previous one. The prompts are short and contain **paths and identifiers only**:

```
Planner:   "Run ID <id>. Mode: initial | revision | replan. Feature request: <verbatim>.
            Developer feedback: <verbatim or 'none'>. Follow .harness/agents/planner.agent.md."
Generator: "Run ID <id>. Sprint <N>, iteration <K>. Contract: .harness/output/sprint-<N>-contract.md.
            <K ≥ 2: 'Fix the findings in .harness/output/evaluator-feedback.md.'>
            Follow .harness/agents/generator.agent.md."
Evaluator: "Run ID <id>. Sprint <N>, iteration <K>. SPRINT_BASE_SHA <sha>.
            Follow .harness/agents/evaluator.agent.md."
Monitor:   "Run ID <id>. Sprint <N> finished: <verdict>, <K> iterations, escalated <YES|NO>.
            Follow .harness/agents/monitor.agent.md."
```

If the Agent tool result reports token usage, record it in the state file's invocation ledger. The Monitor uses it in preference to its own estimate.

### 6.2 Context scoping strategy

Long runs (up to 5 sprints × 3 iterations × 2 agents, plus the Monitor) would degrade a single context. The harness bounds context as follows:

1. **Fresh context per invocation.** Every Planner, Generator, Evaluator and Monitor call is a new subagent with no conversation history. A retry Generator is a *new* Generator. The Evaluator never shares context with the Generator it grades.
2. **Files are the only memory.** State lives in `harness-state.md`, the contract (stable for the sprint), the latest feedback (overwritten each iteration) and `history/` (append-only). Nothing important exists only in a conversation.
3. **Least-context reading.** Each agent file lists exactly what it reads. A Generator retry reads the contract and the *latest* feedback only, not earlier summaries or history. The Evaluator reads only the previous iteration's feedback. Only the Monitor reads the full sprint history, and it runs once per sprint.
4. **Prompts carry pointers, not payloads.** Never paste code, diffs, specs or feedback into an agent prompt. Pass paths.
5. **Bounded return messages.** Each agent's return message is capped (3–15 lines, per its agent file), so subagent results add little to the orchestrator's context.
6. **Orchestrator reads headers, not bodies.** Routing needs only the `VERDICT`/`ESCALATE`/`REASON`/`STATUS` lines, read with `grep`. Command output is always piped through `tail`. The orchestrator reads full feedback or history only when writing an escalation.
7. **Skills are re-read from disk on every invocation.** A skill refinement takes effect on the next agent call, with no stale copies in context.
8. **Resumable sessions.** Because all state is on disk, the developer (or the orchestrator, if its own context grows long, e.g. after 3+ sprints) can start a fresh Claude Code session and type `HARNESS RESUME`. Recommend `/clear` or a new session between runs.

---

## 7. CI/CD relationship

- **There is no CI pipeline in the repo yet** (app-context GAP-7). `npm run check` is the project's single quality gate: `tsc --noEmit && eslint . && depcruise && jest --coverage`.
- **The harness precedes CI and feeds into it. It does not replace it.** Evaluator checks C-01…C-05 are exactly the components of `npm run check`. A pipeline added later should run `npm ci && npm run check` on Node 18 (`.nvmrc`), so a harness PASS predicts a green pipeline. Checks C-06…C-08 (coverage ratchet, protected files and suppressions, contract scope) are **harness-only** gates, stricter than CI, that catch drift before code reaches a PR.
- **CI stays authoritative for merging.** The harness runs on a developer machine against a working tree. CI runs on a clean install of the merged result. A harness branch (`harness/<slug>`) reaches `main` only through a normal PR with CI and human review. The harness never pushes, opens PRs or merges on its own.
- **The harness never edits gate configuration.** `package.json` scripts and thresholds, `eslint.config.mjs`, `.dependency-cruiser.cjs` and `tsconfig*.json` are protected (ARCH-16). Any future `.github/workflows/*` is protected too. Changing a gate is a human decision.
- **A CI failure on a harness-PASSed branch is a harness defect.** Record it in that run's `.harness/reviews/<run-id>/` folder. Treat it as drift signal D-4 against the skill that should have caught it (usually how-to-review or grading-criteria).

---

## 8. Orchestrator rules

- Never write or edit `src/`, `tests/`, skills, agents or templates during a run. Delegate code to the Generator. If the developer asks for a quick code change mid-run, tell them to `ABORT` first, or route it through `RETRY <guidance>`.
- Git is the orchestrator's job alone: one branch per run, one commit per approved spec, one per advanced sprint, one at completion. Never force-push, rebase or reset.
- Never skip the Evaluator, the Monitor or the approval gate. Never change a verdict.
- Keep `harness-state.md` current after every step, so `HARNESS RESUME` always works.

## 9. Working outside a harness run

For ordinary requests that are not harness runs (questions, small fixes), still follow `.harness/skills/architecture-principles`, `coding-conventions` and `how-to-test`, and run `npm run check` before calling work done.

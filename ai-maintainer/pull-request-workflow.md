# Pull request and verification workflow

## Core rule

Every PR must communicate the difference between:

- work the agent performed;
- evidence produced by automation;
- behavior that remains unverified;
- actions expected from a human.

The absence of a failing automated test is not evidence that a complex interaction
works.

## PR types

### Verified candidate

Use when all checks required by policy passed and no deterministic complex signal
requires manual verification.

The PR may be opened as ready for review. Human review and merge are still required.

### Manual-verification suggestion

Use when the implementation is potentially useful but complete verification is not
possible in the worker.

Requirements:

- draft PR;
- `manual-verification-required` label;
- `suggested-implementation` label;
- explicit confidence and limitation summary;
- concise test plan;
- automated results included without presenting them as complete verification.

### Investigation-only suggestion

Use when a complete implementation would be speculative or exceed limits.

The PR may contain:

- a scaffold;
- targeted tests demonstrating the gap;
- a partial translation;
- design notes in the PR body;
- links to relevant upstream source and behavior;
- a proposed implementation sequence.

Avoid adding dead or misleading package exports merely to show progress.

### Deferred task

Use when no useful code change can be produced within policy. Record the reason in
the component manifest or tracking issue. Do not create an empty PR.

## PR boundary

Default to one component. Group components only when they share an implementation
base or cannot be validated independently, for example:

- LocalAlert, GlobalAlert, and InfoCard changes to their shared BaseAlert;
- a parent compound component and its required subcomponents;
- a context change that must update all consumers atomically.

Do not group unrelated components merely because they appeared in the same Aksel
release.

## Required PR body

```markdown
## Upstream change

- Aksel release: `vX.Y.Z`
- Component: `ComponentName`
- Upstream change: <concise description>
- Sources: <changelog, PR, commit, source, tests>

## Suggested change

<What changed in Svelte and why.>

## Verification status

Automated candidate

or

MANUAL VERIFICATION REQUIRED

<What could not be verified and why.>

## Evidence

- HTML parity: passed / failed / not applicable
- Unit tests: passed / failed
- Visual light: links
- Visual dark: links
- Interaction tests: passed / incomplete / unavailable

## Manual test plan

1. ...
2. ...

## Scope

- Changed files: N
- Model route: implementation
- Estimated cost: USD N
- Actual model cost: USD N

<!-- ai-maintainer-id: stable-idempotency-key -->
```

Model route and cost are reporting data injected by trusted platform configuration.
Target policy may require their disclosure, but must not configure a provider, route,
or price.

Omit the manual test plan only when no manual verification is required.

## Test-plan generation

Test plans must be:

- specific to the unverified behavior;
- executable from a checked-out branch;
- no more than the configured maximum, initially seven steps;
- concise enough to scan in the PR;
- explicit about browser, keyboard, screen reader, or platform requirements.

Avoid vague steps such as "test accessibility" or "verify it works."

### Focus and keyboard example

```markdown
1. Run the docs application and open the component example.
2. Focus the trigger with Tab and open it using Enter and Space.
3. Verify focus moves to the expected element.
4. Navigate all items using the documented arrow keys.
5. Press Escape and verify focus returns to the trigger.
6. Tab forward and backward to verify focus is not lost or trapped.
```

### Date component example

```markdown
1. Open the single-date example and select a date using only the keyboard.
2. Verify the input value, selected day, and announced label agree.
3. Repeat at the end of a month and year.
4. Enter an invalid date and verify the error state and message.
5. Open the range example from each input and verify the expected endpoint changes.
```

### File component example

```markdown
1. Select one valid file using the file picker.
2. Verify its name, size, and remove action.
3. Select an invalid type and an oversized file and verify both errors.
4. Repeat using drag-and-drop.
5. Remove and re-add the same file.
```

## Labels

| Label | Meaning |
| --- | --- |
| `ai-maintained` | Created or actively maintained by the worker |
| `complex-change` | Deterministic risk policy classified the task as complex |
| `manual-verification-required` | Human execution of the test plan is required |
| `suggested-implementation` | Code is a proposal and may be incomplete |
| `ai-deferred` | Work was intentionally deferred |
| `ai-budget-blocked` | New model work is paused by budget policy |

## Human controls

Only authorized maintainers may issue commands.

| Command | Result |
| --- | --- |
| `/ai-maintainer retry` | Retry using the task's existing scope and policy |
| `/ai-maintainer revise <instruction>` | Queue a bounded revision |
| `/ai-maintainer approve-scope` | Approve a specifically proposed wider path set |
| `/ai-maintainer defer <reason>` | Stop work and record the reason |
| `/ai-maintainer stop` | Cancel queued work and prevent automatic retries |

Human instructions cannot grant merge rights, increase the monthly hard limit, expose
secrets, or mark checks as passed.

## Manual verification completion

The human who performs the test plan should:

1. Report the environment used.
2. Note any deviations or failures.
3. Remove `manual-verification-required` only when satisfied.
4. Mark the PR ready for review.

The worker may summarize human feedback or prepare fixes, but should not mark its own
manual-verification PR ready.

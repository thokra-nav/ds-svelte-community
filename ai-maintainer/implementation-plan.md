# Implementation plan

## Guiding principle

Build a thin end-to-end path before adding sophisticated agent behavior. Every phase
must leave the system deployable and observable.

## Suggested implementation order

### Phase 0: Create the worker repository

**Goal:** Establish a secure, testable TypeScript/Bun service.

Deliverables:

- New private or internal GitHub repository
- Bun workspace with strict TypeScript and existing organizational linting
- Container image built in CI and stored in Artifact Registry
- Terraform module for service account, Secret Manager bindings, Firestore,
  Cloud Run Jobs, and Cloud Scheduler
- Structured logging with execution and task IDs
- Architecture decision records for Cloud Run, Firestore, GitHub App, and Vertex AI

Exit criteria:

- A hello-world job runs in the selected EU region.
- The service account calls Vertex AI without a static Google credential.
- CI can build and scan the worker image.

### Phase 1: Configuration and policy

**Goal:** Make behavior repository-controlled before implementing automation.

Deliverables:

- Parser and schema for root target-policy `ai-maintainer.toml`
- Strict rejection of unknown or invalid fields
- Trusted platform configuration for model routing, budgets, cadence, and
  deployment, kept separate from target policy
- Target-policy PR limits, risk classification, and validation configuration
- Policy revision hash included in every task
- Loader for a component parity manifest
- Redaction tests proving secrets never enter logs or model prompts

Exit criteria:

- The example configuration validates.
- Invalid target policy, platform configuration, and commands fail closed.
- A configuration change produces a different policy revision.

### Phase 2: GitHub App and persistent state

**Goal:** Establish safe, idempotent repository access.

Deliverables:

- GitHub App installation-token exchange
- Read-only repository inspection
- Branch push and draft PR creation in a test repository
- Firestore release, task, lease, and budget stores
- Stable idempotency keys
- Authorized maintainer detection for labels and commands

Exit criteria:

- Replaying the same fixture updates one PR rather than creating duplicates.
- Concurrent workers cannot acquire the same task lease.
- The App cannot merge or create releases.

### Phase 3: Aksel release observer

**Goal:** Detect and describe upstream changes without editing code.

Deliverables:

- Daily Cloud Scheduler trigger
- Aksel release and tag discovery
- Package changelog parser
- Changed-path and commit-range resolver
- Component-name normalization
- Release report containing affected packages, components, source links, and urgency
- Observer mode that creates an issue or check report only

Exit criteria:

- Historical fixtures from several Aksel releases produce stable candidate tasks.
- Package-only releases do not trigger unnecessary component implementation.
- Re-running an observed release is a no-op.

### Phase 4: Deterministic classification

**Goal:** Decide what the worker may attempt before using a coding model.

Deliverables:

- Supported, missing, ignored, deprecated, and deferred statuses
- Risk scoring from changed paths and configured signals
- New-component detection
- PR grouping by component family
- Active-PR and budget admission control
- Human-readable classification rationale

Exit criteria:

- DatePicker, FileUpload, portals, focus traps, and virtualization classify as complex.
- Simple markup or variant changes classify as low risk.
- Every changed component receives a disposition.

### Phase 5: First coding vertical slice

**Goal:** Produce a draft PR for one already supported, low-risk component.

Deliverables:

- Ephemeral clone and deterministic branch
- Exact upstream-tag checkout or raw source retrieval
- Bounded context containing relevant React source, tests, stories, changelog, local
  Svelte implementation, tests, and project instructions
- Vertex AI model adapter with token and cost reporting
- Allowed-path enforcement
- Git commit, push, and draft PR update

Exit criteria:

- A fixture release produces a useful component-scoped PR.
- The PR includes upstream provenance, model route, cost, changed files, and test plan.
- The worker stops after configured attempt or token limits.

### Phase 6: Validation and evidence

**Goal:** Distinguish verified changes from suggestions.

Deliverables:

- Command runner for configured Bun checks
- Structured parsing of HTML parity failures
- Side-by-side React and Svelte screenshots
- Pixel-diff image generation
- Browser interaction test support
- Evidence upload and PR-body rendering
- Verification decision engine

Run an early Cloud Run spike for the existing `Bun.WebView` tests. If they are not
reliable, add a separately executable Playwright evidence path rather than silently
skipping visual tests.

Exit criteria:

- Successful visual changes include both matching screenshots.
- Failed visual comparison includes a diff.
- A skipped or unavailable required check forces manual verification status.

### Phase 7: Pull request lifecycle and human controls

**Goal:** Make uncertain work useful without overstating confidence.

Deliverables:

- Ready-candidate and suggestion-draft PR modes
- Labels documented in [pull-request-workflow.md](./pull-request-workflow.md)
- Concise generated manual test plans
- Maintainer commands for retry, defer, stop, approve scope, and request revision
- PR-cap enforcement
- Closed-PR and merged-PR reconciliation

Exit criteria:

- Complex changes always remain draft.
- Unauthorized users cannot trigger model spend or broaden scope.
- Human feedback updates the existing branch and PR.

### Phase 8: Controlled pilot

**Goal:** Measure usefulness on real releases with a narrow allowlist.

Initial component candidates should be presentational and already well tested, for
example typography, Alert variants, Tag, Skeleton, Loader, or simple primitives.
Choose final candidates from the current upstream delta rather than hard-coding them.

Pilot settings:

- one task at a time;
- maximum three active AI PRs;
- no automatic missing-component implementation;
- all PRs start as drafts;
- explicit human confirmation before changing pilot scope.

Exit criteria:

- At least five real upstream component changes processed.
- No duplicate PRs.
- Cost and token estimates are acceptably close to actual usage.
- Reviewers consider at least 70% of low-risk PRs mergeable with normal review effort.

### Phase 9: New and missing components

**Goal:** Extend from maintenance into controlled coverage growth.

Deliverables:

- One-time triage of the existing missing-component backlog
- Automatic attempt for every newly introduced Aksel component
- Priority queue for existing low-risk missing components
- Automatic draft suggestion for complex missing components
- Manifest updates included with implementation PRs

Exit criteria:

- Every current missing component has a rationale and risk classification.
- Newly exported React components cannot pass unnoticed.
- Complex components produce useful investigation or scaffold PRs without blocking
  other work.

### Phase 10: Steady-state operations

**Goal:** Safely raise throughput to the agreed operating model.

Deliverables:

- Maximum ten active AI PRs
- Configurable parallelism
- Monthly budget enforcement and alerts
- Model-route benchmarking
- Operational dashboard and failure alerts
- Dead-letter handling and manual replay tooling
- Periodic policy and prompt evaluation

Exit criteria:

- Daily operation requires no routine VM or container access.
- Maintainers can understand every decision from GitHub and logs.
- The worker stops safely when state, configuration, budget, or upstream evidence is
  inconsistent.

## Testing strategy

### Unit tests

- Config parsing and validation
- Changelog and path parsing
- Component-name normalization
- Risk rules and grouping
- Idempotency keys
- Budget reservation and reconciliation
- PR template rendering

### Contract tests

- GitHub API using recorded fixtures or a test repository
- Vertex request and response mapping
- Firestore serialization and lease semantics
- Aksel repository layout fixtures
- Target repository configuration schema

### Integration tests

- Release fixture to task records
- Task fixture to branch and draft PR
- Validation failure to suggestion PR
- Retry to existing PR
- Budget threshold to task rejection
- Unauthorized command to no-op with audit log

### End-to-end tests

Use a dedicated GitHub test repository and non-production GitHub App installation.
Run a synthetic upstream release through planning, implementation, validation,
evidence, and PR creation.

## Initial delivery estimate

For one experienced engineer using AI assistance:

| Stage | Estimate |
| --- | ---: |
| Phases 0-3: secure observer | 2-3 weeks |
| Phases 4-7: first trustworthy PR loop | 3-5 weeks |
| Phase 8: controlled pilot | 2-4 weeks |
| Phases 9-10: expanded operation | Driven by pilot results |

These are engineering estimates, not commitments. The `Bun.WebView` Cloud Run spike
and GitHub attachment workflow are the largest early unknowns.

## First ten implementation issues

1. Bootstrap the Bun/TypeScript worker and CI image build.
2. Define and validate the target-policy `ai-maintainer.toml` schema and separate
   trusted platform configuration schema.
3. Provision the Cloud Run, Scheduler, Firestore, IAM, and Secret Manager baseline.
4. Implement GitHub App authentication with least privilege.
5. Implement Firestore task leases and idempotency.
6. Parse Aksel releases, changelogs, tags, and changed paths.
7. Produce observer-mode release reports.
8. Implement deterministic risk classification and component grouping.
9. Build the isolated task executor and Vertex model adapter.
10. Complete one release-to-draft-PR vertical slice.

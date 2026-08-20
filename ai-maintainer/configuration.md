# Configuration contract

## Location and ownership

The maintained repository contains `ai-maintainer.toml` at its root. The worker
repository owns the schema and runtime implementation, while the target repository
owns only its maintenance policy.

The worker loads that policy with separately reviewed, trusted platform
configuration. The platform injects GitHub App identity and credentials, model
provider/project/location/routing/pricing, budgets, schedules, Cloud Run jobs,
resource settings, retries, and other deployment concerns. None of those values
belong in the target repository.

Secrets must never appear in this file. Secret values and GitHub App credentials
belong in the platform's secret store.

## Parsing rules

- `schema_version` is required.
- Unknown keys fail validation.
- Invalid commands or repository safety limits fail closed.
- Target policy is read from the target default branch at planning time.
- Trusted platform configuration is validated separately before its values are
  injected.
- Each task records the configuration commit and a normalized policy hash.
- Existing tasks retain their original policy unless a maintainer explicitly retries
  them using current policy.
- Platform injection and environment variables must not override repository safety
  policy or increase its limits.

See [ai-maintainer.example.toml](./ai-maintainer.example.toml) for a complete example.

## Configuration areas

### Project

Identifies the target repository and the component manifest. It also selects the
instructions that should be included in model context.

### Upstream

Defines:

- Aksel repository
- packages that must move in lockstep
- release source
- changelog paths
- whether prereleases are considered

### Classification

Contains deterministic signals for complex work. The default signals should include:

- focus and keyboard navigation;
- dates and calendars;
- file and drag-and-drop APIs;
- portals and positioning;
- virtualization;
- new shared context or provider architecture;
- screen-reader-specific behavior.

The model may increase risk but may not lower a deterministic complex classification
without explicit policy support.

### Pull requests

Controls:

- grouping policy;
- maximum active PRs;
- draft behavior;
- labels;
- evidence requirements;
- manual test-plan length;
- changed-file and diff-size limits.

### Repository safety limits

The target policy caps active pull requests, changed files, and diff lines. Worker
concurrency, retry counts, leases, timeouts, schedules, model-call limits, and
budgets are platform controls and must not be configured here.

### Validation

Commands are argument arrays rather than shell strings. This avoids shell expansion
and makes execution auditable. Commands run from explicitly configured directories.

Required checks cannot be silently skipped. If a required check is unavailable, the
task becomes a manual-verification suggestion or fails according to policy.

### Human controls

Defines labels and desired command behavior. The platform controls GitHub App
installation details and verifies command authorization; identities and role
configuration must not be stored in target policy.

Suggested commands:

```text
/ai-maintainer retry
/ai-maintainer defer <reason>
/ai-maintainer stop
/ai-maintainer approve-scope
/ai-maintainer revise <instruction>
```

Free-form revision instructions are untrusted input. They may guide implementation
but cannot modify permissions, budget, allowed paths, or verification status.

## Component parity manifest

The existing hard-coded missing and ignored arrays should eventually move to a
machine-readable manifest. It may be a second file referenced by the root config
because the list will grow independently of general behavior.

Each component entry should contain:

```toml
[components.DatePicker]
status = "deferred"
risk = "complex"
reason = "Date logic, focus movement, keyboard navigation, and popover positioning"
owner = ""
last_reviewed_upstream = "8.16.1"
```

Allowed statuses:

- `supported`
- `experimental`
- `missing`
- `deferred`
- `ignored`
- `deprecated`
- `different-api`

The manifest should distinguish component families from individual exports so a
family such as Dialog can be reviewed coherently without losing export-level coverage.

## Schema evolution

- Additive optional changes may remain within the same schema version.
- New required fields or changed semantics require a new schema version.
- The worker should support the current and immediately previous version during a
  migration window.
- Automated configuration migrations must be proposed through a PR and never written
  directly to the default branch.

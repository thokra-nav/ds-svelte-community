# New repository bootstrap

## Purpose

Use this directory as the design input for a separate worker repository. The worker
should remain independent of `ds-svelte-community`; only policy and the component
manifest belong in the maintained repository.

## Suggested repository setup

1. Create a repository such as `nais/ai-maintainer`.
2. Copy these documents into `docs/ds-svelte-community/` or preserve them as the
   initial project specification.
3. Add a concise root README linking to the architecture and implementation plan.
4. Bootstrap a strict TypeScript/Bun application.
5. Add a Changesets or conventional release process only if the worker will be
   versioned for reuse.
6. Configure CI to test, lint, type-check, build, and scan the container.
7. Create a non-production GitHub App and test repository before requesting access
   to `nais/ds-svelte-community`.

## Recommended technology choices

| Concern | Initial choice |
| --- | --- |
| Language/runtime | TypeScript on Bun |
| Deployment | Cloud Run Jobs |
| Infrastructure | Terraform |
| State | Firestore |
| Model provider | Vertex AI adapter |
| GitHub integration | GitHub App and GitHub REST/GraphQL APIs |
| Configuration | TOML with a checked-in JSON Schema equivalent |
| Validation execution | Direct process spawning with argument arrays |
| Browser evidence | Existing Bun WebView if reliable; Playwright fallback |
| Logging | Structured JSON to Cloud Logging |
| Tests | Bun test with recorded upstream and GitHub fixtures |

Avoid adopting a large generic agent framework initially. The difficult parts are
policy, provenance, idempotency, validation, and review UX, not agent chat or memory.

## Initial repository skeleton

```text
.
|-- .github/
|   |-- workflows/
|   |   |-- test.yaml
|   |   |-- image.yaml
|   |   `-- terraform-plan.yaml
|   `-- dependabot.yml
|-- deploy/
|   |-- Dockerfile
|   `-- terraform/
|-- docs/
|   |-- architecture.md
|   |-- operations.md
|   `-- adapters.md
|-- schemas/
|   `-- ai-maintainer.schema.json
|-- src/
|   |-- cli/
|   |-- config/
|   |-- planner/
|   |-- classifier/
|   |-- executor/
|   |-- models/
|   |-- github/
|   |-- state/
|   |-- validation/
|   |-- evidence/
|   |-- budget/
|   `-- observability/
|-- test/
|   |-- fixtures/
|   |-- integration/
|   `-- contract/
|-- package.json
|-- bun.lock
|-- tsconfig.json
`-- README.md
```

## Interfaces to define first

```typescript
interface StateStore {
  claimTask(taskId: string, lease: Lease): Promise<ClaimResult>;
  saveTask(task: MaintenanceTask): Promise<void>;
  reserveBudget(request: BudgetReservation): Promise<BudgetDecision>;
}

interface UpstreamAdapter {
  listReleases(after?: string): Promise<UpstreamRelease[]>;
  analyzeRelease(release: UpstreamRelease): Promise<UpstreamDelta>;
  loadComponentContext(request: ComponentContextRequest): Promise<ComponentContext>;
}

interface ModelProvider {
  run(request: ModelRequest): Promise<ModelResult>;
}

interface RepositoryAdapter {
  loadPolicy(ref: string): Promise<RepositoryPolicy>;
  prepareBranch(task: MaintenanceTask): Promise<Workspace>;
  publishPullRequest(request: PullRequestRequest): Promise<PullRequestResult>;
}

interface Validator {
  validate(workspace: Workspace, policy: ValidationPolicy): Promise<ValidationReport>;
}
```

The exact interfaces will evolve, but these boundaries prevent Firestore, Aksel,
Vertex, or GitHub details from spreading through orchestration code.

## Local development

Provide commands for:

- validating a target configuration;
- replaying an Aksel release fixture;
- planning without model calls;
- running a task against a local checkout without pushing;
- rendering the proposed PR body;
- estimating model cost;
- running Firestore and GitHub adapters against fakes;
- executing an explicitly authorized test-repository end-to-end run.

No local command should default to pushing a branch or invoking a paid model.

## Target-repository changes during the pilot

The first worker-generated or human-authored setup PR in `ds-svelte-community` should:

1. Add root target-policy `ai-maintainer.toml`; configure credentials and deployment
   only in trusted platform configuration.
2. Add the machine-readable component parity manifest.
3. Adapt `component_done.test.ts` to read or validate the manifest.
4. Add successful React and Svelte screenshot generation.
5. Document AI-maintained PR labels and human commands.
6. Keep Changesets, Dependabot, CI, release permissions, and branch protection under
   human control.

## Definition of ready for production access

The worker may receive access to the real repository only when:

- the GitHub App permission set has been reviewed;
- idempotency has been proven in a test repository;
- budget hard stops have automated tests;
- the Cloud Run browser spike has completed;
- invalid configuration and unavailable state fail closed;
- suggestion PRs reliably remain drafts;
- unauthorized users cannot trigger work;
- prompts and logs have been inspected for credential leakage;
- operations has a documented disable switch.

## Emergency disable mechanisms

Maintain at least two:

1. Disable the Cloud Scheduler job or Cloud Run worker IAM invocation.
2. Set `enabled = false` in trusted platform configuration.

Revoking the GitHub App installation is the final containment mechanism.

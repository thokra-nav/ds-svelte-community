# Cloud Run deployment and operations

## Recommended deployment

Use Cloud Run Jobs rather than a long-running Cloud Run service.

### Jobs

- `ai-maintainer-planner`: one daily task that discovers and queues work
- `ai-maintainer-worker`: one task per component-scoped work item

Cloud Scheduler invokes the planner. The planner or a small dispatcher invokes worker
executions through the Cloud Run Jobs API with task-specific identifiers.

## Why Cloud Run Jobs fit

- Scale to zero between executions
- Native service-account authentication to Vertex AI
- Secret Manager integration
- Configurable CPU, memory, retries, and timeout
- Writable ephemeral filesystem for a clean checkout
- No inbound public service is required
- Execution logs integrate with Cloud Logging

Cloud Run's filesystem is memory-backed and does not persist. This is desirable for
isolation, but repository checkout, dependencies, builds, and screenshots count
against task memory.

## Initial sizing

Start with:

| Job | CPU | Memory | Timeout | Retries |
| --- | ---: | ---: | ---: | ---: |
| Planner | 1 | 1 GiB | 10 minutes | 1 |
| Worker | 2 | 8 GiB | 90 minutes | 1 |

Adjust from observed peak memory and execution duration. Run tasks sequentially during
the pilot.

## Browser testing spike

The target project currently uses `Bun.WebView` with a Chrome backend. Before relying
on Cloud Run:

1. Build a worker image with the exact Bun version from `mise.toml`.
2. Install required Chrome and system libraries.
3. Run the full visual test command in a Cloud Run Job.
4. Confirm light and dark screenshots are stable across repeated executions.
5. Confirm WebView disposal and temporary-file cleanup.
6. Measure memory and filesystem usage.

If this is unreliable, retain the existing local test for development and add a
Playwright/Chromium evidence runner designed for container execution. Do not mark
visual checks as successful when the browser backend was unavailable.

## State

Use Firestore for:

- processed release markers;
- task queue and state;
- leases;
- PR and branch mapping;
- policy revision;
- cost reservations and actual usage;
- retry and human-command audit records.

Do not use the Cloud Run filesystem as a task queue or cache of record.

## Authentication

### Google Cloud

Assign separate planner and worker service accounts if practical.

Planner permissions:

- read required secrets;
- read and write Firestore planning records;
- invoke worker jobs;
- write logs and metrics.

Worker permissions:

- invoke Vertex AI models;
- read required secrets;
- read and write task records;
- write evidence staging objects if used;
- write logs and metrics.

Avoid service-account keys. Use Cloud Run service identity.

### GitHub

Store the GitHub App private key in Secret Manager. Exchange it for short-lived
installation tokens at runtime. Never expose the private key or installation token to
the model prompt.

Use a separate GitHub App installation and test repository for integration tests.

## Container image

The worker image should contain:

- Bun at the project-pinned version;
- Git and GitHub CLI or a GitHub API client;
- Chrome/Chromium and required libraries;
- image comparison dependencies;
- the worker application;
- no repository credentials or project source checkout.

Clone the maintained repository at execution time. Use `bun install
--frozen-lockfile`; do not permit dependency scripts or network access beyond what the
project currently requires without reviewing the security implications.

## Scheduling and concurrency

- Run the planner once daily.
- Process releases in ascending order.
- Do not start new tasks when ten AI PRs are active.
- Begin with worker parallelism one and raise it to two only after Firestore leases and
  budget reservations are proven.
- Do not run two tasks against the same component family concurrently.

## Budget controls

Before invoking a model:

1. Estimate task cost using selected model and context size.
2. Reserve that amount in the monthly budget record.
3. Reject or downgrade the task when reservation would cross a threshold.
4. Record provider-reported token usage after every call.
5. Reconcile reservation and actual cost.

At 80% of budget:

- prefer lower-cost classification routes;
- stop proactive existing-backlog work;
- continue deterministic monitoring.

At 100%:

- stop new model calls;
- allow deterministic release reporting;
- label affected tasks `ai-budget-blocked`;
- require a repository configuration change for a higher hard limit.

## Observability

Every log entry should include:

- Cloud Run execution;
- task ID;
- idempotency key;
- target repository;
- upstream version;
- component family;
- model route, but not prompt content by default;
- attempt;
- PR number when available.

Create metrics and alerts for:

- planner failures;
- oldest unprocessed release;
- task duration and failures;
- duplicate-prevention events;
- active AI PR count;
- model spend and forecast;
- manual-verification PR age;
- Cloud Run memory termination;
- GitHub or Vertex authentication failures.

Prompt and response logging should be disabled or minimized. When retained for
debugging, redact secrets and repository credentials, restrict access, set a short
retention period, and keep data in the chosen EU-supported location.

## Failure behavior

- Invalid repository configuration: create no work and alert maintainers.
- Firestore unavailable: fail before model invocation.
- GitHub unavailable after implementation: preserve task state and retry idempotently.
- Validation unavailable: create a suggestion only if policy permits; otherwise fail.
- Budget state unavailable: fail closed.
- Evidence upload unavailable: keep the PR draft and clearly report missing evidence.
- Unexpected changed paths: do not push until a maintainer approves scope.

## Infrastructure as code

Terraform should provision:

- Artifact Registry repository;
- planner and worker service accounts;
- IAM bindings;
- Secret Manager secret containers and access bindings;
- Firestore database and indexes;
- Cloud Run planner and worker jobs;
- Cloud Scheduler trigger;
- log-based metrics and alert policies;
- optional Cloud Storage evidence staging bucket.

Keep production values in trusted platform configuration, not in the reusable
Terraform module or the target repository's `ai-maintainer.toml`.

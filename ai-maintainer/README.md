# AI Maintainer project brief

This directory contains the design material for a separate `ai-maintainer` project.
The proposed system maintains `nais/ds-svelte-community` by monitoring
[`navikt/aksel`](https://github.com/navikt/aksel), preparing bounded pull requests,
and leaving every merge and release decision to a human.

The worker is not intended to be a general autonomous coding agent. It is a
policy-driven maintenance service with a narrow upstream source, deterministic
validation, explicit budgets, and human-controlled outcomes.

The maintained repository holds target policy only. Trusted platform configuration
injects credentials, GitHub App identity, model routing and pricing, budgets,
scheduling, and deployment settings; none belong in `ai-maintainer.toml`.

## Agreed operating model

| Area | Decision |
| --- | --- |
| Execution | Scheduled Cloud Run Jobs |
| Model provider | Gemini through Vertex AI in an EU-supported region |
| Repository access | GitHub App with branch, PR, issue, and comment access |
| Merge and release access | None |
| Upstream cadence | Check daily and process each Aksel release once |
| Pull request boundary | One component or tightly coupled component family |
| Active AI pull requests | Maximum 10 |
| Model budget | Configurable, initially USD 50 per month |
| Other dependencies | Continue using Dependabot |
| Existing component backlog | Triage once, implement low-risk items over time |
| Newly introduced components | Always attempt classification and implementation |
| Complex changes | Open a draft suggestion PR with a concise manual test plan |
| Parity contract | Match HTML, accessibility, and behavior; allow documented Svelte APIs |
| Visual evidence | Side-by-side Svelte and React screenshots, plus mismatch diffs |
| Configuration | Versioned root target policy plus trusted platform configuration injected at runtime |

## Document map

- [Feasibility study](./feasibility-study.md)
- [Architecture](./architecture.md)
- [Implementation plan](./implementation-plan.md)
- [Configuration contract](./configuration.md)
- [Example configuration](./ai-maintainer.example.toml)
- [Pull request and verification workflow](./pull-request-workflow.md)
- [Cloud Run deployment and operations](./cloud-run-operations.md)
- [New repository bootstrap](./project-bootstrap.md)

## Recommended first milestone

Build one complete, deliberately narrow vertical slice:

1. A scheduled planner detects one new Aksel release.
2. It identifies one affected, already supported component.
3. A worker creates an isolated checkout and updates only that component.
4. Existing validation commands run.
5. The worker opens a draft PR containing provenance, evidence, cost, and test plan.
6. Re-running the same release does not create a duplicate branch or PR.

Do not begin automatic missing-component implementation until this path is reliable.

## Source project strengths

`ds-svelte-community` already contains much of the acceptance infrastructure:

- `toMimicReact` compares rendered Svelte and React HTML.
- Visual tests compare React and Svelte in light and dark themes.
- `component_done.test.ts` detects differences in exported component coverage.
- CI runs tests, linting, type checking, and visual comparison.
- Changesets provide human-controlled publishing.
- `.github/copilot-instructions.md` documents important Svelte conventions.

The main gaps are behavioral browser testing, machine-readable component policy,
successful screenshot evidence, and reliable upstream-delta orchestration.

## Non-goals

- Automatically merging or publishing packages
- Replacing Dependabot for non-Aksel dependencies
- Reimplementing Aksel's full React API exactly
- Treating generated code as verified when interaction testing is incomplete
- Maintaining arbitrary repositories without an explicit adapter and policy
- Allowing the model to alter its own permissions, budget, or safety constraints

## Reference date

This plan was prepared on 2026-08-18. At that time, the maintained repository used
Aksel packages at `8.9.1`, while the latest verified Aksel release was `8.16.1`.
Aksel had published 62 non-draft releases during the preceding year.

# Feasibility study

## Conclusion

The system is feasible as a controlled pull-request maintainer. It is not feasible
to guarantee unattended parity for every Aksel component, because correctness for
focus management, keyboard interaction, dates, files, portals, virtualization, and
assistive technology cannot be established from server-rendered HTML or screenshots
alone.

The correct product boundary is:

> Automatically investigate every upstream release, implement changes where
> confidence is supported by evidence, and produce a clearly marked suggestion
> when human verification remains necessary.

## Why this repository is a good candidate

### Strong existing signals

- Aksel's packages use lockstep versions, making release detection straightforward.
- The upstream React changelog names affected components and links changes to commits
  and pull requests.
- React source, tests, stories, examples, CSS, tokens, and icons are all available in
  one public repository.
- The Svelte library already imports the matching React package in parity tests.
- CSS is shared through `@navikt/ds-css`, reducing translation to markup, state, and
  behavior.
- The project has a clear review and Changesets-based release flow.

### Existing acceptance mechanisms

| Mechanism | Value | Limitation |
| --- | --- | --- |
| SSR HTML comparison | Detects markup, attributes, and class drift | Does not execute browser interaction |
| Pixel comparison | Detects rendering differences | Cannot prove semantics or interaction |
| Light/dark rendering | Covers theme-sensitive output | Only covers represented stories |
| Component export test | Detects new or removed React exports | Uses a hard-coded policy list |
| Type checking and linting | Prevents many invalid translations | Does not prove runtime behavior |
| Human PR review | Final safety boundary | Reviewer capacity is finite |

## Work classification

### High-confidence automation

- Package version alignment across Aksel packages
- Classes, data attributes, ARIA attributes, and element structure
- New presentational variants and sizes
- Typography and token changes
- Simple stateless components
- Documentation and story updates
- Generated icon updates
- Deprecation annotations and export changes

### Medium-confidence automation

- Controlled and uncontrolled values
- Form field validation and message wiring
- Compound components with existing local patterns
- Floating elements that reuse an existing wrapper
- Responsive behavior covered by representative browser tests

These changes may become normal PRs only when relevant interaction tests exist.

### Manual-verification work

- Focus traps and focus restoration
- Keyboard navigation state machines
- Date and calendar calculations
- File selection, drag-and-drop, and upload behavior
- Portals, dismissable layers, and complex positioning
- Virtualized or data-heavy components
- New shared context architecture
- Screen-reader-specific behavior
- Cross-component behavior that cannot be isolated

The worker should still produce code and tests when useful, but the PR must remain a
draft suggestion until a human performs its test plan.

## Primary risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Model produces plausible but incorrect interaction logic | Browser tests, risk classification, draft PRs, manual test plans |
| Repeated attempts consume the monthly budget | Per-task token limits, attempt limits, monthly hard stop |
| Duplicate branches or PRs after retries | Stable idempotency keys and stored task state |
| Upstream changelog omits implementation detail | Inspect source, tests, stories, examples, and commit diff |
| Large release creates excessive review load | Ten-PR cap, priority queue, one component per PR |
| Visual tests fail only in Cloud Run | Validate `Bun.WebView` early and retain a Playwright fallback option |
| Agent modifies unrelated code | Path allowlists, diff-size limits, clean-checkout verification |
| GitHub credentials are exposed to model context | Keep signing and API operations outside the model tool boundary |
| Automated PR overstates confidence | Mandatory verification status and evidence sections |
| Component coverage policy drifts | Replace hard-coded lists with a versioned parity manifest |

## Cost feasibility

The initial USD 50 monthly model budget is reasonable if:

- a lower-cost Gemini model performs release parsing and classification;
- a stronger model is used only for implementation and difficult review;
- unchanged packages and unsupported components are filtered before model execution;
- repository instructions and stable upstream context use caching where available;
- each task has strict iteration and token limits.

A practical starting allocation is:

| Work | Monthly target |
| --- | ---: |
| Release detection and classification | USD 2-5 |
| Low-risk implementations | USD 15-25 |
| Complex suggestion PRs and repair attempts | USD 10-15 |
| Contingency | USD 5-10 |

Cloud Run, storage, logging, and Artifact Registry are separate from the model budget.
Cloud Run Jobs should cost less than an always-on VM for a daily, bursty workload.

## Pilot success criteria

After an eight-week pilot:

- Every upstream release is classified within 24 hours of the scheduled check.
- No release or component task is processed twice.
- At least 70% of low-risk PRs are useful enough to merge after normal review.
- No PR claims verification that was not actually performed.
- Every UI-changing PR contains visual evidence.
- Every manually verifiable PR contains a test plan with no more than seven steps.
- The worker remains within the configured model budget.
- The GitHub App cannot merge, publish, or bypass branch protection.
- A failed worker execution cannot corrupt another task or persistent checkout.

## Recommendation

Proceed with a staged pilot. Start with updates to already supported, presentational
components. Add missing-component work only after the release-to-PR path is reliable
and observable.

## Sources

- [Aksel repository](https://github.com/navikt/aksel)
- [Aksel releases](https://github.com/navikt/aksel/releases)
- [ds-react changelog](https://github.com/navikt/aksel/blob/main/%40navikt/core/react/CHANGELOG.md)
- [Cloud Run Jobs](https://cloud.google.com/run/docs/create-jobs)
- [Cloud Run task timeouts](https://cloud.google.com/run/docs/configuring/task-timeout)
- [Cloud Run container contract](https://cloud.google.com/run/docs/container-contract)
- [Vertex AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)


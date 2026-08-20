# ds-svelte-community

> Svelte 5 component library mirroring [Aksel React components](https://aksel.nav.no) for NAIS.

## ⚠️ CRITICAL RULES — Read before writing ANY code

1. **Use `bun`, never `npm`/`node`.**
2. **CSS class prefix is `aksel-`**, not `navds-`. React components use `navds-`, we use `aksel-`.
3. **Always `omit(restProps, "class")` when spreading restProps** on an element with a `class` attribute. Spread BEFORE class. [Details →](#spreading-restprops-and-class-handling)
4. **`class` vs `className`**: Svelte uses `class`, React uses `className`. Remember this in tests.
5. **Never `$state` + `$effect` to sync props.** Use `let x = $derived(prop)` instead — `$derived` is writable since Svelte 5.25. [Details →](#writable-derived)
6. **Never pass props directly to `setContext()`** — they capture the initial value. Use getter functions or objects with getters. [Details →](#component-context-pattern)
7. **Context types are interfaces, not classes.** Create context as plain objects with getters, not class instances with `$state` fields. [Details →](#component-context-pattern)
8. **`$effect` is ONLY for DOM/third-party library interaction** (canvas, floating-ui, etc.), never for syncing reactive state.
9. **Run the [pre-completion checklist](#pre-completion-checklist)** before considering any feature done.
10. **HTML parity with React is enforced by tests.** Components must generate identical HTML to `@navikt/ds-react`. Look at TSX files in `./node_modules/@navikt/ds-react/src/` for reference.

---

## Pre-Completion Checklist

Run all of these successfully before finishing a feature:

```bash
bun run lint                                                               # Lint
bun run check                                                              # Type-check (0 errors AND 0 warnings)
cd packages/ds-svelte-community && AI_CONTEXT=true bun run test            # Unit tests (fast)
cd packages/ds-svelte-community && VISUAL_TESTS=true AI_CONTEXT=true bun run test  # Visual comparison tests
```

If changes affect the published package (not just docs/tests), create a changeset:

```bash
bun x changeset add --empty    # then edit the created file in .changeset/
```

---

## Svelte Patterns

### Component Props Handling

```svelte
let {
	variant = "primary",
	size = "medium",
	children,
	ref = $bindable(),
	...restProps
}: ComponentProps = $props();
```

### Spreading restProps and class handling

**ALWAYS** use `omit(restProps, "class")` and place the spread BEFORE the class attribute:

```svelte
<!-- ✅ CORRECT: spread with omit, then class -->
<div
	{...omit(restProps, "class")}
	class={["aksel-component", `aksel-component--${variant}`, restProps.class]}
>

<!-- ❌ WRONG: class gets overwritten by spread -->
<div
	class={["aksel-component", `aksel-component--${variant}`, restProps.class]}
	{...restProps}
>
```

In tests, remember `class` vs `className`:

```typescript
expect(render(SvelteComponent, { value: 75, class: "x" }))
	.toMimicReact(ReactComponent, { props: { value: 75, className: "x" } });
```

### Writable $derived

Since Svelte 5.25, `$derived` values can be reassigned. **Always prefer this over `$state` + `$effect`:**

```svelte
<!-- ✅ Good: writable derived tracks the prop reactively -->
let localValue = $derived(propValue);

<!-- ❌ Bad: $state + $effect to sync -->
let localValue = $state(propValue);
$effect(() => { localValue = propValue; });
```

This also applies to destructuring page data and similar patterns:

```svelte
let { data } = $props();
let { filled, stroked } = $derived(data);   // reactive destructuring
```

### Component Context Pattern

For parent/child component communication, use **interfaces + plain objects with getters**. Never use classes with `$state` fields for context.

**Provider (parent component):**

```svelte
<script lang="ts" module>
	export interface MyContext {
		readonly size: "small" | "medium";
		value: string;
		onchange(v: string): void;
	}
	const contextKey = Symbol("MyContext");

	export function GetMyContext(): MyContext {
		return getContext<MyContext>(contextKey);
	}
</script>

<script lang="ts">
	let { size = "medium", value = $bindable(), onchange, children } = $props();

	// Internal mutable state uses $state (this is NOT prop syncing)
	let tabs = $state<HTMLElement[]>([]);

	const ctx: MyContext = {
		get size() { return size; },           // getter reads prop reactively
		get value() { return value; },         // getter for bindable prop
		set value(v) { value = v; },           // setter updates bindable prop
		onchange(v: string) { value = v; onchange?.(v); },
	};
	setContext(contextKey, ctx);
</script>
```

**For simple scalar context** (just sharing one value), use a getter function:

```svelte
<!-- Provider -->
setContext("my-size", () => size);

<!-- Consumer -->
const getSize = getContext<() => "small" | "medium">("my-size");
let size: "small" | "xsmall" = $derived(getSize() === "medium" ? "small" : "xsmall");
```

**Rules:**
- `setContext("key", propValue)` ← **WRONG**, captures initial value
- `setContext("key", () => propValue)` ← **RIGHT**, getter reads reactively
- `$state` in context is only for **internal mutable state** (registered children, active tab, etc.)
- `$effect` is only for **third-party library integration** (floating-ui, canvas, etc.)

### Icons in Buttons

Pass icon component directly. `aria-hidden="true"` is added automatically:

```svelte
<Button title="Close" variant="tertiary-neutral" size="small" icon={XMarkIcon} />
```

Use a snippet only for custom attributes on the icon:

```svelte
<Button title="Close" variant="tertiary-neutral" size="small">
	{#snippet icon()}
		<XMarkIcon data-testid="close-icon" />
	{/snippet}
</Button>
```

---

## Project Structure

### Monorepo Layout

```
packages/ds-svelte-community/    # Main component library
packages/vite-plugin-svelte-docs/ # Custom Vite plugin for doc generation
```

### Component File Structure

```
ComponentName/
├── ComponentName.svelte      # Main component
├── ComponentName.test.ts     # Tests against React version
├── ComponentName.test.svelte # Test wrapper (only if using snippets)
└── type.ts                   # TypeScript interfaces (or type.svelte.ts if using $state)
```

Only create `.test.svelte` if you need to render snippets/children in tests.

### Export Entry Points

- `.` — Main components
- `./icons` — Icon components (auto-generated via `./hack/generate-icons.sh`)
- `./experimental` — Experimental components
- `./css` — Stylesheets

### Shared Base Components

When multiple components share structure, create an internal base:

1. Create `Base*` folder with shared implementation
2. Public components are thin wrappers passing fixed props
3. Keep base components internal (don't export from main index)
4. Group in subdirectories (e.g., `alerts/GlobalAlert`, `alerts/LocalAlert`)

---

## Testing

### Commands

```bash
bun run test                                       # Unit tests only
VISUAL_TESTS=true bun run test                     # With visual comparison
VISUAL_TESTS=true AI_CONTEXT=true bun run test     # With AI-friendly diff output
```

### Test Pattern (toMimicReact)

```typescript
expect(render(SvelteComponent, props)).toMimicReact(ReactComponent, {
	props: { ...props },
	opts: {
		compareAttrs(node, attr) {
			if (["id", "aria-labelledby"].includes(attr)) return false;
			return true;
		},
	},
});
```

### Understanding Test Diffs

With `AI_CONTEXT=true`, diffs use markers instead of colors:

- `[SVELTE_ONLY]content[/SVELTE_ONLY]` — content only in Svelte output
- `[REACT_ONLY]content[/REACT_ONLY]` — content only in React output

No markers = identical. If test fails without visible diff, it's a visual (screenshot) difference.

---

## Documentation & Stories

### Doc Pages

Include all subcomponent docs using `extraChildrenDoc`:

```svelte
<script lang="ts">
	import doc from "$lib/components/ComponentName/ComponentName.svelte?doc";
	import subDoc from "$lib/components/ComponentName/SubComponent.svelte?doc";
</script>

<Doc {doc} extraChildrenDoc={[subDoc]}>
	<Story><!-- Default story (no name prop) --></Story>
	<Story name="Variant Name"><!-- Named stories --></Story>
</Doc>
```

### Story Guidelines

- Replicate stories from [Aksel examples](https://github.com/navikt/aksel/tree/main/aksel.nav.no/website/pages/eksempler)
- All text in **English**, even if Aksel stories are Norwegian
- **Never use `Link` component** in stories — use plain `<a>` tags
- Use `resolve()` from `$app/paths` for internal links (but not for `#anchors`):

```svelte
<script>
	import { resolve } from "$app/paths";
</script>
<a href={resolve("/example")}>Link text</a>
```

### Extending vite-plugin-svelte-docs

If TypeScript utility types aren't supported in doc generation:
- Check `packages/vite-plugin-svelte-docs/src/doc_generator.ts`
- Add handling in `#typeReference()` for new utility types
- Rebuild: `cd packages/vite-plugin-svelte-docs && bun run build`

---

## CSS & Theming

- Uses `@navikt/ds-css` and `@navikt/ds-tokens` for design system consistency
- All components support light/dark themes via `ThemeContext`
- Class prefix: `aksel-` (React uses `navds-`, we replace it)

---

## Changesets

```bash
bun x changeset add --empty    # Create changeset, then edit the file in .changeset/
```

Only needed for changes that affect the published package (not docs-only or test-only changes).

---

## MCP Servers

### Svelte MCP Tools

1. **`list-sections`** — Call FIRST to discover documentation sections
2. **`get-documentation`** — Fetch full docs for relevant sections (supports arrays)
3. **`svelte-autofixer`** — MUST use when writing Svelte code before sending to user
4. **`playground-link`** — Generate playground link (only after user confirms, never if code written to files)

---

## AI maintainer policy

`ai-maintainer-components.toml` is the single source of component-parity policy.
Its `[components.<CanonicalReactExport>]` keys must be public
`@navikt/ds-react` exports, including nested React exports. Do not use Svelte
names as keys.

- Set `status` and `risk` on every entry. Use `complex` for focus, calendar,
  file, portal, drag, or positioning-heavy work; `medium` for interactive and
  form work; and `low` for presentational primitives.
- Use `target_export` only when the public Svelte export has a different name.
  It must name a `supported` or `experimental` Svelte export.
- Give `deferred`, `ignored`, and `different-api` entries a concise `reason`.
  Use `different-api` for documented snippet or slot-based equivalents.
- When React or Svelte exports change, update the manifest in the same change.
  The component parity test rejects missing React entries, unexpected Svelte
  entries, stale manifest keys, duplicate aliases, and misplaced experimental
  exports.

`ai-maintainer.toml` contains target-repository policy only. A trusted platform
configuration injects GitHub App identity and credentials, model
provider/routing/pricing, budgets, schedules, and deployment settings. Never add
those values, tokens, private keys, or other secrets to either policy file.
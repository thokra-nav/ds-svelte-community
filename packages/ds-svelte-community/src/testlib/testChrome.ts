import svelteCSS from "$lib/css/index.css";
import reactCSS from "@navikt/ds-css";
import tailwindcss from "@tailwindcss/vite";
import looksSame from "looks-same";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import type { RenderOutput, RenderTheme } from "./render";
import { configuredVisualEvidenceWriter } from "./visualEvidence";

export const testPages = await mkdtemp(join(tmpdir(), "ds-svelte-test-"));
let testCase = 0;

let svelteView: InstanceType<typeof Bun.WebView> | undefined = undefined;
let reactView: InstanceType<typeof Bun.WebView> | undefined = undefined;
let initialized = false;
let currentTheme: RenderTheme | undefined = undefined;

async function screenshotToBuffer(view: InstanceType<typeof Bun.WebView>): Promise<Buffer> {
	const blob = await view.screenshot({ format: "png" });
	return Buffer.from(await blob.arrayBuffer());
}

async function ensureInitialized(theme: RenderTheme) {
	if (initialized) {
		return;
	}

	const css = await cssMap();

	svelteView = new Bun.WebView({
		headless: true,
		backend: "chrome",
		width: 800,
		height: 600,
	});

	reactView = new Bun.WebView({
		headless: true,
		backend: "chrome",
		width: 800,
		height: 600,
	});

	const svelteTemplate = templateHTML(css.svelte, theme);
	const reactTemplate = templateHTML(css.react, theme);

	const templateDir = await mkdtemp(join(tmpdir(), "ds-svelte-test-tpl-"));
	await Bun.file(join(templateDir, "svelte.html")).write(svelteTemplate);
	await Bun.file(join(templateDir, "react.html")).write(reactTemplate);

	// Navigate both views in parallel — navigate() is safe to call concurrently
	// across different views (they are separate Chrome tabs).
	await Promise.all([
		svelteView.navigate(`file://${join(templateDir, "svelte.html")}`),
		reactView.navigate(`file://${join(templateDir, "react.html")}`),
	]);

	currentTheme = theme;
	initialized = true;
}

/**
 * Build a JS expression that safely sets innerHTML on #root.
 * We use JSON.stringify to serialize the HTML string so that any characters
 * (quotes, backticks, angle brackets, SVG markup, null bytes, etc.) are
 * safely embedded inside a JS string literal.
 */
function setInnerHTMLExpr(html: string): string {
	return `document.getElementById('root').innerHTML = ${JSON.stringify(html)}`;
}

export async function testInChrome(
	svelteComponent: RenderOutput,
	reactComponent: string,
	theme: RenderTheme,
	opts: looksSame.LooksSameOptions = {},
	evidenceIdentity = "",
) {
	await ensureInitialized(theme);

	// If theme changed, update the theme class on both views.
	// evaluate() cannot be called concurrently on the SAME view,
	// but we can run them in parallel across different views.
	if (currentTheme !== theme) {
		const themeExpr = `document.getElementById('root').className = ${JSON.stringify("aksel-theme " + theme)}`;
		await Promise.all([svelteView!.evaluate(themeExpr), reactView!.evaluate(themeExpr)]);
		currentTheme = theme;
	}

	const svelteBody = typeof svelteComponent === "object" ? svelteComponent.body : svelteComponent;

	// Swap content on both views in parallel — each evaluate() targets a different view.
	await Promise.all([
		svelteView!.evaluate(setInnerHTMLExpr(svelteBody)),
		reactView!.evaluate(setInnerHTMLExpr(reactComponent)),
	]);

	// Take screenshots in parallel — each screenshot() targets a different view.
	const [svelteBuffer, reactBuffer] = await Promise.all([
		screenshotToBuffer(svelteView!),
		screenshotToBuffer(reactView!),
	]);

	opts.createDiffImage = true;
	opts.strict = opts.strict ?? true;

	const { equal, diffImage } = await looksSame(
		svelteBuffer,
		reactBuffer,
		opts as looksSame.LooksSameOptions & { createDiffImage: true },
	);
	const evidence = configuredVisualEvidenceWriter();
	if (evidence) {
		const result = await evidence.record({
			identity: evidenceIdentity + "\0" + svelteBody + "\0" + reactComponent,
			theme,
			svelte: svelteBuffer,
			react: reactBuffer,
			match: equal,
			writeDiff: equal ? undefined : (diffPath) => diffImage.save(diffPath),
		});
		return equal ? true : result.diffPath!;
	}
	if (equal) {
		return true;
	}

	testCase++;
	const diffPath = join(testPages, `diff-${testCase}.png`);
	await diffImage.save(diffPath);

	return diffPath;
}

let cache: { react: string; svelte: string } | undefined = undefined;
async function cssMap() {
	if (cache) {
		return cache;
	}

	const react = await compileCSS(reactCSS as string);
	const svelte = await compileCSS(svelteCSS as string);
	cache = { react, svelte };
	return cache;
}

async function compileCSS(file: string) {
	const out = await mkdtemp(join(tmpdir(), "ds-svelte-test-"));

	await build({
		configFile: false,
		build: {
			outDir: out,
			emptyOutDir: false,
			rollupOptions: {
				input: file,
				output: {
					entryFileNames: "[name].js",
					assetFileNames: "[name][extname]",
				},
			},
		},
		plugins: [tailwindcss() as never],
		publicDir: false,
	});

	return await Bun.file(join(out, "index.css")).text();
}

function templateHTML(css: string, theme: RenderTheme) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
		<meta charset="UTF-8">
		<title>Test</title>
		<style>${css}</style>
	</head>
	<body>
		<div id="root" class="aksel-theme ${theme}" data-background="true" data-color="accent" style="height: 100vh;"></div>
	</body>
</html>`;
}

export async function closeDriver() {
	if (svelteView || reactView) {
		console.log("Closing Bun WebViews...");
	}
	const sv = svelteView;
	const rv = reactView;
	svelteView = undefined;
	reactView = undefined;
	initialized = false;
	currentTheme = undefined;
	await Promise.all([
		sv ? sv[Symbol.asyncDispose]() : undefined,
		rv ? rv[Symbol.asyncDispose]() : undefined,
	]);
}

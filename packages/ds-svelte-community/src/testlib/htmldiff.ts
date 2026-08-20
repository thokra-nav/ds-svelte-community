import { Provider, Theme } from "@navikt/ds-react";
import { en } from "@navikt/ds-react/locales";
import * as Diff from "diff";
import type looksSame from "looks-same";
import * as prettier from "prettier";
import prettierHTML from "prettier/parser-html";
import type { FunctionComponent, ReactNode } from "react";
import React from "react";
import * as ReactDOMServer from "react-dom/server";
import { themes, type RenderOutput, type RenderResult, type RenderTheme } from "./render";
import { testInChrome } from "./testChrome";
import { visualFailureCollector } from "./visualFailureCollector";

export type ReactComponent = unknown;

export type DiffOptions = {
	ignoreSpaces?: boolean;
	ignoreComments?: boolean;
	ignoreClasses?: string[];
	before?: number;
	after?: number;

	/**
	 * Alter the value of an attribute on a before comparing.
	 */
	alterAttrValue?: (name: string, value: string) => string;
	/**
	 * Select which attributes to compare.
	 */
	compareAttrs?: (node: HTMLElement, attr: string) => boolean;

	/**
	 * Select which elements to ignore.
	 */
	ignoreElementFromA?: (tag: HTMLElement) => boolean;
	/**
	 * Select which elements to ignore.
	 */
	ignoreElementFromB?: (tag: HTMLElement) => boolean;

	visual?: {
		/**
		 * Skip visual comparison.
		 */
		skip?: boolean;
	} & looksSame.LooksSameOptions;
};

const defaultOpts: DiffOptions = {
	ignoreSpaces: true,
	ignoreComments: true,
	ignoreClasses: ["unstyled"],
	before: 5,
	after: 5,
};

/**
 * Captures the current test name from the call stack
 */
function captureTestName(): string {
	const stack = new Error().stack || "";
	const lines = stack.split("\n");

	// Look for the test file in the stack trace
	// Bun test stack traces have lines like: "at /path/to/component.test.ts:10:11"
	for (const line of lines) {
		// Match test file paths
		const match = line.match(/at\s+(.+?([^/]+)\.test\.[jt]s):(\d+):(\d+)/);
		if (match) {
			const fileName = match[2]; // Extract just the component name
			const lineNum = match[3];
			return `${fileName} (line ${lineNum})`;
		}
	}

	// Fallback: try to extract from any .test.ts/.test.js file reference
	for (const line of lines) {
		if (line.includes(".test.")) {
			const fileMatch = line.match(/([^/]+)\.test\.[jt]s/);
			if (fileMatch) {
				return fileMatch[1];
			}
		}
	}

	return "unknown-test";
}

async function singleDiff(
	svelteResult: RenderOutput,
	b: HTMLElement,
	opts: DiffOptions,
	theme: RenderTheme,
) {
	opts = { ...defaultOpts, ...opts };
	const bOrig = b.innerHTML;

	const container = document.createElement("div");
	container.innerHTML = svelteResult.body;

	const aclean = cleanTree(container, opts, opts.ignoreElementFromA);
	const bclean = cleanTree(b, opts, opts.ignoreElementFromB);

	const result = ["Differences: (left: a, right: b) (theme: " + theme + ")"];

	const diffResult = await prettyDiff(
		aclean.innerHTML,
		bclean.innerHTML,
		opts.before || 10,
		opts.after || 10,
	);

	if (!diffResult) {
		if (process.env.VISUAL_TESTS && process.env.VISUAL_TESTS === "true" && !opts.visual?.skip) {
			const testName = captureTestName();
			const screenshots = await testInChrome(svelteResult, bOrig, theme, opts.visual, testName);
			if (screenshots && typeof screenshots === "string") {
				// Register the visual failure for reporting
				visualFailureCollector.addFailure(testName, screenshots, theme);

				result.push("Visual differences found, see screenshots:");
				result.push(`Svelte: ${screenshots}`);
			} else {
				return "";
			}
		} else {
			return "";
		}
	}
	result.push(diffResult);
	return result.join("\n");
}

export async function htmldiff(
	svelteResult: RenderResult,
	reactResult: { [key in RenderTheme]?: HTMLElement },
	opts: DiffOptions,
): Promise<string> {
	for (const theme of Object.keys(svelteResult)) {
		const t = theme as RenderTheme;
		if (!svelteResult[t]) {
			return "Missing output for theme: " + t;
		}
		if (!reactResult[t]) {
			return "Missing output for theme: " + t;
		}
		const result = await singleDiff(svelteResult[t], reactResult[t], opts, t);
		if (result) {
			return result;
		}
	}

	return "";
}

const Node = {
	/** node is an element. */
	ELEMENT_NODE: 1,
	ATTRIBUTE_NODE: 2,
	/** node is a Text node. */
	TEXT_NODE: 3,
	COMMENT_NODE: 8,
};

function cleanTree(el: HTMLElement, opts: DiffOptions, ignoreFunc?: (tag: HTMLElement) => boolean) {
	const traverse = (node: HTMLElement, root?: HTMLElement) => {
		if (node.nodeType === Node.TEXT_NODE) {
			if (opts.ignoreSpaces && node.textContent?.trim && node.textContent.trim() === "") {
				root!.removeChild(node);
				return true;
			}
		} else if (node.nodeType === Node.COMMENT_NODE) {
			if (opts.ignoreComments) {
				root!.removeChild(node);
				return true;
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			if (ignoreFunc) {
				if (ignoreFunc(node as HTMLElement)) {
					root!.removeChild(node);
					return true;
				}
			}

			const attrs: { [key: string]: string } = {};
			for (let i = 0; i < node.attributes.length; i++) {
				const attr = node.attributes[i];
				attrs[attr.name] = attr.value;
			}
			// Sort attributes by attribute name
			Object.keys(attrs).forEach((name) => {
				node.removeAttribute(name);
			});

			Object.keys(attrs)
				.sort()
				.filter((name) => {
					if (opts.compareAttrs) {
						return opts.compareAttrs(node, name);
					}
					return true;
				})
				.forEach((name) => {
					if (name === "class") {
						attrs[name] = attrs[name].split(" ").sort().join(" ");
					}
					node.setAttribute(name, attrs[name]);
				});

			if (opts.alterAttrValue) {
				for (let i = 0; i < node.attributes.length; i++) {
					const attr = node.attributes[i];
					attr.value = opts.alterAttrValue(attr.name, attr.value);
				}
			}

			// Sort styles
			if (node.style.length > 0) {
				const sorted = node.style.cssText
					.split(";")
					.filter((v) => !!v)
					.map((v) => v.trim())
					.sort()
					.join(";");
				node.setAttribute("style", sorted);
			}

			// // sort classes
			// const sorted = Array.from(classes).sort();
			// classes.remove(...sorted);
			// classes.add(...sorted);

			if (opts.ignoreClasses) {
				const classes = node.classList;
				opts.ignoreClasses.forEach((c) => {
					classes.remove(c);
				});
			}
		}

		for (let i = 0; i < node.childNodes.length; i++) {
			if (traverse(node.childNodes[i] as HTMLElement, node)) {
				i--;
			}
		}
	};

	traverse(el);

	return el;
}

const yellow = (input: string) => "\x1b[33m" + input + "\x1b[0m";
const red = (input: string) => "\x1b[31m" + input + "\x1b[0m";

// Detect if we're running in an AI context (GitHub Copilot)
const isAIContext = () => {
	return process.env.GITHUB_COPILOT === "true" || process.env.AI_CONTEXT === "true";
};

async function prettyDiff(a: string, b: string, before: number, after: number) {
	const isAI = isAIContext();

	const lines = [
		isAI
			? `Pretty diff: [SVELTE_ONLY]only in svelte[/SVELTE_ONLY], [REACT_ONLY]only in react[/REACT_ONLY]\n`
			: `Pretty diff: ${red("only in svelte")}, ${yellow("only in react")}\n`,
		"Remember that this diff is a tool, not actualy what's tested.\n",
		`${before} lines before and ${after} lines after a change are shown.\n`,
	];

	const opts: prettier.Options = {
		parser: "html",
		singleQuote: false,
		trailingComma: "all",
		useTabs: true,
		printWidth: 100,
		singleAttributePerLine: true,
		plugins: [prettierHTML],
	};

	const afmt = await prettier.format(a, opts);
	const bfmt = await prettier.format(b, opts);

	let addedOrRemoved = 0;
	Diff.diffWords(afmt, bfmt).forEach((part) => {
		if (part.added) {
			addedOrRemoved++;
			if (isAI) {
				lines.push(`[REACT_ONLY]${part.value}[/REACT_ONLY]`);
			} else {
				lines.push(`${yellow(part.value)}`);
			}
		} else if (part.removed) {
			addedOrRemoved++;
			if (isAI) {
				lines.push(`[SVELTE_ONLY]${part.value}[/SVELTE_ONLY]`);
			} else {
				lines.push(`${red(part.value)}`);
			}
		} else {
			lines.push(part.value);
		}
	});

	if (addedOrRemoved == 0) {
		return "";
	}

	return lines.join("");
}

async function doExpect(
	opts: DiffOptions,
	received: RenderResult,
	comp: ReactComponent,
	props: object | null,
	...children: ReactNode[]
): Promise<{
	pass: boolean;
	message: () => string;
}> {
	const reactComponents: { [key in RenderTheme]?: HTMLElement } = {};
	for (const theme of themes) {
		reactComponents[theme] = renderReact(comp, props, theme, ...children);
	}
	const diff = await htmldiff(received, reactComponents, opts);

	return {
		pass: diff === "",
		message: () => diff,
	};
}

function renderReact(
	comp: ReactComponent,
	props: object | null,
	theme: "dark" | "light",
	...children: ReactNode[]
) {
	const container = document.createElement("div");
	{
		// Hack to remove ugly errors from react
		const error = console.error;
		console.error = () => {};
		container.innerHTML = ReactDOMServer.renderToString(
			React.createElement(Provider, {
				locale: en,
				children: React.createElement(Theme, {
					theme: theme,
					children: React.createElement(comp as FunctionComponent, props, ...children),
				}),
			}),
		);
		console.error = error;
	}

	// Skip any <link> or <style> tags that React may add before the actual component
	let firstChild = container.firstChild as HTMLElement | null;
	while (firstChild && (firstChild.nodeName === "LINK" || firstChild.nodeName === "STYLE")) {
		firstChild = firstChild.nextSibling as HTMLElement | null;
	}

	return firstChild as HTMLElement;
}

export type Options = {
	opts?: DiffOptions;
	props?: object;
	children?: ReactNode[];
};

export async function toMimicReact(received: RenderResult, comp: ReactComponent, opts?: Options) {
	try {
		if (!opts) {
			return await doExpect(defaultOpts, received, comp, null);
		}
		return await doExpect(
			opts.opts || defaultOpts,
			received,
			comp,
			opts.props || null,
			...(opts.children || []),
		);
	} catch (e) {
		console.log(e);
		return {
			pass: false,
			message: () => `Unexpected error: ${e}`,
		};
	}
}

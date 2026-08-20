import * as allSvelte from "$lib";
import * as allSvelteExperimental from "$lib/experimental";
import * as allReact from "@navikt/ds-react";
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const componentStatuses = [
	"supported",
	"experimental",
	"missing",
	"deferred",
	"ignored",
	"deprecated",
	"different-api",
] as const;
const componentRisks = ["low", "medium", "complex"] as const;
const targetExportStatuses = new Set(["supported", "experimental"]);

type ComponentStatus = (typeof componentStatuses)[number];
type ComponentRisk = (typeof componentRisks)[number];
type ComponentPolicy = {
	status: ComponentStatus;
	risk: ComponentRisk;
	reason?: string;
	owner?: string;
	last_reviewed_upstream?: string;
	target_export?: string;
};
type ComponentManifest = {
	components: Record<string, ComponentPolicy>;
};

const manifest = loadComponentManifest();
const reactComponents = Object.keys(allReact).filter(
	(key) => isFirstLetterUppercase(key) && !key.includes("UNSAFE") && !key.includes("Context"),
);
const reactNestedComponents = reactComponents.flatMap((component) => {
	const nested = Object.keys((allReact as never)[component]);
	return nested
		.filter(
			(key) =>
				!key.startsWith("use") &&
				!["render", "$$typeof"].includes(key) &&
				isFirstLetterUppercase(key),
		)
		.map((nestedComponent) => `${component}${nestedComponent}`);
});
const allReactComponents = [...reactComponents, ...reactNestedComponents];
const svelteExports = {
	stable: Object.keys(allSvelte),
	experimental: Object.keys(allSvelteExperimental),
};
const allSvelteExports = [...svelteExports.stable, ...svelteExports.experimental];
const manifestEntries = Object.entries(manifest.components);
const expectedSvelteExports = manifestEntries
	.filter(([, component]) => targetExportStatuses.has(component.status))
	.map(([canonicalName, component]) => component.target_export ?? canonicalName);

describe("which components are implemented", () => {
	it("should include expected components", () => {
		const missing = allReactComponents
			.filter((component) => !(component in manifest.components))
			.sort();
		expect(missing).toEqual([]);
	});

	it("should not include unexpected components", () => {
		const unexpected = allSvelteExports
			.filter((component) => !expectedSvelteExports.includes(component))
			.sort();
		expect(unexpected).toEqual([]);
	});

	it("should export every supported component", () => {
		const missing = expectedSvelteExports
			.filter((component) => !allSvelteExports.includes(component))
			.sort();
		expect(missing).toEqual([]);
	});

	describe("manifest self-audit", () => {
		it("rejects stale manifest entries", () => {
			const stale = manifestEntries
				.map(([canonicalName]) => canonicalName)
				.filter((component) => !allReactComponents.includes(component))
				.sort();
			expect(stale).toEqual([]);
		});

		it("keeps experimental exports in the experimental entry point", () => {
			const misplaced = manifestEntries
				.filter(([, component]) => component.status === "experimental")
				.map(([canonicalName, component]) => component.target_export ?? canonicalName)
				.filter((component) => !svelteExports.experimental.includes(component))
				.sort();
			expect(misplaced).toEqual([]);
		});

		it("keeps stable exports out of the experimental entry point", () => {
			const misplaced = manifestEntries
				.filter(([, component]) => component.status === "supported")
				.map(([canonicalName, component]) => component.target_export ?? canonicalName)
				.filter((component) => !svelteExports.stable.includes(component))
				.sort();
			expect(misplaced).toEqual([]);
		});

		it("validates target-export aliases", () => {
			const aliases = manifestEntries.filter(
				([canonicalName, component]) =>
					component.target_export !== undefined && component.target_export !== canonicalName,
			);
			const invalidStatuses = aliases
				.filter(([, component]) => !targetExportStatuses.has(component.status))
				.map(([canonicalName]) => canonicalName)
				.sort();
			const redundant = manifestEntries
				.filter(([canonicalName, component]) => component.target_export === canonicalName)
				.map(([canonicalName]) => canonicalName)
				.sort();
			const duplicateTargets = expectedSvelteExports
				.filter((target, index) => expectedSvelteExports.indexOf(target) !== index)
				.sort();

			expect(invalidStatuses).toEqual([]);
			expect(redundant).toEqual([]);
			expect(duplicateTargets).toEqual([]);
		});
	});
});

function loadComponentManifest(): ComponentManifest {
	const path = resolve(import.meta.dir, "../../../../ai-maintainer-components.toml");
	const parsed: unknown = Bun.TOML.parse(readFileSync(path, "utf8"));

	if (
		!isRecord(parsed) ||
		!isRecord(parsed.components) ||
		Object.keys(parsed.components).length === 0
	) {
		throw new Error("ai-maintainer-components.toml must define non-empty [components] entries");
	}

	const components: Record<string, ComponentPolicy> = {};
	for (const [canonicalName, value] of Object.entries(parsed.components)) {
		if (!isRecord(value) || !isComponentPolicy(value)) {
			throw new Error(`ai-maintainer-components.toml has an invalid entry for ${canonicalName}`);
		}
		components[canonicalName] = value;
	}

	return { components };
}

function isComponentPolicy(value: Record<string, unknown>): value is ComponentPolicy {
	const allowedFields = new Set([
		"status",
		"risk",
		"reason",
		"owner",
		"last_reviewed_upstream",
		"target_export",
	]);
	if (Object.keys(value).some((key) => !allowedFields.has(key))) {
		return false;
	}
	const status = value.status;
	const risk = value.risk;
	const reason = value.reason;
	const owner = value.owner;
	const lastReviewedUpstream = value.last_reviewed_upstream;
	const targetExport = value.target_export;
	if (
		typeof status !== "string" ||
		!componentStatuses.includes(status as ComponentStatus) ||
		typeof risk !== "string" ||
		!componentRisks.includes(risk as ComponentRisk)
	) {
		return false;
	}
	if (
		(reason !== undefined && typeof reason !== "string") ||
		(owner !== undefined && typeof owner !== "string") ||
		(lastReviewedUpstream !== undefined && typeof lastReviewedUpstream !== "string") ||
		(targetExport !== undefined && typeof targetExport !== "string")
	) {
		return false;
	}
	return !["deferred", "ignored", "different-api"].includes(status) || Boolean(reason?.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFirstLetterUppercase(value: string) {
	return value[0] === value[0].toUpperCase();
}

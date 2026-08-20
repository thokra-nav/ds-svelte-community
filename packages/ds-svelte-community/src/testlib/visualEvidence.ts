import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { RenderTheme } from "./render";

export const visualEvidenceManifestName = "manifest.json";
export const visualEvidenceSchemaVersion = 1;
const maxVisualEvidenceArtifactBytes = 8 * 1024 * 1024;

type ArtifactKind = "screenshot" | "pixel_diff";
type Framework = "svelte" | "react";

export type VisualEvidenceArtifact = {
	relative_path: string;
	kind: ArtifactKind;
	framework?: Framework;
	theme: RenderTheme;
	content_type: "image/png";
	size: number;
	sha256: string;
};

export type VisualEvidenceComparison = {
	id: string;
	theme: RenderTheme;
	svelte_path: string;
	react_path: string;
	match: boolean;
	diff_path?: string;
};

export type VisualEvidenceManifest = {
	schema_version: typeof visualEvidenceSchemaVersion;
	artifacts: VisualEvidenceArtifact[];
	comparisons: VisualEvidenceComparison[];
};

type RecordInput = {
	identity: string;
	theme: RenderTheme;
	svelte: Buffer;
	react: Buffer;
	match: boolean;
	writeDiff?: (path: string) => Promise<void>;
};

export function resolveEvidenceDirectory(value: string, cwd = process.cwd()): string {
	if (!value || value.includes("\0") || isAbsolute(value)) {
		throw new Error("AI_VISUAL_EVIDENCE_DIR must be a non-empty relative path");
	}
	const directory = resolve(cwd, value);
	const rel = relative(cwd, directory);
	if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
		throw new Error("AI_VISUAL_EVIDENCE_DIR must stay inside the test working directory");
	}
	return directory;
}

export function comparisonID(
	identity: string,
	theme: RenderTheme,
	svelte: Buffer,
	react: Buffer,
): string {
	return createHash("sha256")
		.update(identity)
		.update("\0")
		.update(theme)
		.update("\0")
		.update(svelte)
		.update("\0")
		.update(react)
		.digest("hex")
		.slice(0, 32);
}

export function serializeManifest(manifest: VisualEvidenceManifest): string {
	const artifacts = [...manifest.artifacts].sort((a, b) =>
		a.relative_path.localeCompare(b.relative_path),
	);
	const comparisons = [...manifest.comparisons].sort((a, b) => a.id.localeCompare(b.id));
	return JSON.stringify(
		{
			schema_version: visualEvidenceSchemaVersion,
			artifacts,
			comparisons,
		},
		null,
		"\t",
	).concat("\n");
}

export class VisualEvidenceWriter {
	constructor(private readonly directory: string) {}

	async record(input: RecordInput): Promise<{ diffPath?: string }> {
		if (
			input.svelte.length === 0 ||
			input.react.length === 0 ||
			input.svelte.length > maxVisualEvidenceArtifactBytes ||
			input.react.length > maxVisualEvidenceArtifactBytes
		) {
			throw new Error("visual evidence screenshot exceeds bounded PNG size");
		}
		const id = comparisonID(input.identity, input.theme, input.svelte, input.react);
		const sveltePath = `screenshots/${id}-svelte.png`;
		const reactPath = `screenshots/${id}-react.png`;
		const svelteAbsolute = this.resolveArtifactPath(sveltePath);
		const reactAbsolute = this.resolveArtifactPath(reactPath);

		await Promise.all([
			writeAtomically(svelteAbsolute, input.svelte),
			writeAtomically(reactAbsolute, input.react),
		]);

		let diffPath: string | undefined;
		if (!input.match) {
			if (!input.writeDiff) {
				throw new Error("visual mismatch did not provide a pixel diff");
			}
			const diffRelative = `diffs/${id}-pixel-diff.png`;
			diffPath = this.resolveArtifactPath(diffRelative);
			await mkdir(dirname(diffPath), { recursive: true, mode: 0o700 });
			const temporary = diffPath.replace(/\.png$/, `.${process.pid}.new.png`);
			await input.writeDiff(temporary);
			const info = await stat(temporary);
			if (!info.isFile() || info.size <= 0 || info.size > maxVisualEvidenceArtifactBytes) {
				await unlink(temporary).catch(() => undefined);
				throw new Error("visual evidence pixel diff exceeds bounded PNG size");
			}
			await rename(temporary, diffPath);
		}

		const artifacts = await Promise.all([
			describeArtifact(this.directory, sveltePath, "screenshot", input.theme, "svelte"),
			describeArtifact(this.directory, reactPath, "screenshot", input.theme, "react"),
			...(diffPath
				? [
						describeArtifact(
							this.directory,
							this.relativeArtifactPath(diffPath),
							"pixel_diff",
							input.theme,
						),
					]
				: []),
		]);
		const comparison: VisualEvidenceComparison = {
			id,
			theme: input.theme,
			svelte_path: sveltePath,
			react_path: reactPath,
			match: input.match,
		};
		if (diffPath) {
			comparison.diff_path = this.relativeArtifactPath(diffPath);
		}

		await withManifestLock(this.directory, async () => {
			const current = await readManifest(join(this.directory, visualEvidenceManifestName));
			const byPath = new Map(
				current.artifacts.map((artifact) => [artifact.relative_path, artifact]),
			);
			for (const artifact of artifacts) {
				byPath.set(artifact.relative_path, artifact);
			}
			const byID = new Map(current.comparisons.map((value) => [value.id, value]));
			byID.set(comparison.id, comparison);
			await writeAtomically(
				join(this.directory, visualEvidenceManifestName),
				Buffer.from(
					serializeManifest({
						schema_version: visualEvidenceSchemaVersion,
						artifacts: [...byPath.values()],
						comparisons: [...byID.values()],
					}),
				),
			);
		});
		return { diffPath };
	}

	private resolveArtifactPath(relativePath: string): string {
		if (!/^(screenshots|diffs)\/[0-9a-f]{32}-(svelte|react|pixel-diff)\.png$/.test(relativePath)) {
			throw new Error("visual evidence artifact name is invalid");
		}
		return join(this.directory, relativePath);
	}

	private relativeArtifactPath(path: string): string {
		const result = relative(this.directory, path);
		if (!result || result === ".." || result.startsWith(`..${sep}`) || isAbsolute(result)) {
			throw new Error("visual evidence artifact escaped its configured directory");
		}
		return result.split(sep).join("/");
	}
}

export function configuredVisualEvidenceWriter(): VisualEvidenceWriter | undefined {
	const value = process.env.AI_VISUAL_EVIDENCE_DIR;
	if (!value) {
		return undefined;
	}
	return new VisualEvidenceWriter(resolveEvidenceDirectory(value));
}

async function describeArtifact(
	root: string,
	relativePath: string,
	kind: ArtifactKind,
	theme: RenderTheme,
	framework?: Framework,
): Promise<VisualEvidenceArtifact> {
	const fullPath = join(root, relativePath);
	const [data, info] = await Promise.all([readFile(fullPath), stat(fullPath)]);
	if (!info.isFile() || data.length === 0) {
		throw new Error(`visual evidence artifact ${relativePath} was not a non-empty file`);
	}
	if (data.length > maxVisualEvidenceArtifactBytes) {
		throw new Error(`visual evidence artifact ${relativePath} exceeds bounded PNG size`);
	}
	return {
		relative_path: relativePath,
		kind,
		framework,
		theme,
		content_type: "image/png",
		size: data.length,
		sha256: createHash("sha256").update(data).digest("hex"),
	};
}

async function readManifest(path: string): Promise<VisualEvidenceManifest> {
	try {
		const raw = await readFile(path, "utf8");
		const parsed: unknown = JSON.parse(raw);
		if (
			!isRecord(parsed) ||
			parsed.schema_version !== visualEvidenceSchemaVersion ||
			!Array.isArray(parsed.artifacts) ||
			!Array.isArray(parsed.comparisons)
		) {
			throw new Error("manifest schema is invalid");
		}
		return parsed as VisualEvidenceManifest;
	} catch (error) {
		if (isNotFound(error)) {
			return { schema_version: visualEvidenceSchemaVersion, artifacts: [], comparisons: [] };
		}
		throw new Error(`cannot update visual evidence manifest: ${error}`, { cause: error });
	}
}

async function withManifestLock(directory: string, fn: () => Promise<void>) {
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const lockPath = join(directory, ".manifest.lock");
	let handle: Awaited<ReturnType<typeof open>> | undefined;
	for (let attempt = 0; attempt < 200; attempt++) {
		try {
			handle = await open(lockPath, "wx", 0o600);
			break;
		} catch (error) {
			if (!isAlreadyExists(error)) {
				throw error;
			}
			await removeStaleLock(lockPath);
			await Bun.sleep(25);
		}
	}
	if (!handle) {
		throw new Error("timed out waiting to update visual evidence manifest");
	}
	try {
		await fn();
	} finally {
		await handle.close();
		await unlink(lockPath).catch(() => undefined);
	}
}

async function removeStaleLock(path: string) {
	try {
		const info = await lstat(path);
		if (!info.isFile() || Date.now() - info.mtimeMs > 60_000) {
			await unlink(path);
		}
	} catch (error) {
		if (!isNotFound(error)) {
			throw error;
		}
	}
}

async function writeAtomically(path: string, contents: Buffer) {
	await mkdir(dirname(path), { recursive: true, mode: 0o700 });
	const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.new`);
	await writeFile(temporary, contents, { mode: 0o600 });
	await rename(temporary, path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotFound(error: unknown): boolean {
	return isRecord(error) && error.code === "ENOENT";
}

function isAlreadyExists(error: unknown): boolean {
	return isRecord(error) && error.code === "EEXIST";
}

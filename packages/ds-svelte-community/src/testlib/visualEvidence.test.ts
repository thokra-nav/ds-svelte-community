import { describe, expect, it } from "bun:test";
import {
	comparisonID,
	resolveEvidenceDirectory,
	serializeManifest,
	visualEvidenceSchemaVersion,
} from "./visualEvidence";

describe("visual evidence manifest", () => {
	it("uses content-addressed safe artifact identifiers", () => {
		const first = comparisonID("Button", "light", Buffer.from("svelte"), Buffer.from("react"));
		const second = comparisonID("Button", "light", Buffer.from("svelte"), Buffer.from("react"));

		expect(first).toMatch(/^[0-9a-f]{32}$/);
		expect(second).toBe(first);
	});

	it("serializes a stable versioned manifest", () => {
		const manifest = serializeManifest({
			schema_version: visualEvidenceSchemaVersion,
			artifacts: [
				{
					relative_path: "screenshots/b-svelte.png",
					kind: "screenshot",
					framework: "svelte",
					theme: "light",
					content_type: "image/png",
					size: 1,
					sha256: "b",
				},
				{
					relative_path: "screenshots/a-react.png",
					kind: "screenshot",
					framework: "react",
					theme: "light",
					content_type: "image/png",
					size: 1,
					sha256: "a",
				},
			],
			comparisons: [
				{
					id: "b",
					theme: "light",
					svelte_path: "screenshots/b-svelte.png",
					react_path: "screenshots/a-react.png",
					match: true,
				},
				{
					id: "a",
					theme: "dark",
					svelte_path: "screenshots/b-svelte.png",
					react_path: "screenshots/a-react.png",
					match: true,
				},
			],
		});

		expect(manifest).toContain('"schema_version": 1');
		expect(manifest.indexOf("a-react.png")).toBeLessThan(manifest.indexOf("b-svelte.png"));
		expect(manifest.indexOf('"id": "a"')).toBeLessThan(manifest.indexOf('"id": "b"'));
	});

	it("keeps configured evidence inside the test working directory", () => {
		expect(resolveEvidenceDirectory(".ai-maintainer/visual-evidence", "/workspace/package")).toBe(
			"/workspace/package/.ai-maintainer/visual-evidence",
		);
		expect(() => resolveEvidenceDirectory("../evidence", "/workspace/package")).toThrow(
			"must stay inside",
		);
		expect(() => resolveEvidenceDirectory("/workspace/evidence", "/workspace/package")).toThrow(
			"relative path",
		);
	});
});

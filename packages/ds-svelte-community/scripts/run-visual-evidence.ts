import { rm } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const value = process.env.AI_VISUAL_EVIDENCE_DIR;
if (!value || value.includes("\0") || isAbsolute(value)) {
	throw new Error("test:visual-evidence requires AI_VISUAL_EVIDENCE_DIR to be a relative path");
}
const directory = resolve(process.cwd(), value);
const rel = relative(process.cwd(), directory);
if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
	throw new Error("AI_VISUAL_EVIDENCE_DIR must stay inside the package directory");
}

await rm(directory, { recursive: true, force: true });
const test = Bun.spawn(["bun", "run", "test:unit", ...process.argv.slice(2)], {
	cwd: process.cwd(),
	env: process.env,
	stdout: "inherit",
	stderr: "inherit",
});
process.exit(await test.exited);

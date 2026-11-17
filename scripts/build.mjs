import { build } from "esbuild";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const publishDir = path.join(root, "dist");
const excluded = new Set([
  ".git", ".github", ".netlify", ".pnpm-store", ".vscode", "node_modules",
  "dist", "netlify", "scripts", "src", "package.json", "package-lock.json",
  "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "netlify.toml",
  "README.md", "AGENTS.md",
]);

await rm(publishDir, { recursive: true, force: true });
await mkdir(publishDir, { recursive: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (excluded.has(entry.name) || entry.name.startsWith(".env")) continue;
  await cp(path.join(root, entry.name), path.join(publishDir, entry.name), { recursive: true });
}
await mkdir(path.join(publishDir, "assets"), { recursive: true });
await build({
  entryPoints: [path.join(root, "src", "toolshare-live.js")],
  bundle: true,
  format: "iife",
  target: "es2022",
  outfile: path.join(publishDir, "assets", "toolshare-live.js"),
});


// Stage the deployable static site into ./dist for a clean Pages deploy.
// Copies exactly the tracked site files (never node_modules, docs, or build
// tooling). functions/ is intentionally excluded here: `wrangler pages deploy`
// compiles it from the repo root, separately from this static asset dir.
import { execSync } from 'node:child_process';
import { mkdirSync, copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';

const OUT = 'dist';
const EXCLUDE_EXACT = new Set([
  'package.json', 'package-lock.json', 'tsconfig.json', '.gitignore',
  'build.mjs', 'wrangler.jsonc', 'wrangler.toml', '.assetsignore',
  // The Worker entry (wrangler.jsonc `main`) is bundled from the repo root by
  // wrangler; it must NOT be copied into the static asset dir.
  'worker.ts',
  // Agent instruction files (shared with Codex/Claude Code). They are tracked,
  // but the repo root is served publicly, so they must never reach dist/ or
  // stockup.au. Also enforced by the generated dist/.assetsignore below.
  'AGENTS.md', 'CLAUDE.md',
]);
const EXCLUDE_PREFIX = ['functions/', 'docs/'];

rmSync(OUT, { recursive: true, force: true });
const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
let n = 0;
for (const f of files) {
  if (EXCLUDE_EXACT.has(f)) continue;
  if (basename(f) === '.gitignore') continue;
  if (EXCLUDE_PREFIX.some((p) => f.startsWith(p))) continue;
  const dest = join(OUT, f);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(f, dest);
  n++;
}
// Independent second layer against the public-root leak risk: tell Cloudflare's
// asset uploader to skip the agent instruction files even if one ever lands in
// dist/. `.assetsignore` lives in the assets directory and is not itself served.
writeFileSync(join(OUT, '.assetsignore'), 'AGENTS.md\nCLAUDE.md\n');

console.log(`Staged ${n} files into ${OUT}/ (+ .assetsignore guarding instruction files)`);

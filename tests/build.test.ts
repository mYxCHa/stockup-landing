import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { PUBLIC_FILES } from '../build.mjs';

function deployedFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? deployedFiles(path) : [relative('dist', path)];
  });
}

test('build output contains exactly the public manifest and its safety file', () => {
  assert.deepEqual(
    deployedFiles('dist').sort(),
    [...PUBLIC_FILES, '.assetsignore'].sort(),
  );
  const ignored = readFileSync('dist/.assetsignore', 'utf8');
  assert.match(ignored, /AGENTS\.md/);
  assert.match(ignored, /CLAUDE\.md/);
  assert.doesNotMatch(deployedFiles('dist').join('\n'), /(?:AGENTS|CLAUDE)\.md|docs\/|tests\/|package\.json|build\.mjs|worker\.ts/);
});

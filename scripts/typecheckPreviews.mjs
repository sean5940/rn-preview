/**
 * Type checks every declaration file.
 *
 * The editor only shows the files you have open. A declaration with a misspelled token name shows
 * no sign of it on screen (the colour you named simply does not apply and the default is drawn), so
 * you do not find out until you open it.
 *
 * The declaration directory's location changes with `PREVIEW_DIR`, so the path is resolved here and
 * passed through.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildStandaloneTsconfig } from '../src/editorPaths.ts';

// The check resolves paths from the MOBILE_APP_PATH in effect when it is called, while leaving the
// shared editor file (tsconfig.paths.json) alone. The temporary tsconfig is absolute-path based, so
// checking several worktrees side by side does not tread on any of them.
const tempDir = mkdtempSync(join(tmpdir(), 'rn-preview-typecheck-'));
const tsconfig = join(tempDir, 'tsconfig.json');
writeFileSync(tsconfig, `${JSON.stringify(buildStandaloneTsconfig(), null, 4)}\n`);

const { status, stdout } = spawnSync('npx', ['tsc', '-p', tsconfig, '--noEmit'], { encoding: 'utf-8' });
rmSync(tempDir, { recursive: true, force: true });

// The target project's sources were written against their own tsconfig, so errors remain under this
// configuration. Declaration files are the only thing we can fix, so only those are reported.
const lines = (stdout ?? '').split('\n').filter((line) => line.includes('.preview.tsx('));

if (lines.length === 0) {
    console.log('No type errors in the declaration files');
    process.exit(0);
}

console.log(lines.join('\n'));
process.exit(status ?? 1);

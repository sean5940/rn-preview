/**
 * Creates the paths file that `tsconfig.json` extends, empty, if it does not exist.
 *
 * That file is derived from the target project's tsconfig, so its contents differ per machine and
 * it is excluded from version control. A fresh clone does not have it, and without it tsc cannot
 * find the extends target and type checking stops entirely. Starting the dev server once rewrites
 * it with real contents.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'tsconfig.paths.json');

if (!existsSync(file)) {
    writeFileSync(file, `${JSON.stringify({ compilerOptions: { baseUrl: '.', paths: {} } }, null, 4)}\n`);
    console.log(`Created an empty paths file: ${file}`);
}

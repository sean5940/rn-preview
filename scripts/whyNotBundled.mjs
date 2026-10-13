/**
 * Shows which module is not being bundled, and why.
 *
 * A blank preview usually has its cause in the resolution layer. The browser console shows only the
 * first error, whereas this script unfolds every error rollup collected along with the file paths.
 *
 *   node scripts/whyNotBundled.mjs '@ui/components/badge/Badge'
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';

const target = process.argv[2];
if (target === undefined) throw new Error('usage: node scripts/whyNotBundled.mjs <import path>');

const dir = mkdtempSync(join(tmpdir(), 'rn-preview-probe-'));
const entry = join(dir, 'entry.tsx');
writeFileSync(entry, `import * as mod from '${target}';\nconsole.log(mod);\n`);

try {
    await build({
        configFile: 'vite.config.ts',
        logLevel: 'silent',
        build: { outDir: dir, write: false, rollupOptions: { input: entry } },
    });
    console.log('OK', target);
} catch (error) {
    console.log('FAIL', target);
    const list = Array.isArray(error?.errors) ? error.errors : [error];
    for (const item of list) {
        const where = item?.id ?? item?.loc?.file ?? item?.location?.file ?? '(no location)';
        const text = (item?.message ?? item?.text ?? String(item)).split('\n')[0];
        console.log(`${item?.code ?? item?.kind ?? 'ERROR'}\t${where}\t${text}`);
    }
    process.exitCode = 1;
}

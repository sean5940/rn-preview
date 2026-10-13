/**
 * Creates a preview declaration draft corresponding to a source file.
 *
 *   node --experimental-strip-types scripts/generatePreview.ts <source path> [--force] [--print-path]
 *
 * They are linked by path convention. Recording "what it draws" inside the declaration puts the
 * same fact in two places, where it drifts. The editor extension calls this script too, so the path
 * calculation lives in one place.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { analyzeComponent } from '../src/analyzeComponent.ts';
import { previewConfig } from '../src/previewConfig.ts';
import { toPreviewPath } from '../src/previewPath.ts';
import { renderPreview } from '../src/renderPreview.ts';
import { format, resolveConfig } from 'prettier';

/**
 * Formats the draft to match the style of its directory.
 *
 * A draft is a file that people and agents go on to edit. Nested mock values make the generated
 * lines run long and hard to read, and the first edit then shows the whole formatting difference as
 * a diff.
 */
const formatDraft = async (path: string, source: string): Promise<string> =>
    format(source, { ...(await resolveConfig(path)), filepath: path });

const args = process.argv.slice(2);
const sourceArg = args.find((arg) => !arg.startsWith('--'));
const force = args.includes('--force');
const printPathOnly = args.includes('--print-path');

if (sourceArg === undefined) {
    console.error('usage: generatePreview.ts <source path> [--force] [--print-path]');
    process.exit(2);
}

const sourcePath = resolve(sourceArg);
const previewPath = toPreviewPath(sourcePath);

if (previewPath === undefined) {
    console.error(
        `Not a source file under sourceRoot (${previewConfig.sourceRoot}): ${sourcePath}\n` +
            'Set sourceRoot in rn-preview.config.json beside the declarations to the directory your components live in.',
    );
    process.exit(2);
}

if (printPathOnly) {
    console.log(previewPath);
    process.exit(0);
}

if (existsSync(previewPath) && !force) {
    console.log(previewPath);
    process.exit(0);
}

const analysis = analyzeComponent(sourcePath);
if (analysis === undefined) {
    console.error(`Could not find an exported component: ${sourcePath}`);
    process.exit(1);
}

mkdirSync(dirname(previewPath), { recursive: true });
writeFileSync(previewPath, await formatDraft(previewPath, renderPreview(analysis)));

console.log(previewPath);

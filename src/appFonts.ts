import { existsSync, readdirSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { previewConfig } from './previewConfig.ts';

const FONT_EXTENSIONS = ['.ttf', '.otf'];

/**
 * Turns absolute font file paths into `@font-face` rules.
 *
 * Family names are taken from filenames. The name RN passes to `fontFamily` is the font's
 * PostScript name, which in principle can differ from the filename, but matching the two when
 * linking is the convention. Where they diverge, that one font simply renders with the fallback as
 * it does now, so nothing gets worse.
 *
 * `font-display` is `block`. Previews get captured and compared against designs, and if the
 * fallback is drawn once before the font arrives, **a picture taken at that moment records a weight
 * different from the device.**
 */
export const toFontFaceCss = (paths: string[]): string =>
    paths
        .map((path) => {
            const family = basename(path, extname(path));
            return `@font-face { font-family: '${family}'; src: url('/@fs${encodeURI(path)}'); font-display: block; }`;
        })
        .join('\n');

const findFontFiles = (): string[] =>
    previewConfig.fontDirs.flatMap((directory) => {
        const absolute = resolve(previewConfig.projectRoot, directory);
        if (!existsSync(absolute)) return [];

        return readdirSync(absolute)
            .filter((name) => FONT_EXTENSIONS.includes(extname(name).toLowerCase()))
            .sort()
            .map((name) => resolve(absolute, name));
    });

/**
 * Serves the fonts the app links to the browser as well.
 *
 * Apps commonly select weight by family name (something like `Pretendard-SemiBold`) rather than
 * `fontWeight`. Without serving the fonts, **the weight distinction disappears entirely.** Places
 * that bold only part of a string render uniformly, so emphasis that exists in the implementation
 * looks absent in the preview.
 *
 * Glyph widths become the fallback's too, so line breaks and clipping diverge from the device.
 *
 * Runs on the dev server only. `/@fs` is a dev-only route by which Vite serves files outside the
 * project, and this tool is used through `npm run dev` alone.
 */
export const appFonts = (): Plugin => ({
    name: 'app-fonts',
    apply: 'serve',
    transformIndexHtml: () => {
        const css = toFontFaceCss(findFontFiles());
        if (css === '') return [];

        return [{ tag: 'style', children: css, injectTo: 'head' }];
    },
});

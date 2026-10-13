/**
 * Renders declaration files in a headless browser and saves them as PNGs.
 *
 *   npm run capture                                     # every declaration
 *   npm run capture -- --name screens/account/components/SubscriptionRefundListItem
 *   npm run capture -- --file /abs/path/X.preview.tsx --out ./captures
 *   MOBILE_APP_PATH=<worktree> npm run capture -- --name ui/Badge
 *
 * This is the capture step of design self-QA. The point is to put the render side by side with a
 * design render and compare, so the whole embed view including the variant and state grid is shot
 * (cell labels stay in the image, so you can tell which variant is which from the picture alone).
 *
 * The browser is playwright-core plus the system Chrome (channel). No separate browser binary is
 * downloaded, and it starts with a temporary profile unrelated to the user's running Chrome
 * profile. That route avoids the profile-lock problem.
 *
 * The server is either one already up via `--url`, or a dev server started here and shut down at
 * the end. MOBILE_APP_PATH is passed straight through to the child process, so worktree code is
 * captured the same way.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { CAPTURE_META_KEY, CAPTURING_FLAG } from '../src/captureMeta.ts';
import {
    describePressMismatch,
    INVISIBLE_TEXT_PATTERN,
    isCellOfState,
    normalizePressText,
} from '../src/captureInteractions.ts';
import { CELL_LABEL_PATTERN } from '../src/cellLabel.ts';
import { findPreviewFiles, toPreviewName } from '../src/previewRoot.ts';

const LOADING_TEXT = 'Loading';
/** Must match the wording in `App.tsx`. Kept specific so a deliberately mocked error does not match it. */
const FAILURE_TEXT = 'Failed to load preview declaration';

const parseArgs = (argv) => {
    const args = { out: './captures', files: [], names: [], url: undefined, timeoutMs: 30000, geometry: false };
    for (let i = 0; i < argv.length; i++) {
        const key = argv[i];
        if (key === '--out') args.out = argv[++i];
        else if (key === '--file') args.files.push(argv[++i]);
        else if (key === '--name') args.names.push(argv[++i]);
        else if (key === '--url') args.url = argv[++i];
        else if (key === '--timeout') args.timeoutMs = Number(argv[++i]);
        else if (key === '--geometry') args.geometry = true;
    }
    return args;
};

/**
 * Extracts per-variant-cell render geometry from the grid. Runs inside the browser.
 *
 * Saved alongside the PNG, this is the input for a machine comparison against a design layout
 * sidecar (pos, text, bg, border). Cells are found by their label text ("{variant} · {width}") and
 * coordinates are emitted relative to the cell root. Declare the width to match the design frame
 * (px = pt) and they compare directly with no coordinate conversion.
 */
/**
 * Puts CSS animations in a fixed state before shooting. Runs inside the browser.
 *
 * A spinner (react-native-web's ActivityIndicator) rotates through an infinite CSS animation. The
 * page clock does not drive CSS, so the angle at the moment of the shot varied from run to run, and
 * with it the bounding box of the rotated graphic (41.7 against 40.7 on consecutive runs). Infinite
 * animations go back to their unanimated state and finite ones jump to their end, which is the rule
 * Playwright's `animations: 'disabled'` uses; here it covers the geometry as well as the picture.
 */
const settleAnimations = () => {
    for (const animation of document.getAnimations()) {
        try {
            if (animation.effect?.getComputedTiming().iterations === Infinity) animation.cancel();
            else animation.finish();
        } catch {
            // An animation that cannot finish (zero playback rate) is left as it is.
        }
    }
};

const extractGeometry = (cellLabelPattern) => {
    const isLeafText = (el) => el.children.length === 0 && (el.textContent ?? '').trim().length > 0;
    // Device chrome (status bar, home indicator) is drawn by the device, so it is not part of the
    // implementation render. The design sidecar has those nodes, but only what the screen drew is
    // being compared, so they are excluded from the geometry.
    const isChrome = (node) =>
        (node.nodeType === 1 ? node : node.parentElement)?.closest('[data-testid="preview-chrome"]') != null;

    const labels = [...document.querySelectorAll('div')].filter(
        (el) => isLeafText(el) && new RegExp(cellLabelPattern).test(el.textContent.trim()),
    );

    const cells = [];
    for (const label of labels) {
        const wrapper = label.parentElement;
        if (!wrapper) continue;
        const content = [...wrapper.children].find((c) => c !== label);
        if (!content) continue;

        const rootRect = content.getBoundingClientRect();
        const rel = (r) => ({
            x: Math.round((r.x - rootRect.x) * 10) / 10,
            y: Math.round((r.y - rootRect.y) * 10) / 10,
            w: Math.round(r.width * 10) / 10,
            h: Math.round(r.height * 10) / 10,
        });

        const texts = [];
        const boxes = [];
        const graphics = [];
        // Text is measured with a Range per **text node**, not per element. rn-web leaves the
        // trailing fragment of a nested typography component as a bare text node rather than
        // wrapping it in an element, so collecting only element leaves drops that fragment entirely.
        const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const value = (node.nodeValue ?? '').trim();
            if (!value) continue;
            if (node.parentElement?.closest('svg')) continue;
            if (isChrome(node)) continue;
            const range = document.createRange();
            // Measures **the range excluding whitespace**, not the whole node. A nested typography
            // fragment usually starts with a space; that space stays at the end of the previous
            // line while the characters wrap to the next one. Measuring the whole node reports one
            // line of text as spanning two, which makes the line-count predicate report falsely.
            const raw = node.nodeValue ?? '';
            range.setStart(node, raw.length - raw.trimStart().length);
            range.setEnd(node, raw.trimEnd().length);
            const lineRects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0);
            if (lineRects.length === 0) continue;
            const left = Math.min(...lineRects.map((r) => r.x));
            const top = Math.min(...lineRects.map((r) => r.y));
            const rect = {
                x: left,
                y: top,
                width: Math.max(...lineRects.map((r) => r.x + r.width)) - left,
                height: Math.max(...lineRects.map((r) => r.y + r.height)) - top,
            };
            texts.push({ text: value.replace(/\s+/g, ' '), ...rel(rect), lines: lineRects.length });
        }
        // A closed modal or sheet often stays mounted as a full-screen backdrop faded to opacity 0.
        // Its computed background is still opaque black, so collecting it would make the
        // background predicate read the screen as black. Only what is actually painted is kept.
        const paintedOpacity = new Map();
        const opacityOf = (el) => {
            if (el === content.parentElement || el === null) return 1;
            const cached = paintedOpacity.get(el);
            if (cached !== undefined) return cached;
            const style = getComputedStyle(el);
            const value = style.visibility === 'hidden' ? 0 : parseFloat(style.opacity) * opacityOf(el.parentElement);
            paintedOpacity.set(el, value);
            return value;
        };
        const isInvisible = (el) => opacityOf(el) < 0.05;
        for (const el of content.querySelectorAll('*')) {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            if (isChrome(el)) continue;
            if (isInvisible(el)) continue;
            const tag = el.tagName.toLowerCase();
            if (tag === 'svg' || tag === 'img') {
                graphics.push(rel(rect));
                continue;
            }
            if (el.closest('svg')) continue;
            const style = getComputedStyle(el);
            const hasBg = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
            const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some(
                (side) => parseFloat(style[`border${side}Width`]) > 0,
            );
            if (hasBg || hasBorder) {
                const box = { ...rel(rect) };
                if (hasBg) box.bg = style.backgroundColor;
                if (hasBorder) box.border = true;
                boxes.push(box);
            }
        }

        // Cells are `overflow: hidden`, so anything past the device height is invisible in the
        // capture. A bottom button pushed off screen at a large text scale is the typical case, and
        // from the picture alone you cannot tell it was clipped. How far it overflowed and which
        // strings went outside are recorded as numbers so the judgement needs no eyeballing.
        const cellHeight = Math.round(rootRect.height * 10) / 10;
        const bottoms = [...texts, ...boxes, ...graphics].map((r) => r.y + r.h);
        const clipped =
            bottoms.length === 0 ? 0 : Math.max(0, Math.round((Math.max(...bottoms) - cellHeight) * 10) / 10);
        const clippedTexts = texts.filter((t) => t.y >= cellHeight).map((t) => t.text);

        cells.push({
            label: label.textContent.trim(),
            clipped,
            clippedTexts,
            w: Math.round(rootRect.width * 10) / 10,
            h: Math.round(rootRect.height * 10) / 10,
            texts,
            boxes,
            graphics,
        });
    }
    return cells;
};

/** Narrows the declaration list to the capture targets. Without --file/--name it is all of them. */
const resolveTargets = (args) => {
    const all = findPreviewFiles().map((path) => ({ path, name: toPreviewName(path) }));
    if (args.files.length === 0 && args.names.length === 0) return all;

    const wantedPaths = new Set(args.files.map((f) => resolve(f)));
    const wantedNames = new Set(args.names);
    const targets = all.filter((t) => wantedPaths.has(resolve(t.path)) || wantedNames.has(t.name));

    const missing = [...wantedNames].filter((n) => !all.some((t) => t.name === n));
    for (const name of missing) {
        process.stderr.write(`warning: declaration not found: ${name}\n`);
    }
    return targets;
};

const isServerUp = async (base) => {
    try {
        const res = await fetch(base, { signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch {
        return false;
    }
};

/**
 * Starts the dev server as a child and finds out its address. vite may move the port, so it is read
 * from stdout.
 */
const startDevServer = async (timeoutMs) => {
    const child = spawn('npm', ['run', 'dev'], {
        cwd: resolve(new URL('..', import.meta.url).pathname),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    const url = await new Promise((resolvePromise, rejectPromise) => {
        const timer = setTimeout(
            () => rejectPromise(new Error('The dev server did not come up within the time limit.')),
            timeoutMs,
        );
        let buffer = '';
        child.stdout.on('data', (chunk) => {
            buffer += String(chunk);
            const m = buffer.match(/Local:\s+(http:\/\/[^\s]+)/);
            if (m) {
                clearTimeout(timer);
                resolvePromise(m[1].replace(/\/$/, ''));
            }
        });
        child.on('exit', (code) => {
            clearTimeout(timer);
            rejectPromise(new Error(`The dev server exited before starting (exit ${code}).`));
        });
    });

    // Even right after vite prints the address, the first response takes a moment.
    for (let i = 0; i < 20 && !(await isServerUp(url)); i++) {
        await new Promise((r) => setTimeout(r, 500));
    }
    return { child, url };
};

const capture = async () => {
    const args = parseArgs(process.argv.slice(2));
    const targets = resolveTargets(args);
    if (targets.length === 0) {
        process.stderr.write('There is no declaration to capture.\n');
        process.exit(1);
    }

    let server = null;
    let base = args.url?.replace(/\/$/, '');
    if (base === undefined || !(await isServerUp(base))) {
        if (base !== undefined) {
            process.stderr.write(`No response from --url ${base}, starting a dev server instead.\n`);
        }
        server = await startDevServer(args.timeoutMs);
        base = server.url;
    }

    mkdirSync(args.out, { recursive: true });

    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    // Cells press `interactions` themselves when viewed in a browser. Here the capture clicks them for
    // real, so the cells are told to stay still before any page script runs.
    const markCapturing = (onPage) => onPage.addInitScript((flag) => (window[flag] = true), CAPTURING_FLAG);
    await markCapturing(page);

    const results = [];
    try {
        /** Loads a declaration and reports whether it rendered. A broken one is recorded and skipped. */
        const open = async (target, onPage) => {
            const pageUrl = `${base}/?embed=1&file=${encodeURIComponent(target.path)}`;
            await onPage.goto(pageUrl, { waitUntil: 'networkidle', timeout: args.timeoutMs });
            await onPage.waitForFunction((loading) => !document.body.innerText.includes(loading), LOADING_TEXT, {
                timeout: args.timeoutMs,
            });
            const failed = await onPage.evaluate((failure) => document.body.innerText.includes(failure), FAILURE_TEXT);
            if (!failed) return true;
            // Keep the error message verbatim. "It failed" alone cannot distinguish a module missing
            // on the branch from a broken declaration, which sends you back to the browser every time.
            const reason = await onPage.evaluate(() => document.body.innerText.slice(0, 500));
            results.push({ name: target.name, status: 'failed', detail: reason.replaceAll('\n', ' ⏎ ') });
            return false;
        };

        /**
         * Presses the declared texts inside each cell of the named states, before shooting.
         *
         * Each press is a real pointer click on the one element in that cell with exactly that text.
         * Zero or several matches throw, so the capture fails loudly instead of shooting a state that
         * was never reached. After each click the animations settle the way a shot does, so the next
         * press (and the geometry) sees the finished state.
         */
        const runInteractions = async (onPage, interactions) => {
            if (interactions === undefined) return;
            // Cells are tagged in the page so Playwright can scope a locator to one of them.
            const cells = await onPage.evaluate((pattern) => {
                const regex = new RegExp(pattern);
                const labels = [...document.querySelectorAll('div')].filter(
                    (el) => el.children.length === 0 && regex.test((el.textContent ?? '').trim()),
                );
                return labels.flatMap((label, index) => {
                    const content = [...(label.parentElement?.children ?? [])].find((c) => c !== label);
                    if (!content) return [];
                    content.setAttribute('data-rn-preview-cell', String(index));
                    return [{ id: index, label: (label.textContent ?? '').trim() }];
                });
            }, CELL_LABEL_PATTERN.source);

            for (const [stateName, texts] of Object.entries(interactions)) {
                const targets = cells.filter((c) => isCellOfState(c.label, stateName));
                // No matching cell would leave every press unperformed while the shot still succeeds.
                if (targets.length === 0) {
                    throw new Error(
                        `interactions."${stateName}": no cell of this state was found. labels: ${cells.map((c) => c.label).join(', ')}`,
                    );
                }
                for (const cell of targets) {
                    for (const text of texts) {
                        // The innermost elements whose drawn text equals the wanted text are
                        // marked. An outer wrapper of the same text does not count as a second match.
                        const count = await onPage.evaluate(
                            ({ id, wanted, noise }) => {
                                const clean = (value) =>
                                    value.replace(new RegExp(noise, 'g'), '').replace(/\s+/g, ' ').trim();
                                const cell = document.querySelector(`[data-rn-preview-cell="${id}"]`);
                                for (const old of document.querySelectorAll('[data-rn-preview-press]')) {
                                    old.removeAttribute('data-rn-preview-press');
                                }
                                const matches = [...(cell?.querySelectorAll('*') ?? [])].filter(
                                    (el) =>
                                        clean(el.textContent ?? '') === wanted &&
                                        ![...el.children].some((child) => clean(child.textContent ?? '') === wanted),
                                );
                                if (matches.length === 1) matches[0].setAttribute('data-rn-preview-press', '');
                                return matches.length;
                            },
                            { id: cell.id, wanted: normalizePressText(text), noise: INVISIBLE_TEXT_PATTERN.source },
                        );
                        const mismatch = describePressMismatch({ stateName, cellLabel: cell.label, text, count });
                        if (mismatch !== undefined) throw new Error(mismatch);
                        await onPage.locator('[data-rn-preview-press]').click();
                        await onPage.waitForTimeout(300);
                        await onPage.evaluate(settleAnimations);
                    }
                }
            }
        };

        const shoot = async (onPage, name, outPath) => {
            // Give fonts and images time to paint. Some cells paint late even after networkidle.
            // waitForTimeout runs on the Node side, so it is real time even when the page clock is stopped.
            await onPage.waitForTimeout(700);
            // The grid lives inside an RN ScrollView (an inner scroll container), so the document
            // does not grow even with fullPage, and cells below the viewport are cut off when there
            // are many variants. Measure the real content height, grow the viewport to match, then shoot.
            const contentHeight = await onPage.evaluate(() => {
                let max = document.body.scrollHeight;
                for (const el of document.querySelectorAll('*')) {
                    if (el.scrollHeight > max) max = el.scrollHeight;
                }
                return max;
            });
            await onPage.setViewportSize({ width: 1440, height: Math.min(contentHeight + 60, 12000) });
            await onPage.waitForTimeout(300);
            await onPage.evaluate(settleAnimations);
            await onPage.screenshot({ path: outPath, fullPage: true });
            if (args.geometry) {
                // The function runs in the browser, so the pattern crosses over as its source.
                const cells = await onPage.evaluate(extractGeometry, CELL_LABEL_PATTERN.source);
                const geometryPath = outPath.replace(/\.png$/, '.geometry.json');
                writeFileSync(geometryPath, `${JSON.stringify({ name, cells }, null, 2)}\n`);
            }
            await onPage.setViewportSize({ width: 1440, height: 900 });
            results.push({ name, status: 'captured', detail: outPath });
        };

        /**
         * Captures a declaration that asked for a controlled clock (`timeline`, `filmstrip`, `now`).
         *
         * The clock has to be installed before the page's scripts run, so the declaration is opened
         * again in a fresh page. With a timeline the clock is stopped during loading and only
         * advanced to each moment: a timer that hides an intro after 2.4 seconds otherwise races the
         * shot, and which side it lands on depends on how long the page took to load.
         */
        const captureOnClock = async (target, meta, outPath) => {
            const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
            const clockPage = await context.newPage();
            await markCapturing(clockPage);
            const start = meta.now ?? Date.now();
            try {
                await clockPage.clock.install({ time: start });
                if (meta.timeline !== undefined) await clockPage.clock.pauseAt(start);
                if (!(await open(target, clockPage))) return;
                if (meta.timeline === undefined) {
                    await runInteractions(clockPage, meta.interactions);
                    await shoot(clockPage, target.name, outPath);
                    return;
                }
                let elapsed = 0;
                for (const moment of meta.timeline) {
                    if (moment > elapsed) await clockPage.clock.runFor(moment - elapsed);
                    elapsed = moment;
                    await shoot(clockPage, `${target.name}@${moment}ms`, outPath.replace(/\.png$/, `@${moment}ms.png`));
                }
            } finally {
                await context.close();
            }
        };

        const captureOne = async (target) => {
            const outPath = resolve(args.out, `${target.name.replaceAll('/', '__')}.png`);
            try {
                if (!(await open(target, page))) return;
                const meta = await page.evaluate((key) => window[key], CAPTURE_META_KEY);
                if (meta?.timeline !== undefined || meta?.now !== undefined) {
                    await captureOnClock(target, meta, outPath);
                    return;
                }
                await runInteractions(page, meta?.interactions);
                await shoot(page, target.name, outPath);
            } catch (error) {
                results.push({
                    name: target.name,
                    status: 'error',
                    detail: error instanceof Error ? error.message : String(error),
                });
            }
        };

        for (const target of targets) await captureOne(target);

        // Retry only the targets that died on a goto timeout, once, at the end of the batch.
        //
        // As the declaration count grows, the load of the dev server crawling dependencies grows
        // with it, and one heavy screen landing in that window never reaches networkidle. Measured:
        // a heavy screen died even at 120 seconds in a batch of 26 declarations, was captured in 6
        // seconds on its own, and passed in a batch of 8. Moving it first changed nothing, so it is
        // batch size rather than accumulation from earlier captures. It captures fine once the
        // server has warmed up, so a failure is retried once instead of being left as is.
        const timedOut = results.filter((r) => r.status === 'error' && r.detail.includes('Timeout'));
        for (const stale of timedOut) {
            const target = targets.find((t) => t.name === stale.name);
            if (!target) continue;
            results.splice(results.indexOf(stale), 1);
            await captureOne(target);
        }
    } finally {
        await browser.close();
        if (server) server.child.kill('SIGTERM');
    }

    for (const r of results) {
        process.stdout.write(`${r.status}\t${r.name}\t${r.detail}\n`);
    }
    const captured = results.filter((r) => r.status === 'captured').length;
    process.stdout.write(`\ncaptured ${captured}/${results.length}\n`);
    process.exit(captured === 0 ? 1 : 0);
};

capture().catch((error) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exit(1);
});

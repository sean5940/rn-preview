# Agent setup guide

A procedure written for a coding agent to execute verbatim. A person can read it too, but every step is an
**command to run plus a pass condition.** If a pass condition is not met, do not move on — follow that step's
"If it blocks".

_Korean: [AGENT-SETUP.ko.md](AGENT-SETUP.ko.md)_

This tool does not run on its own. It reads a target React Native project and draws from it. So half of setup is
"how do I let it find the target project".

## 0. Check prerequisites

```bash
node -v
git --version
```

Pass condition: node major version 22 or higher.

If it blocks: install Node 22 or higher and check again. Below that, setup can finish and vite will still break later
when it starts.

## 1. Fix the target project path

Decide the target project path first. **If the user did not state a path, ask — do not guess.** Grab the wrong project
and you get a state where the screen renders but the content is from somewhere else, and the cause surfaces much later.

If you have a candidate path, confirm it is really an RN project.

```bash
node -e 'const p=require(process.argv[1]+"/package.json");console.log(p.dependencies?.["react-native"]?"OK RN project":"not an RN project")' <target path>
```

Pass condition: prints `OK RN project`.

## 2. Clone and install

```bash
git clone <this repository> rn-preview
cd rn-preview
npm install
```

Pass condition: `npm install` exits 0 and `tsconfig.paths.json` exists.

```bash
test -f tsconfig.paths.json && echo "OK paths file present"
```

That file is derived from the target project's tsconfig, so its contents differ per machine and it is excluded from
version control. `npm install`'s postinstall creates it empty, and it is rewritten with real contents the first time
the dev server starts.

If it blocks: postinstall may have been skipped. Call `node scripts/ensurePathsFile.mjs` directly.

## 3. Connect the target project

There are three ways. **They get weaker going down** — what you pass each time beats what you wrote down once.

**(a) An environment variable, if the target differs per command.** Add `MOBILE_APP_PATH`. This is what the editor
extension and automation handling several worktrees at once use. **It wins even if you also wrote (b).**

```bash
MOBILE_APP_PATH=<target path> npm run dev
```

**(b) `rn-preview.local.json`, if this clone always looks at the same target.** Create it at the repository root. It
is excluded from version control, so it is never committed.

```bash
cat > rn-preview.local.json <<'EOF'
{
    "projectRoot": "<absolute path, or a path relative to rn-preview>"
}
EOF
```

**(c) Pass nothing and it searches sibling directories.** Only usable when `rn-preview` and the target project sit
side by side under the same parent and **exactly one** folder there depends on `react-native`.

If your layout keeps worktrees alongside, this method is mostly unusable: a worktree is also an RN project, so there
are several candidates, and the tool prints the list and stops rather than choosing. Better behaviour than drawing the
wrong project, but with that layout, name the target up front with (a) or (b).

Confirm the connection.

```bash
npm run dev
```

Pass condition: an address starting with `Local:` is printed and the process stays alive. Stop it once confirmed.

If it blocks: a "could not find the RN project" error means no target has been picked up yet — name the path with (b)
or (c). "Found several RN projects in sibling directories" means there were multiple candidates and none was chosen;
pick one from the printed list and name it the same way.

## 4. Choose the declaration directory

Previews render from `*.preview.tsx` declarations. The default location is `previews/` in the target project.

To put them elsewhere, pass `PREVIEW_DIR` or add `previewRoot` to `rn-preview.local.json`. **The environment variable
wins here too.** Even with `previewRoot` written down, passing `PREVIEW_DIR` looks at that instead.
**Keeping declarations out of the team repository** falls under this: move them to an ignored directory and point at it.

**The declaration directory is the only place this tool writes.** A `tsconfig.json` for the editor is created inside
it — but **only when the directory already exists**, so no files are left behind in a spot that holds no declarations.
It therefore appears from the run after you create your first declaration.

If you decided to keep the declaration directory inside the target repository, add its path to that repository's
`.gitignore`. Otherwise the generated file shows up as a commit candidate.

```bash
grep -q '^previews/$' <target path>/.gitignore || echo 'previews/' >> <target path>/.gitignore
```

Per-project settings (module overrides, root providers, packages that draw nothing) live in `rn-preview.config.json`
next to the declaration directory. A replacement implementation is code that knows that project's circumstances, so it
sits with the project rather than with the tool. The fields are in [README](../README.md) under "Per-project settings".

## 5. Create a first declaration and render it

```bash
npm run preview:new -- <path to a component file in the target project>
npm run dev
```

Pass condition: that component renders in the grid in a browser.

If it blocks: stopping at `X is not exported` means adding that name to `src/stubs/nativeStub.ts`. A screen that fails
to mount entirely is usually missing a provider the app always wraps at its root — add it to `rootProviders` in
`rn-preview.config.json`.

## 6. Only if you also want captures

Headless capture calls **the system Chrome** through `playwright-core`. No browser is downloaded separately, so this
feature alone fails if Chrome is absent.

```bash
node -e 'console.log(require("fs").existsSync("/Applications/Google Chrome.app")?"OK Chrome present":"Chrome absent")'
```

Narrow the target with `--name` or `--file`. **An unrecognised flag is silently ignored and every declaration is
captured**, so you notice a typo by everything running.

## Deciding setup is done

Setup is finished when all of these hold.

- [ ] `node -v` is 22 or higher
- [ ] `test -f tsconfig.paths.json` passes
- [ ] `npm run dev` prints a `Local:` address and stays alive
- [ ] One component renders in the browser grid

# Web render compatibility

The test is "does it render in a browser without erroring". Pixel parity is out of scope.

_Korean: [COMPATIBILITY.ko.md](COMPATIBILITY.ko.md)_

## What has been verified

Verified against a production React Native design system and several data-driven screens. Component names below are
generic categories, not any one library's API.

| Component kind             | Status | Notes                                                                                          |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| Semantic colour tokens     | works  |                                                                                                |
| Icon set (generated `tsx`) | works  | Generated tsx needs no svg transform. Three sizes and colour overrides check out               |
| Typography tokens          | works  |                                                                                                |
| Badge                      | works  | Type · colour · size variants                                                                  |
| Callout                    | works  | With and without a title, plus bulleted                                                        |
| Chip                       | works  | Four discriminated-union members. Verified straight off the generated draft                    |
| Confirm modal              | works  | One button · two buttons · destructive                                                         |
| Accordion item             | works  | Collapsed layout and typography variants                                                       |
| Bottom fixed button        | works  | Its text is `children`, so the draft comes out with an empty cell                              |
| Segmented control          | works  | Size variants. Needs the worklet babel step to mount                                           |
| Tabs                       | works  | Selection-indicator position and width variants                                                |
| Text field                 | works  | Default · focus · disabled                                                                     |
| Thumbnail                  | works  | Aspect-ratio variants. Images are mock URLs, so the cell is blank                              |
| Toast                      | works  | Per-kind icon and colour                                                                       |
| Data-driven screens        | works  | Loading · empty · fetch-failure · per-status states. See the redux and React Query notes below |
| Bottom sheets              | works  | Open geometry only. Behaviour: see the reanimated note below                                   |

## Screen-level previews

Unlike components, a screen's appearance is decided by data rather than props. Wrap it in providers with `wrappers`
and supply per-state server responses with `states`, and every combination renders in one row. Note that `states` is a
way of seeding the React Query cache, so it only reaches screens that actually use React Query (see below).

```tsx
export default definePreview({
    component: SubscriptionScreen,
    variants: { default: {} },
    wrappers: ['query', 'navigation'],
    route: { name: 'Subscription', params: {} },
    mockQueries: [{ key: subscriptionQueries.get().queryKey, data: SUBSCRIPTION }],
    states: { cancelScheduled: [{ key: subscriptionQueries.get().queryKey, data: CANCEL_SCHEDULED }] },
});
```

The `navigation` wrapper does not stand up a real navigator. It fills in only what a screen reads
(`useNavigation` · `useRoute` · `useIsFocused`). **Attempt to navigate and nothing happens.**

Safe area is not in `wrappers`. On a device the value is always there, so it is always applied. `useSafeAreaInsets`
can be called several levels down inside a child, which means whoever writes the declaration cannot know in advance —
and if it is missing, the whole screen fails to mount. Insets default to a notched 375-wide device (top 44 · bottom 34).

Any query not in `mockQueries` really does go to the server. A preview has no authentication, so you usually get the
error state. That is also a state worth seeing, so it is not blocked.

Repeat a key and the last one wins. That is how `states` overrides `mockQueries`.

## Modals and bottom sheets

**Look at geometry through the component's own declaration.** Props are the variants there, which makes them
comparable and keeps them stable regardless of screen state. For any sheet or modal used by more than one screen, this
is the way.

A bottom sheet opens via `ref.show()`, so turn on `openOnMount`. Cell size is device size, so the default is 375 × 795.

When a sheet hits its maximum height it scrolls inside itself, just like on a device. On the web the **inner wrapper
and scroll area kept the full content height even with the outer height constrained**, so it clipped instead of
scrolling; shrinking the inner element to its parent fixed it (`enableSheetScroll` in `src/PreviewCase.tsx`).

Find the element to shrink by walking **up from the scroll area.** Hunting top-down for "the clipped element" catches
the outer wrapper first, which leaves the inner element — the one that actually needs shrinking — alone and changes
the wrong thing.

Cells carry no inner padding. Absolutely-positioned things like sheets and modals treat the cell as the device screen,
so any padding offsets them by that much and pushes their bottom outside the cell.

You could enlarge the cell so everything fits on one screen, but then you have a sheet at a size no device has, and
**what gets folded changes.** Seeing where the fold lands is this tool's job, so that route was not taken.

```tsx
export default definePreview({
    component: PlanChangeBottomSheet,
    variants: { default: { nextBilling: NEXT_BILLING, onReserveChange: () => undefined } },
    wrappers: ['navigation'],
    openOnMount: true,
});
```

**"Does it appear when tapped" is not a question this tool answers.** That is behaviour, not geometry — a screen's
branching logic.

### The idiom of clearing a position with `undefined`

`[StyleSheet.absoluteFill, { top: undefined }]` means "release the top anchor and pin to the bottom", and it turns up
all over RN codebases. Native treats `undefined` as a clear, but **react-native-web skips it, so the preceding style's
`top: 0` survives.** A sheet's bottom button ends up at the top, and the content shifts down and overflows.

It is rewritten to `auto`, which means the same thing in CSS (`src/rnStyleCompat.ts`). Applied to position properties only.

## What does not work as-is

### Design-system barrels

Import through a barrel and you open up the app's entire dependency graph. Packages that read native constants at
module top level (`react-native-branch` is typical) come along in a chain, and stubbing one of them out shifts the
tree-shaking path so a different one shows up. Declarations use direct paths like `@ui/components/badge/Badge`.

A cycle where something inside `foundation` reaches back through the top-level barrel is cut in the preview's
resolution step, configured per project via `importRedirects`. The target project is not modified.

### Native modules

`react-native-web` ported only the drawing APIs. `src/stubs/reactNative.tsx` fills in the native-module bridges.
`TurboModuleRegistry` and `NativeModules` answer anything with an inert value, and `requireNativeComponent` returns an
empty `View`.

So **anywhere a native view goes appears as an empty cell in a preview.** Layout holds; only the content is missing.

`Image.resolveAssetSource` lives here too. Metro turns `require('./x.png')` into an asset number and this function
turns the number back into a URI; on the web `requireToImport` already hands over a URL string, so it is wrapped and
returned. Dimensions are unknowable, hence 0.

Packages that draw nothing — analytics, push, permissions, storage, login, sharing — are emptied wholesale
(`NON_RENDERING_PACKAGES`). A screen that branches on their values can look different from reality.

Export names for an emptied package are read from the real package (`src/stubModules.ts`). Writing them by hand never
converged: every package emptied surfaced new names.

### redux

App code calls `useSelector` several levels below a screen. react-redux throws without a Provider, so **the whole
screen fails to mount and the reason does not surface on screen.** Whoever writes the declaration cannot know that in
advance, so it is not a `wrappers` choice — providers listed under `rootProviders` in config are wrapped around every
cell. They point at the app's own root provider, so the store is the app's store.

A preview has no login and no bootstrap, so **state is whatever the initial value is at app construction.** A screen
that branches on global state shows only the appearance matching that initial value.

The devtools bridge (`@rozenite/redux-devtools-plugin`) has nothing to do in a preview and is swapped for a stub
(`src/stubs/rozeniteReduxDevTools.ts`). Emptying it wholesale leaves the enhancer slot vacant and breaks store
creation; packages in this family also point their `exports` `development` condition at a `src/` that is not published,
so wherever Vite turns that condition on, resolution fails from the transitive dependencies up.

### Screens that do not use React Query

`mockQueries` and `states` seed the React Query cache. They do not reach a screen that holds a list in `useState` and
calls a repository directly, so left alone you see only the failed-fetch appearance, since there is no authentication.

Point that screen's data access (the repository) somewhere else with `moduleOverrides` in config. The axis that selects
a state is then the screen's real input (the query conditions in `route.params`), and the replacement implementation
decides which input maps to which response.

### RN style defaults

Yoga defaults `flexShrink` to 0; CSS defaults it to 1. `react-native-web` does not restore that, so a short string in
a row can wrap where it would not on a device (a long item name next to an amount folds onto two lines). This is a
closable gap and has not been closed yet.

### Fonts

Apps commonly select weight by family name (`Pretendard-SemiBold`) rather than `fontWeight`. If the browser lacks that
font, all four collapse to the same fallback and **the weight distinction disappears entirely.** Places that bold only
part of a string render uniformly, so emphasis that exists in the implementation looks absent in the preview. Glyph
widths differ too, so line breaks and clipping diverge from the device.

The gap is closed by serving the fonts the app links (`src/appFonts.ts`). The project's `ios/fonts` is read, an
`@font-face` is built per file, and each points at the dev server's `/@fs`. Projects that keep fonts elsewhere add
paths via `fontDirs` in config. Since `/@fs` is a dev-only route, this plugin runs on the dev server only.

Family names are taken from filenames. The name RN asks for is the font's PostScript name, which in principle can
differ from the filename, but matching the two when linking is the convention. Where they diverge, that one font
renders with the fallback as before.

The Android side (`android/app/src/main/res/font`) is not read. The same fonts sit there under lowercase filenames
that do not match the names the app asks for.

### A/B test assignment

On a device the app bootstrap fetches assignments from the server and puts them in redux. A preview has no such step,
so the assignment list is empty and app selectors treat "unassigned" as fail-closed `'A'`. **A screen behind a flag
then renders as a blank cell, and the reason does not surface.**

The selector is swapped for a preview-only implementation that reads assignments from the declaration. Any experiment
not listed is treated as the exposed group (`'B'`), because what you usually want to preview is the side being built
behind the flag. Name the other side explicitly to see it.

```tsx
abTestGroups: { checkout_redesign: 'A' },
```

### Platform

`Platform.OS` is `'web'`. That is how the RN ecosystem selects web implementations, so it is left alone. Consequently
`isIos` and `isAndroid` are both false, and **platform-branched styles render as neither, at the default.**

App code that assumes only ios and android exist and throws otherwise (a config module, an `isProduction` helper) is
swapped for a preview-only implementation via `moduleOverrides` (`src/mobileAppOverrides.ts`). The target project is
not modified.

### Metro-only syntax

Asset references like `require('./x.png')` and `.svg` imports are Metro's business and do not exist in a web bundler.
`src/requireToImport.ts` rewrites `require` to an import, and `src/svgComponents.ts` turns `.svg` into a
react-native-svg component. Note that a `require` inside a conditional now always loads.

### Gradients

`react-native-linear-gradient` is replaced by CSS gradients (`src/stubs/linearGradient.tsx`). Native also factors in
the view's actual aspect ratio, so **the angle of a diagonal gradient can differ slightly.** Vertical and horizontal
match.

### Window size and measured coordinates

In a browser `useWindowDimensions` and `measureInWindow` answer about the browser window (1440 wide, with cells
offset from its corner). Code that positions things against the screen edge landed outside the cell: a tooltip
computing `right = screenWidth - pageX - width` was drawn at x = -704.

`src/stubs/reactNative.tsx` makes both relative to the cell. `useWindowDimensions` and `Dimensions.get` report the
device size, and `measure` and `measureInWindow` report coordinates with the cell's top-left corner as the origin.

**The device size depends on the kind of declaration.** A screen declaration (route, data, states, sheets) is the
device, so the cell's size is used. A component declaration's cell is only the component's box (a 343 card, a 295
dialog) and the component still sits on a 375 device, so 375 × 795 is used. A dialog that sizes itself as
`window width - 80` then comes out 295, as on a device.

`Dimensions.get` called during a render (a component body, `useMemo`, a `useState` initializer) reports that cell's
device: it walks up from the component React's development build reports as rendering to the cell's context. Outside
a render (module scope, effects, event handlers) it cannot tell which cell is asking and reports the device of the
first width.

### Width of absolutely positioned boxes

Yoga measures a `position: absolute` box that has no width and is not pinned to both sides at its content width
when its parent lays out in a row, and constrains it to the parent only for a column parent (`AbsoluteLayout.cpp`,
`layoutAbsoluteChild`). The browser always shrinks it to the containing block, so a tooltip inside a narrow row (a
header button) wrapped one character per line.

Cells give such boxes `width: max-content` (`src/yogaAbsoluteWidth.ts`). Boxes with a specified width (an `r-width-*`
class or an inline `width`) and boxes pinned to both sides are left alone. Elements mounted later are followed too.

### CSS animations at the moment of capture

A spinner (react-native-web's `ActivityIndicator`) rotates through an infinite CSS animation. The page clock does not
drive CSS, so the angle at the moment of the shot varied from run to run, and the rotated graphic's bounding box with
it (41.7 against 40.7 on consecutive runs). Right before shooting, the capture returns infinite animations to their
unanimated state and sends finite ones to their end, the rule Playwright's `animations: 'disabled'` uses, applied to
the geometry as well as the picture. Capturing 64 declarations twice gave identical geometry; 11 pictures differed
only below visibility (channel difference sum at most 30).

### Branches on a component's own `useState`

A branch that props and responses cannot reach (a tab, an expansion, a selection) is made by pressing, right before
the capture, with the declaration's `interactions` (README "State after pressing"). Measured: in a bottom sheet with
two option cards, pressing one card changed the primary button label in `--geometry` `texts`, and the column that was
not pressed stayed as it was. U+2060 joiners that an app inserts between characters to keep words from breaking are
ignored when comparing text. Because `onTextLayout` reports empty `lines` on rn-web, a component that measures its line
count to decide whether to show a "more" button never draws a button to press, so it cannot be a target.

### Lottie

`lottie-react-native` is replaced by lottie-web's SVG renderer (`src/stubs/lottieView.tsx`). The package's web
implementation never reads the React Native `style` (only `webStyle`) and draws through an optional peer that is not
installed, so the block lost its device size (spinner cell measured 162 in the preview, 192 on a device). The
stand-in keeps `style`, so the block matches a device (spinner cell 194 = 192 + the 2px cell border, funnel intro
110 × 110).

By default it **stops on the last frame**, so every capture shows the same picture; an animation that animates in has
an empty first frame. A declaration's `lottieFrame` picks `'first'`, `'middle'`, a frame number, or `'play'`. `'play'`
runs on the page clock, so together with `timeline` each moment shows the same frame on every run.

Load failures are not reported to the screen. A screen that skips an intro when its animation fails must not change
state because of the tool. A failed block gets `data-lottie-error`.

**The renderer is not the native one.** Mattes and effects can draw differently, so pixel differences inside an
animation are not evidence of a defect; only the block's size and position are.

### `react-native-reanimated`

`useAnimatedStyle(() => ...)` is not syntax — it is an **API that depends on a build step.** reanimated's babel plugin
finds the values referenced in the callback and supplies them as a dependency array; Vite has no such step, so
reanimated throws and the whole screen fails to mount. Only files that use worklets are routed through the target
project's copy of that plugin via babel (`src/reanimatedWorklets.ts`).

With that step in place, every component in the table above renders. **Rendering and behaving are different things.**
Dragging, snapping, and animation differ from a device to the extent gesture-handler behaves differently on the web.
Trust the open geometry; do not trust what happens when you drag it by hand.

## Checks

`npx tsc --noEmit` follows through into the target project's sources. Those were written against their own tsconfig,
so errors remain from things like `*.svg` module declarations and RN-only libs. rn-preview's own files are clean.

```bash
npx tsc --noEmit 2>&1 | grep -v '^\.\./my-rn-app'
```

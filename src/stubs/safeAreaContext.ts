import { createContext } from 'react';

type Frame = { x: number; y: number; width: number; height: number };
type Insets = { top: number; bottom: number; left: number; right: number };

/**
 * Stands in for `react-native-safe-area-context` when the target project does not install it.
 *
 * The preview always pins the frame and insets to the cell, so the import has to resolve even in an
 * app that never reads them. Nothing in such an app reads these contexts.
 */
export const SafeAreaFrameContext = createContext<Frame | null>(null);

export const SafeAreaInsetsContext = createContext<Insets | null>(null);

import { previewConfig } from './previewConfig.ts';

/**
 * Root of the target RN project.
 *
 * The name dates from when this tool only ever looked at one app. It now comes from config.
 */
export const MOBILE_APP_ROOT = previewConfig.projectRoot;

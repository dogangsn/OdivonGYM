/** Identity of a panel build (see scripts/write-version.mjs and release.json). */
export interface BuildInfo {
  /** package.json version, x.y.z */
  version: string;
  commit: string;
  builtAt: string;
  /** Unique per build: version + commit + build time. */
  buildId: string;
  /** Short release note shown in the update banner. */
  notes: string;
  /** Critical release: the update cannot be postponed. */
  forceLogout: boolean;
  /** Builds older than this x.y.z must update before continuing. */
  minVersion: string | null;
}

export { BUILD_INFO } from './build-info.generated';

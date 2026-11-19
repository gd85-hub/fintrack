// Routes that exist only while developing. Expo Router registers every file
// under app/, so a development-only screen still ships inside the production
// bundle: it has to refuse to render itself rather than rely on not being
// routed. Nothing in the app links to one, so a production build can only be
// reached by typing the URL, and then this is what answers.

/**
 * Strict on purpose: only the real boolean `true` opens a development route.
 * `__DEV__` is replaced by the bundler, and a build where it arrives as a
 * truthy string, a number or `undefined` is a build we know nothing about,
 * so it is treated as production.
 */
export function isDevOnlyRouteEnabled(dev: unknown): boolean {
  return dev === true;
}

/**
 * Whether the design-system playground at /ds-playground may render.
 */
export function isPlaygroundEnabled(): boolean {
  return isDevOnlyRouteEnabled(
    typeof __DEV__ === 'undefined' ? undefined : __DEV__,
  );
}

import { describe, expect, test } from '@jest/globals';

import { isDevOnlyRouteEnabled, isPlaygroundEnabled } from '../devRoutes';

// Expo Router registers every file under app/, so /ds-playground is part of
// the production bundle whether or not anything links to it. The gate is the
// only thing standing between a typed URL and the playground, so it is held
// to the strictest reading: the real boolean true, nothing else.
describe('isDevOnlyRouteEnabled', () => {
  test('a development build opens the route', () => {
    expect(isDevOnlyRouteEnabled(true)).toBe(true);
  });

  test('a production build closes it', () => {
    expect(isDevOnlyRouteEnabled(false)).toBe(false);
  });

  test('nothing merely truthy opens it', () => {
    // A bundler or host that hands over a string, a number or an object
    // instead of a boolean is a build this code does not recognise, and an
    // unrecognised build is treated as production.
    for (const value of ['true', 'development', 1, -1, {}, [], ' ']) {
      expect({ value, open: isDevOnlyRouteEnabled(value) }).toEqual({
        value,
        open: false,
      });
    }
  });

  test('an absent flag closes it', () => {
    for (const value of [undefined, null, 0, '', NaN]) {
      expect({ value, open: isDevOnlyRouteEnabled(value) }).toEqual({
        value,
        open: false,
      });
    }
  });
});

describe('isPlaygroundEnabled', () => {
  test('it follows __DEV__, which Jest runs as a development build', () => {
    // Guards against the gate being wired to something other than __DEV__:
    // under Jest the flag is true, so the playground must agree.
    expect(isPlaygroundEnabled()).toBe(isDevOnlyRouteEnabled(__DEV__));
    expect(isPlaygroundEnabled()).toBe(true);
  });
});

import { type ButtonColors } from '../../components/ds/Button';
import { theme } from '../theme';

// A palette whose every colour is its own token path, e.g.
// action.primary.icon === 'action.primary.icon'.
//
// The published palettes give several semantically different tokens the same
// hex: in Light, action/primary/icon, action/primary/content and
// content/onMedia are all #ffffff, and action/secondary/content equals
// text/primary in both schemes. A test run against those palettes therefore
// passes even when a binding is wrong. Here no two tokens share a value, so an
// assertion fails the moment the component reads the neighbouring token.
export function labelledPalette(): ButtonColors {
  const walk = (node: unknown, path: string): unknown => {
    if (typeof node === 'string') {
      return path;
    }
    if (Array.isArray(node)) {
      return node.map((item, index) => walk(item, `${path}.${index}`));
    }
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([key, value]) => [
        key,
        walk(value, path ? `${path}.${key}` : key),
      ]),
    );
  };

  // The walk preserves the shape of theme.color key for key and only replaces
  // string leaves with strings, which TypeScript cannot follow through
  // `unknown`; the shape is asserted by paletteIsExhaustive in the test suite.
  return walk(theme.color, '') as ButtonColors;
}

import { describe, expect, jest, test } from '@jest/globals';
import Feather from '@expo/vector-icons/Feather';
import {
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { act, create, type ReactTestInstance } from 'react-test-renderer';

import {
  IconButton,
  type IconButtonColors,
  type IconButtonIconProps,
  type IconButtonSize,
  type IconButtonVariant,
  iconButtonFocusColor,
  iconButtonFocusRing,
  iconButtonRadius,
  iconButtonSizeSpec,
  iconButtonSpinnerSize,
  iconButtonSurface,
} from '../../components/ds/IconButton';
import { labelledPalette } from '../__fixtures__/buttonPalette';
import { darkColor, theme } from '../theme';

// Asserts the Figma Icon Button spec (set 105:47, 105 variants) against the
// tokens it must bind, not against raw hex values.
let mockPalette: IconButtonColors = theme.color;

jest.mock('../../contexts/ThemeContext', () => ({
  useColors: () => mockPalette,
}));

// The real Feather loads its icon font asynchronously and sets state after
// the test has finished, which only produces act() noise here.
jest.mock('@expo/vector-icons/Feather', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRn = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );
  return {
    __esModule: true,
    default: (props: { name: string; size: number; color: string }) =>
      mockReact.createElement(mockRn.Text, null, props.name),
  };
});

const variants: IconButtonVariant[] = [
  'primary',
  'neutral',
  'outline',
  'surface',
  'ghost',
  'danger',
  'onMedia',
];

const sizes: IconButtonSize[] = ['small', 'medium', 'large'];

const themes: [string, IconButtonColors][] = [
  ['light', theme.color],
  ['dark', darkColor],
];

// The published palettes give several semantically different tokens the same
// hex, so the labelled palette is the run that can fail on a misbinding.
const palettes: [string, IconButtonColors][] = [
  ...themes,
  ['labelled', labelledPalette()],
];

function renderButton(node: React.ReactElement) {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(node);
  });
  if (!tree) {
    throw new Error('IconButton did not render');
  }
  return tree;
}

function unmountTree(tree: ReturnType<typeof create>) {
  act(() => {
    tree.unmount();
  });
}

type PressableProps = {
  accessibilityHint?: string;
  accessibilityLabel: string;
  accessibilityState: { busy: boolean; disabled: boolean };
  'aria-busy': boolean;
  focusable: boolean;
  onHoverIn: () => void;
  onPress: () => void;
};

function pressableProps(root: ReactTestInstance): PressableProps {
  const node = root.find(
    (candidate) =>
      typeof candidate.type !== 'string' &&
      candidate.props.accessibilityRole === 'button' &&
      typeof candidate.props.onPress === 'function',
  );
  return node.props as PressableProps;
}

// react-test-renderer types host names in lower case, React Native emits
// 'View', so the host lookup compares case-insensitively.
// A view rendered without a style prop flattens to undefined, so reads go
// through this.
function flat(node: ReactTestInstance): ViewStyle {
  return StyleSheet.flatten((node.props.style ?? {}) as ViewStyle) ?? {};
}

function hostViews(root: ReactTestInstance) {
  return root.findAll(
    (node) =>
      typeof node.type === 'string' && node.type.toLowerCase() === 'view',
  );
}

// The outermost host view is the touch target; the next one is the paint.
function targetStyle(root: ReactTestInstance): ViewStyle {
  return StyleSheet.flatten(hostViews(root)[0].props.style as ViewStyle);
}

// The painted surface is the one that carries a corner: at Medium and Large
// it is the same size as the target, so height alone cannot tell them apart.
function surfaceStyle(root: ReactTestInstance, size: IconButtonSize): ViewStyle {
  const spec = iconButtonSizeSpec(size);
  const node = hostViews(root).find((candidate) => {
    const style = StyleSheet.flatten(candidate.props.style as ViewStyle);
    return style.height === spec.surface && style.borderRadius !== undefined;
  });
  if (!node) {
    throw new Error('No painted surface found');
  }
  return StyleSheet.flatten(node.props.style as ViewStyle);
}

describe('iconButtonSizeSpec', () => {
  test('each size binds its target, paint, corner and icon', () => {
    expect(iconButtonSizeSpec('small')).toMatchObject({
      target: 44,
      surface: 40,
      radius: 12,
      focusRadius: 16,
      iconSize: 20,
    });
    expect(iconButtonSizeSpec('medium')).toMatchObject({
      target: 48,
      surface: 48,
      radius: 14,
      focusRadius: 18,
      iconSize: 20,
    });
    expect(iconButtonSizeSpec('large')).toMatchObject({
      target: 56,
      surface: 56,
      radius: 16,
      focusRadius: 20,
      iconSize: 24,
    });
  });

  test('the sizes come from tokens, not from loose numbers', () => {
    expect(iconButtonSizeSpec('small').target).toBe(theme.scale.size.touchTarget);
    expect(iconButtonSizeSpec('small').surface).toBe(theme.scale.size.iconButton);
    expect(iconButtonSizeSpec('small').radius).toBe(theme.scale.radius.sm);
    expect(iconButtonSizeSpec('medium').target).toBe(theme.scale.size.controlMd);
    expect(iconButtonSizeSpec('medium').radius).toBe(
      theme.scale.radius.buttonMedium,
    );
    expect(iconButtonSizeSpec('large').target).toBe(theme.scale.size.controlLg);
    expect(iconButtonSizeSpec('large').radius).toBe(theme.scale.radius.md);
    expect(iconButtonSizeSpec('large').iconSize).toBe(theme.scale.size.iconLg);
  });

  test('only Small separates the target from the paint', () => {
    // 40 inside 44: the one size where the button is smaller than the area
    // that answers a finger.
    expect(iconButtonSizeSpec('small').target).toBeGreaterThan(
      iconButtonSizeSpec('small').surface,
    );
    for (const size of ['medium', 'large'] as const) {
      const spec = iconButtonSizeSpec(size);
      expect(spec.target).toBe(spec.surface);
    }
  });

  test('every target is at least 44 across', () => {
    for (const size of sizes) {
      expect(iconButtonSizeSpec(size).target).toBeGreaterThanOrEqual(44);
    }
  });

  test('the focus radius is the corner plus the ring it carries', () => {
    // An outline 2 wide at 2 offset grows the corner by 4: 12 to 16, 14 to
    // 18, 16 to 20, which is what the DS documents as the outer radius.
    const ring = theme.scale.stroke.focusRing;
    for (const size of sizes) {
      const spec = iconButtonSizeSpec(size);
      expect(spec.radius + ring * 2).toBe(spec.focusRadius);
    }
    expect(ring).toBe(2);
  });

  test('the ring box is the paint plus 8', () => {
    // Figma draws it 48, 56 and 64 around a 40, 48 and 56 button.
    const ring = theme.scale.stroke.focusRing;
    expect(iconButtonSizeSpec('small').surface + ring * 4).toBe(48);
    expect(iconButtonSizeSpec('medium').surface + ring * 4).toBe(56);
    expect(iconButtonSizeSpec('large').surface + ring * 4).toBe(64);
  });

  test('the outline stroke is a hairline', () => {
    for (const size of sizes) {
      expect(iconButtonSizeSpec(size).borderWidth).toBe(1);
      expect(iconButtonSizeSpec(size).borderWidth).toBe(
        theme.scale.stroke.hairline,
      );
    }
  });
});

describe('iconButtonRadius', () => {
  test('On media is a circle at every size', () => {
    for (const size of sizes) {
      expect(iconButtonRadius('onMedia', size)).toBe(theme.scale.radius.pill);
    }
  });

  test('every other type takes its size corner', () => {
    for (const variant of variants.filter((v) => v !== 'onMedia')) {
      for (const size of sizes) {
        expect(iconButtonRadius(variant, size)).toBe(
          iconButtonSizeSpec(size).radius,
        );
      }
    }
  });
});

describe('iconButtonSurface', () => {
  // Written from the Figma bindings, type by type, and checked in both
  // published palettes plus the labelled one.
  const contract: Record<
    IconButtonVariant,
    {
      rest: (c: IconButtonColors) => string;
      hover: (c: IconButtonColors) => string;
      pressed: (c: IconButtonColors) => string;
      icon: (c: IconButtonColors) => string;
      disabledFill: (c: IconButtonColors) => string;
      disabledIcon: (c: IconButtonColors) => string;
      border: ((c: IconButtonColors) => string) | null;
    }
  > = {
    primary: {
      rest: (c) => c.action.primary.fill,
      hover: (c) => c.action.primary.hover,
      pressed: (c) => c.action.primary.pressed,
      icon: (c) => c.action.primary.content,
      disabledFill: (c) => c.action.primary.disabled,
      disabledIcon: (c) => c.action.primary.disabledContent,
      border: null,
    },
    neutral: {
      rest: (c) => c.action.neutral.fill,
      hover: (c) => c.action.neutral.hover,
      pressed: (c) => c.action.neutral.pressed,
      icon: (c) => c.action.neutral.content,
      disabledFill: (c) => c.action.primary.disabled,
      disabledIcon: (c) => c.action.primary.disabledContent,
      border: null,
    },
    outline: {
      rest: () => 'transparent',
      hover: (c) => c.state.hover,
      pressed: (c) => c.state.pressed,
      icon: (c) => c.text.primary,
      disabledFill: (c) => c.action.secondary.disabledFill,
      disabledIcon: (c) => c.action.secondary.disabledContent,
      border: (c) => c.border.default,
    },
    surface: {
      rest: (c) => c.action.secondary.fill,
      hover: (c) => c.action.secondary.hover,
      pressed: (c) => c.action.secondary.pressed,
      icon: (c) => c.text.primary,
      disabledFill: (c) => c.action.secondary.disabledFill,
      disabledIcon: (c) => c.action.secondary.disabledContent,
      border: null,
    },
    ghost: {
      rest: () => 'transparent',
      hover: (c) => c.state.hover,
      pressed: (c) => c.state.pressed,
      icon: (c) => c.text.primary,
      disabledFill: () => 'transparent',
      disabledIcon: (c) => c.action.secondary.disabledContent,
      border: null,
    },
    danger: {
      rest: (c) => c.action.destructive.fill,
      hover: (c) => c.action.destructive.hover,
      pressed: (c) => c.action.destructive.pressed,
      icon: (c) => c.action.destructive.content,
      disabledFill: (c) => c.action.primary.disabled,
      disabledIcon: (c) => c.action.primary.disabledContent,
      border: null,
    },
    onMedia: {
      // The scrim never leaves: hover and pressed tint it instead.
      rest: (c) => c.overlay.scrim,
      hover: (c) => c.overlay.scrim,
      pressed: (c) => c.overlay.scrim,
      icon: (c) => c.icon.onMedia,
      disabledFill: (c) => c.overlay.scrim,
      disabledIcon: (c) => c.icon.onMedia,
      border: null,
    },
  };

  test('every type binds its resting fill, border and icon', () => {
    for (const [scheme, palette] of palettes) {
      for (const variant of variants) {
        const expected = contract[variant];
        const surface = iconButtonSurface(palette, variant);
        expect({
          scheme,
          variant,
          background: surface.background,
          border: surface.border,
          icon: surface.icon,
        }).toEqual({
          scheme,
          variant,
          background: expected.rest(palette),
          border: expected.border ? expected.border(palette) : null,
          icon: expected.icon(palette),
        });
      }
    }
  });

  test('hover and pressed walk their own tokens', () => {
    for (const [scheme, palette] of palettes) {
      for (const variant of variants) {
        const expected = contract[variant];
        expect({
          scheme,
          variant,
          hover: iconButtonSurface(palette, variant, { hovered: true }).background,
          pressed: iconButtonSurface(palette, variant, { pressed: true })
            .background,
        }).toEqual({
          scheme,
          variant,
          hover: expected.hover(palette),
          pressed: expected.pressed(palette),
        });
      }
    }
  });

  test('pressed wins over hover', () => {
    for (const [, palette] of palettes) {
      for (const variant of variants) {
        expect(
          iconButtonSurface(palette, variant, { hovered: true, pressed: true }),
        ).toEqual(iconButtonSurface(palette, variant, { pressed: true }));
      }
    }
  });

  test('disabled wins over everything', () => {
    for (const [scheme, palette] of palettes) {
      for (const variant of variants) {
        const expected = contract[variant];
        const surface = iconButtonSurface(palette, variant, {
          disabled: true,
          hovered: true,
          pressed: true,
        });
        expect({
          scheme,
          variant,
          background: surface.background,
          icon: surface.icon,
          overlay: surface.overlay,
        }).toEqual({
          scheme,
          variant,
          background: expected.disabledFill(palette),
          icon: expected.disabledIcon(palette),
          // Nothing tints a button that is off.
          overlay: null,
        });
      }
    }
  });

  test('only On media tints through an overlay', () => {
    for (const [, palette] of palettes) {
      for (const variant of variants.filter((v) => v !== 'onMedia')) {
        for (const state of [{}, { hovered: true }, { pressed: true }]) {
          expect(iconButtonSurface(palette, variant, state).overlay).toBeNull();
        }
      }
      expect(iconButtonSurface(palette, 'onMedia').overlay).toBeNull();
      expect(
        iconButtonSurface(palette, 'onMedia', { hovered: true }).overlay,
      ).toBe(palette.state.hover);
      expect(
        iconButtonSurface(palette, 'onMedia', { pressed: true }).overlay,
      ).toBe(palette.state.pressed);
    }
  });

  test('only Outline carries a stroke, and it keeps it when off', () => {
    for (const [, palette] of palettes) {
      for (const state of [{}, { hovered: true }, { disabled: true }]) {
        expect(iconButtonSurface(palette, 'outline', state).border).toBe(
          palette.border.default,
        );
      }
      for (const variant of variants.filter((v) => v !== 'outline')) {
        expect(iconButtonSurface(palette, variant).border).toBeNull();
      }
    }
  });

  test('Outline and Ghost rest transparent rather than painting a fill', () => {
    for (const [, palette] of palettes) {
      for (const variant of ['outline', 'ghost'] as const) {
        expect(iconButtonSurface(palette, variant).background).toBe(
          'transparent',
        );
      }
    }
    // Ghost stays invisible even when off; Outline takes the disabled fill.
    const palette = labelledPalette();
    expect(
      iconButtonSurface(palette, 'ghost', { disabled: true }).background,
    ).toBe('transparent');
    expect(
      iconButtonSurface(palette, 'outline', { disabled: true }).background,
    ).toBe(palette.action.secondary.disabledFill);
  });

  test('no disabled icon keeps a live hue', () => {
    for (const [, palette] of themes) {
      for (const variant of variants.filter((v) => v !== 'onMedia')) {
        expect(
          iconButtonSurface(palette, variant, { disabled: true }).icon,
        ).not.toBe(iconButtonSurface(palette, variant).icon);
      }
    }
  });

  test('On media is the documented exception: its icon stays white when off', () => {
    for (const [, palette] of palettes) {
      expect(
        iconButtonSurface(palette, 'onMedia', { disabled: true }).icon,
      ).toBe(palette.icon.onMedia);
    }
  });
});

describe('iconButtonFocusColor', () => {
  test('every type rings in border/focus, except On media', () => {
    for (const [scheme, palette] of palettes) {
      for (const variant of variants.filter((v) => v !== 'onMedia')) {
        expect({ scheme, variant, color: iconButtonFocusColor(palette, variant) }).toEqual({
          scheme,
          variant,
          color: palette.border.focus,
        });
      }
      expect(iconButtonFocusColor(palette, 'onMedia')).toBe(
        palette.border.onInverse,
      );
    }
  });

  test('it is not the Button focus token', () => {
    // Button rings in action/*/focus; Icon Button in border/focus. Same
    // value in the published palettes, different tokens.
    const palette = labelledPalette();
    expect(iconButtonFocusColor(palette, 'primary')).not.toBe(
      palette.action.primary.focus,
    );
  });
});

describe('iconButtonFocusRing', () => {
  test('a visible ring is 2 wide, 2 clear of the button, in its focus colour', () => {
    for (const [scheme, palette] of palettes) {
      for (const variant of variants) {
        expect({ scheme, variant, ...iconButtonFocusRing(palette, variant, true) }).toEqual({
          scheme,
          variant,
          outlineColor: iconButtonFocusColor(palette, variant),
          outlineOffset: 2,
          outlineStyle: 'solid',
          outlineWidth: 2,
        });
      }
    }
  });

  test('a hidden ring keeps an author outline style, so the browser draws none', () => {
    expect(iconButtonFocusRing(theme.color, 'primary', false)).toEqual({
      outlineColor: 'transparent',
      outlineOffset: 0,
      outlineStyle: 'solid',
      outlineWidth: 0,
    });
  });

  test('the ring touches nothing that takes part in layout', () => {
    for (const visible of [true, false]) {
      expect(
        Object.keys(iconButtonFocusRing(theme.color, 'primary', visible)).sort(),
      ).toEqual([
        'outlineColor',
        'outlineOffset',
        'outlineStyle',
        'outlineWidth',
      ]);
    }
  });
});

describe('iconButtonSpinnerSize', () => {
  test('the spinner shares the icon box', () => {
    // Figma: Spinner 20 at Small and Medium, 24 at Large - the icon's box.
    expect(iconButtonSpinnerSize('small')).toBe(20);
    expect(iconButtonSpinnerSize('medium')).toBe(20);
    expect(iconButtonSpinnerSize('large')).toBe(24);
    for (const size of sizes) {
      expect(iconButtonSpinnerSize(size)).toBe(
        iconButtonSizeSpec(size).iconSize,
      );
    }
  });
});

describe('IconButton rendering', () => {
  test('every type and size paints its geometry and resting fill', () => {
    for (const [scheme, palette] of themes) {
      mockPalette = palette;
      for (const variant of variants) {
        for (const size of sizes) {
          const spec = iconButtonSizeSpec(size);
          const expected = iconButtonSurface(palette, variant);
          const tree = renderButton(
            <IconButton
              accessibilityLabel="Add"
              icon="plus"
              onPress={() => {}}
              size={size}
              variant={variant}
            />,
          );
          const target = targetStyle(tree.root);
          const surface = surfaceStyle(tree.root, size);
          expect({
            scheme,
            variant,
            size,
            target: [target.width, target.height],
            surface: [surface.width, surface.height],
            radius: surface.borderRadius,
            background: surface.backgroundColor,
          }).toEqual({
            scheme,
            variant,
            size,
            target: [spec.target, spec.target],
            surface: [spec.surface, spec.surface],
            radius: iconButtonRadius(variant, size),
            background: expected.background,
          });
          expect(surface.borderWidth).toBe(
            expected.border ? spec.borderWidth : 0,
          );
          unmountTree(tree);
        }
      }
    }
    mockPalette = theme.color;
  });

  test('the icon takes the type colour and the size box', () => {
    for (const [scheme, palette] of themes) {
      mockPalette = palette;
      for (const variant of variants) {
        for (const size of sizes) {
          const tree = renderButton(
            <IconButton
              accessibilityLabel="Add"
              icon="plus"
              onPress={() => {}}
              size={size}
              variant={variant}
            />,
          );
          const glyph = tree.root.findByType(Feather);
          expect({ scheme, variant, size, color: glyph.props.color, box: glyph.props.size }).toEqual({
            scheme,
            variant,
            size,
            color: iconButtonSurface(palette, variant).icon,
            box: iconButtonSizeSpec(size).iconSize,
          });
          unmountTree(tree);
        }
      }
    }
    mockPalette = theme.color;
  });

  test('a render slot receives size, colour and stroke width', () => {
    let received: IconButtonIconProps | undefined;
    renderButton(
      <IconButton
        accessibilityLabel="Add"
        icon={(props) => {
          received = props;
          return null;
        }}
        onPress={() => {}}
        size="large"
        variant="danger"
      />,
    );
    expect(received).toEqual({
      size: 24,
      color: theme.color.action.destructive.content,
      strokeWidth: 2,
    });
  });

  test('hover lifts a resting button but not a busy or disabled one', () => {
    const resting = renderButton(
      <IconButton accessibilityLabel="Add" icon="plus" onPress={() => {}} />,
    );
    act(() => {
      pressableProps(resting.root).onHoverIn();
    });
    expect(surfaceStyle(resting.root, 'medium').backgroundColor).toBe(
      theme.color.action.primary.hover,
    );
    unmountTree(resting);

    for (const blocked of [{ loading: true }, { disabled: true }] as const) {
      const tree = renderButton(
        <IconButton
          accessibilityLabel="Add"
          icon="plus"
          onPress={() => {}}
          {...blocked}
        />,
      );
      const before = surfaceStyle(tree.root, 'medium').backgroundColor;
      act(() => {
        pressableProps(tree.root).onHoverIn();
      });
      expect(surfaceStyle(tree.root, 'medium').backgroundColor).toBe(before);
      unmountTree(tree);
    }
  });

  test('On media hover paints an overlay over the scrim, not instead of it', () => {
    mockPalette = labelledPalette();
    const tree = renderButton(
      <IconButton
        accessibilityLabel="Close"
        icon="x"
        onPress={() => {}}
        variant="onMedia"
      />,
    );
    act(() => {
      pressableProps(tree.root).onHoverIn();
    });
    expect(surfaceStyle(tree.root, 'medium').backgroundColor).toBe(
      mockPalette.overlay.scrim,
    );
    const overlays = hostViews(tree.root).filter(
      (node) => flat(node).backgroundColor === mockPalette.state.hover,
    );
    expect(overlays).toHaveLength(1);
    expect(
      StyleSheet.flatten(overlays[0].props.style as ViewStyle).pointerEvents,
    ).toBe('none');
    mockPalette = theme.color;
  });
});

describe('IconButton loading', () => {
  test('loading shows one spinner in the icon colour and box', () => {
    for (const [scheme, palette] of themes) {
      mockPalette = palette;
      for (const variant of variants) {
        for (const size of sizes) {
          const tree = renderButton(
            <IconButton
              accessibilityLabel="Add"
              icon="plus"
              loading
              onPress={() => {}}
              size={size}
              variant={variant}
            />,
          );
          const spinners = tree.root.findAllByType(ActivityIndicator);
          expect(spinners).toHaveLength(1);
          expect({
            scheme,
            variant,
            size,
            color: spinners[0].props.color,
            box: spinners[0].props.size,
          }).toEqual({
            scheme,
            variant,
            size,
            // Figma binds the visible Spinner to the type's icon token.
            color: iconButtonSurface(palette, variant).icon,
            box: iconButtonSpinnerSize(size),
          });
          unmountTree(tree);
        }
      }
    }
    mockPalette = theme.color;
  });

  test('loading keeps the resting surface and the geometry', () => {
    for (const size of sizes) {
      const frames = [false, true].map((loading) => {
        const tree = renderButton(
          <IconButton
            accessibilityLabel="Add"
            icon="plus"
            loading={loading}
            onPress={() => {}}
            size={size}
          />,
        );
        const target = targetStyle(tree.root);
        const surface = surfaceStyle(tree.root, size);
        const frame = {
          target: [target.width, target.height],
          surface: [surface.width, surface.height],
          radius: surface.borderRadius,
          background: surface.backgroundColor,
        };
        unmountTree(tree);
        return frame;
      });
      expect({ size, loading: frames[1] }).toEqual({ size, loading: frames[0] });
    }
  });

  test('the icon stays mounted but invisible while loading', () => {
    const tree = renderButton(
      <IconButton
        accessibilityLabel="Add"
        icon="plus"
        loading
        onPress={() => {}}
      />,
    );
    expect(tree.root.findAllByType(Feather)).toHaveLength(1);
    const hidden = hostViews(tree.root).filter(
      (node) => flat(node).opacity === 0,
    );
    expect(hidden).toHaveLength(1);
  });

  test('the spinner intercepts nothing', () => {
    const tree = renderButton(
      <IconButton
        accessibilityLabel="Add"
        icon="plus"
        loading
        onPress={() => {}}
      />,
    );
    const wrapper = tree.root.findByType(ActivityIndicator).parent;
    const style = StyleSheet.flatten(wrapper?.props.style as ViewStyle);
    expect(style.pointerEvents).toBe('none');
    expect(style.position).toBe('absolute');
  });

  test('loading blocks activation but keeps the tab stop', () => {
    const onPress = jest.fn();
    const tree = renderButton(
      <IconButton
        accessibilityLabel="Add"
        icon="plus"
        loading
        onPress={onPress}
      />,
    );
    const props = pressableProps(tree.root);
    act(() => {
      props.onPress();
      props.onPress();
    });
    expect(onPress).not.toHaveBeenCalled();
    // Busy, not disabled: it keeps keyboard focus while it works.
    expect(props.accessibilityState).toEqual({ busy: true, disabled: false });
    expect(props['aria-busy']).toBe(true);
    expect(props.focusable).toBe(true);
  });

  test('no spinner when it is not loading', () => {
    const tree = renderButton(
      <IconButton accessibilityLabel="Add" icon="plus" onPress={() => {}} />,
    );
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    expect(pressableProps(tree.root)['aria-busy']).toBe(false);
  });
});

describe('IconButton accessibility', () => {
  test('the accessible name is required and reaches the control', () => {
    const tree = renderButton(
      <IconButton
        accessibilityLabel="Delete expense"
        icon="trash-2"
        onPress={() => {}}
        variant="danger"
      />,
    );
    expect(pressableProps(tree.root).accessibilityLabel).toBe('Delete expense');
  });

  test('a hint reaches the control when given', () => {
    const tree = renderButton(
      <IconButton
        accessibilityHint="Removes it for good"
        accessibilityLabel="Delete expense"
        icon="trash-2"
        onPress={() => {}}
      />,
    );
    expect(pressableProps(tree.root).accessibilityHint).toBe(
      'Removes it for good',
    );
  });

  test('disabled reports itself and leaves the focus order', () => {
    for (const variant of variants) {
      const tree = renderButton(
        <IconButton
          accessibilityLabel="Add"
          disabled
          icon="plus"
          onPress={() => {}}
          variant={variant}
        />,
      );
      const props = pressableProps(tree.root);
      expect(props.accessibilityState).toEqual({ busy: false, disabled: true });
      expect(props['aria-busy']).toBe(false);
      expect(props.focusable).toBe(false);
      unmountTree(tree);
    }
  });

  test('disabled does not call onPress', () => {
    const onPress = jest.fn();
    const tree = renderButton(
      <IconButton
        accessibilityLabel="Add"
        disabled
        icon="plus"
        onPress={onPress}
      />,
    );
    act(() => {
      pressableProps(tree.root).onPress();
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  test('a resting button calls onPress once per press', () => {
    const onPress = jest.fn();
    const tree = renderButton(
      <IconButton accessibilityLabel="Add" icon="plus" onPress={onPress} />,
    );
    act(() => {
      pressableProps(tree.root).onPress();
      pressableProps(tree.root).onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  test('the two busy channels can never disagree', () => {
    for (const loading of [false, true]) {
      for (const disabled of [false, true]) {
        const props = pressableProps(
          renderButton(
            <IconButton
              accessibilityLabel="Add"
              disabled={disabled}
              icon="plus"
              loading={loading}
              onPress={() => {}}
            />,
          ).root,
        );
        expect({
          loading,
          disabled,
          agree: props['aria-busy'] === props.accessibilityState.busy,
        }).toEqual({ loading, disabled, agree: true });
      }
    }
  });

  test('native draws no ring, and the control carries none of its own', () => {
    // Platform.OS is native under jest-expo; the web ring is covered by
    // iconButtonFocusRing above and by the browser check in HANDOFF.md.
    const tree = renderButton(
      <IconButton accessibilityLabel="Add" icon="plus" onPress={() => {}} />,
    );
    const target = targetStyle(tree.root) as Record<string, unknown>;
    const surface = surfaceStyle(tree.root, 'medium') as Record<string, unknown>;
    for (const key of ['outlineColor', 'outlineOffset', 'outlineStyle', 'outlineWidth']) {
      expect({ key, target: target[key], surface: surface[key] }).toEqual({
        key,
        target: undefined,
        surface: undefined,
      });
    }
  });
});

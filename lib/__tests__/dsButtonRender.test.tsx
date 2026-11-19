import { describe, expect, jest, test } from '@jest/globals';
import Feather from '@expo/vector-icons/Feather';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import { act, create, type ReactTestInstance } from 'react-test-renderer';

import {
  Button,
  type ButtonColors,
  type ButtonIcon,
  type ButtonIconProps,
  type ButtonSize,
  type ButtonVariant,
  buttonIconColor,
  buttonSizeSpec,
  buttonSpinnerSize,
  buttonSurface,
} from '../../components/ds/Button';
import { labelledPalette } from '../__fixtures__/buttonPalette';
import { darkColor, theme } from '../theme';

// The palette the mocked ThemeContext hands to the component under test, so
// one render pass can be repeated for light and for dark.
let mockPalette: ButtonColors = theme.color;

jest.mock('../../contexts/ThemeContext', () => ({
  useColors: () => mockPalette,
}));

// The real Feather loads its icon font asynchronously and sets state after the
// test has finished, which only produces act() noise here. The stand-in keeps
// the props the Button passes, which is what these tests assert.
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

const variants: ButtonVariant[] = [
  'primary',
  'neutral',
  'surface',
  'outline',
  'ghost',
  'danger',
];

const sizes: ButtonSize[] = ['medium', 'large'];

const themes: [string, ButtonColors][] = [
  ['light', theme.color],
  ['dark', darkColor],
];

function renderButton(node: React.ReactElement) {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(node);
  });
  if (!tree) {
    throw new Error('Button did not render');
  }
  return tree;
}

function unmountTree(tree: ReturnType<typeof create>) {
  act(() => {
    tree.unmount();
  });
}

type PressableProps = {
  accessibilityState: { busy: boolean; disabled: boolean };
  'aria-busy': boolean;
  focusable: boolean;
  onBlur: () => void;
  onFocus: () => void;
  onHoverIn: () => void;
  onPress: () => void;
};

// The Pressable element itself: its props are the ones the component passed,
// so the press guard and the accessibility flags can be read back.
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
// The outermost host view is the one Pressable resolves our style function on.
function rootStyle(root: ReactTestInstance): ViewStyle {
  const host = root.findAll(
    (node) => typeof node.type === 'string' && node.type.toLowerCase() === 'view',
  )[0];
  return StyleSheet.flatten(host.props.style as ViewStyle);
}

// The row that holds the leading slot, the label and the trailing slot. It is
// the only host view carrying the DS gap, so an empty slot adding space would
// have to show up as an extra child here.
function contentRow(root: ReactTestInstance, size: ButtonSize = 'medium') {
  return root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      node.type.toLowerCase() === 'view' &&
      StyleSheet.flatten(node.props.style as ViewStyle).gap ===
        buttonSizeSpec(size).gap,
  )[0];
}

// Glyph names in document order: leading first, trailing last.
function iconNames(root: ReactTestInstance): string[] {
  return root.findAllByType(Feather).map((node) => String(node.props.name));
}

type IconProbe = { icon: ButtonIcon; seen: () => ButtonIconProps | undefined };

// A render-function slot that records what the Button handed it.
function probe(slot: string): IconProbe {
  let received: ButtonIconProps | undefined;
  return {
    icon: (props: ButtonIconProps) => {
      received = props;
      return <Text>{slot}</Text>;
    },
    seen: () => received,
  };
}

describe('Button rendering', () => {
  test('every type and size resolves its DS geometry and resting fill', () => {
    for (const [name, scheme] of themes) {
      mockPalette = scheme;
      for (const variant of variants) {
        for (const size of sizes) {
          const spec = buttonSizeSpec(size);
          const expected = buttonSurface(scheme, variant);
          const tree = renderButton(
            <Button label="Label" onPress={() => {}} size={size} variant={variant} />,
          );
          const style = rootStyle(tree.root);

          expect({ name, variant, size, style: {
            height: style.height,
            borderRadius: style.borderRadius,
            minWidth: style.minWidth,
            paddingHorizontal: style.paddingHorizontal,
            backgroundColor: style.backgroundColor,
          } }).toEqual({ name, variant, size, style: {
            height: spec.height,
            borderRadius: spec.radius,
            minWidth: spec.minWidth,
            paddingHorizontal: spec.paddingHorizontal,
            backgroundColor: expected.background,
          } });
          // Only outline carries a resting stroke.
          expect(style.borderWidth).toBe(
            expected.border ? theme.scale.stroke.hairline : 0,
          );
          unmountTree(tree);
        }
      }
    }
    mockPalette = theme.color;
  });

  test('outline paints no fill and keeps border/default in every state', () => {
    // Figma 591:942 / 591:978: no fill token, border/default throughout.
    for (const [, scheme] of themes) {
      mockPalette = scheme;
      for (const size of sizes) {
        for (const disabled of [false, true]) {
          const tree = renderButton(
            <Button
              disabled={disabled}
              label="Label"
              onPress={() => {}}
              size={size}
              variant="outline"
            />,
          );
          const style = rootStyle(tree.root);
          expect(style.borderColor).toBe(scheme.border.default);
          expect(style.borderWidth).toBe(theme.scale.stroke.hairline);
          if (!disabled) {
            expect(style.backgroundColor).toBe('transparent');
          }
          unmountTree(tree);
        }
      }
    }
    mockPalette = theme.color;
  });

  test('disabled danger renders the primary disabled pair', () => {
    // Figma 591:1158 / 591:1203: action/primary/disabled, no destructive hue.
    for (const [, scheme] of themes) {
      mockPalette = scheme;
      for (const size of sizes) {
        const tree = renderButton(
          <Button
            disabled
            label="Label"
            onPress={() => {}}
            size={size}
            variant="danger"
          />,
        );
        expect(rootStyle(tree.root).backgroundColor).toBe(
          scheme.action.primary.disabled,
        );
        expect(
          StyleSheet.flatten(tree.root.findByType(Text).props.style).color,
        ).toBe(scheme.action.primary.disabledContent);
        unmountTree(tree);
      }
    }
    mockPalette = theme.color;
  });

  test('disabled renders the disabled fill and reports the state', () => {
    for (const [, scheme] of themes) {
      mockPalette = scheme;
      for (const variant of variants) {
        const tree = renderButton(
          <Button disabled label="Label" onPress={() => {}} variant={variant} />,
        );
        expect(rootStyle(tree.root).backgroundColor).toBe(
          buttonSurface(scheme, variant, { disabled: true }).background,
        );
        const pressable = { props: pressableProps(tree.root) };
        expect(pressable.props.accessibilityState).toEqual({
          busy: false,
          disabled: true,
        });
        // A disabled control leaves the focus order, so it can never show a ring.
        expect(pressable.props.focusable).toBe(false);
        unmountTree(tree);
      }
    }
    mockPalette = theme.color;
  });

  test('disabled does not call onPress', () => {
    const onPress = jest.fn();
    const tree = renderButton(
      <Button disabled label="Label" onPress={onPress} />,
    );
    act(() => {
      pressableProps(tree.root).onPress();
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  test('loading keeps the label mounted, shows the spinner and blocks presses', () => {
    const onPress = jest.fn();
    const tree = renderButton(<Button label="Label" loading onPress={onPress} />);

    // The label stays mounted but invisible, so the button keeps its width.
    const label = tree.root.findByType(Text);
    expect(label.props.children).toBe('Label');
    expect(StyleSheet.flatten(label.props.style).opacity).toBeUndefined();
    const labelRow = tree.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        node.type.toLowerCase() === 'view' &&
        StyleSheet.flatten(node.props.style as ViewStyle).opacity === 0,
    );
    expect(labelRow).toHaveLength(1);

    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(1);

    const pressable = { props: pressableProps(tree.root) };
    // Loading is busy, not disabled: it keeps keyboard focus.
    expect(pressable.props.accessibilityState).toEqual({
      busy: true,
      disabled: false,
    });
    expect(pressable.props.focusable).toBe(true);

    act(() => {
      pressable.props.onPress();
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  test('a resting button calls onPress once per press', () => {
    const onPress = jest.fn();
    const tree = renderButton(<Button label="Label" onPress={onPress} />);
    const pressable = { props: pressableProps(tree.root) };
    act(() => {
      pressable.props.onPress();
      pressable.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });

  test('hover lifts a resting button but not a busy or disabled one', () => {
    const resting = renderButton(<Button label="Label" onPress={() => {}} />);
    act(() => {
      pressableProps(resting.root).onHoverIn();
    });
    expect(rootStyle(resting.root).backgroundColor).toBe(
      theme.color.action.primary.hover,
    );
    unmountTree(resting);

    for (const blocked of [{ loading: true }, { disabled: true }] as const) {
      const tree = renderButton(
        <Button label="Label" onPress={() => {}} {...blocked} />,
      );
      const before = rootStyle(tree.root).backgroundColor;
      act(() => {
        pressableProps(tree.root).onHoverIn();
      });
      expect(rootStyle(tree.root).backgroundColor).toBe(before);
      unmountTree(tree);
    }
  });

  test('the label uses the DS button typography and the surface content colour', () => {
    for (const size of sizes) {
      const tree = renderButton(
        <Button label="Label" onPress={() => {}} size={size} />,
      );
      const style = StyleSheet.flatten(tree.root.findByType(Text).props.style);
      expect(style.fontSize).toBe(buttonSizeSpec(size).typography.fontSize);
      expect(style.fontFamily).toBe(buttonSizeSpec(size).typography.fontFamily);
      expect(style.color).toBe(theme.color.action.primary.content);
      unmountTree(tree);
    }
  });

  test('fullWidth stretches instead of hugging its label', () => {
    // Jest lays nothing out, so this pins the declarations that decide the
    // width; the measured geometry is checked in the browser through
    // /ds-playground and recorded in HANDOFF.md.
    const hugging = renderButton(<Button label="Label" onPress={() => {}} />);
    const hug = rootStyle(hugging.root);
    expect(hug.alignSelf).toBe('flex-start');
    // Nothing may pin the hug width: it is the label plus the padding.
    expect(hug.width).toBeUndefined();
    expect(hug.flexGrow).toBeUndefined();
    unmountTree(hugging);

    const stretched = renderButton(
      <Button fullWidth label="Label" onPress={() => {}} />,
    );
    const full = rootStyle(stretched.root);
    // alignSelf alone only widens in a column, where the cross axis is the
    // width. width: '100%' is what carries a row parent, whose cross axis is
    // the height.
    expect(full.alignSelf).toBe('stretch');
    expect(full.width).toBe('100%');
    unmountTree(stretched);
  });

  test('fullWidth keeps the DS minimum width and the resting height', () => {
    for (const size of sizes) {
      const spec = buttonSizeSpec(size);
      const style = (fullWidth: boolean) => {
        const tree = renderButton(
          <Button
            fullWidth={fullWidth}
            label="Label"
            onPress={() => {}}
            size={size}
          />,
        );
        const resolved = { ...rootStyle(tree.root) };
        unmountTree(tree);
        return resolved;
      };
      const hug = style(false);
      const full = style(true);
      expect({ size, minWidth: full.minWidth, height: full.height }).toEqual({
        size,
        minWidth: spec.minWidth,
        height: spec.height,
      });
      // Width is the only thing fullWidth is allowed to change.
      expect({ ...full, alignSelf: null, width: null }).toEqual({
        ...hug,
        alignSelf: null,
        width: null,
      });
    }
  });

  test('loading does not resize a fullWidth button', () => {
    for (const size of sizes) {
      const frames = [false, true].map((loading) => {
        const tree = renderButton(
          <Button
            fullWidth
            label="Label"
            leadingIcon="check"
            loading={loading}
            onPress={() => {}}
            size={size}
          />,
        );
        const style = rootStyle(tree.root);
        const frame = {
          alignSelf: style.alignSelf,
          height: style.height,
          minWidth: style.minWidth,
          paddingHorizontal: style.paddingHorizontal,
          width: style.width,
        };
        unmountTree(tree);
        return frame;
      });
      expect({ size, loading: frames[1] }).toEqual({
        size,
        loading: frames[0],
      });
    }
  });

  test('the spinner overlay declines events through style, not the deprecated prop', () => {
    // React Native warns on every render for the pointerEvents prop, and the
    // overlay must still let presses through to the button underneath.
    const tree = renderButton(<Button label="Label" loading onPress={() => {}} />);
    const overlay = tree.root
      .findAllByType(ActivityIndicator)[0]
      .parent;
    expect(overlay).not.toBeNull();
    expect(overlay?.props.pointerEvents).toBeUndefined();
  });

  test('the deprecated icon prop still fills the slot it names', () => {
    for (const position of ['leading', 'trailing'] as const) {
      const tree = renderButton(
        <Button
          icon={<Text>legacy</Text>}
          iconPosition={position}
          label="Label"
          onPress={() => {}}
        />,
      );
      const texts = tree.root.findAllByType(Text).map((n) => n.props.children);
      expect(texts).toEqual(
        position === 'leading' ? ['legacy', 'Label'] : ['Label', 'legacy'],
      );
      unmountTree(tree);
    }
  });

  test('a new slot wins over the deprecated icon prop', () => {
    const tree = renderButton(
      <Button
        icon={<Text>legacy</Text>}
        label="Label"
        leadingIcon="check"
        onPress={() => {}}
      />,
    );
    expect(iconNames(tree.root)).toEqual(['check']);
    // The legacy node is dropped, not stacked on top of the new slot.
    expect(
      tree.root
        .findAllByType(Text)
        .some((node) => node.props.children === 'legacy'),
    ).toBe(false);
  });

  test('native draws no ring and mounts no overlay for it', () => {
    // Platform.OS is native under jest-expo. The ring is a web affordance:
    // the outline props must not reach a native view, and the absolutely
    // positioned overlay that used to stand in for them is gone. The web
    // path is covered by buttonFocusRing / rendersFocusRing in
    // dsButton.test.ts and by the browser check recorded in HANDOFF.md.
    for (const variant of variants) {
      const tree = renderButton(
        <Button label="Label" onPress={() => {}} variant={variant} />,
      );
      act(() => {
        pressableProps(tree.root).onFocus();
      });
      const style = rootStyle(tree.root) as Record<string, unknown>;
      for (const key of [
        'outlineColor',
        'outlineOffset',
        'outlineStyle',
        'outlineWidth',
      ]) {
        expect({ variant, key, value: style[key] }).toEqual({
          variant,
          key,
          value: undefined,
        });
      }
      const overlays = tree.root.findAll(
        (node) =>
          typeof node.type === 'string' &&
          node.type.toLowerCase() === 'view' &&
          StyleSheet.flatten(node.props.style as ViewStyle).position ===
            'absolute' &&
          StyleSheet.flatten(node.props.style as ViewStyle).borderWidth ===
            theme.scale.stroke.focusRing,
      );
      expect(overlays).toHaveLength(0);
      unmountTree(tree);
    }
  });

  test('focus and blur never move the button', () => {
    // Whatever the ring does, it is painted outside the box: the frame the
    // layout engine sees is identical focused and unfocused.
    for (const size of sizes) {
      const tree = renderButton(
        <Button label="Label" onPress={() => {}} size={size} />,
      );
      const resting = { ...rootStyle(tree.root) };
      act(() => {
        pressableProps(tree.root).onFocus();
      });
      expect(rootStyle(tree.root)).toEqual(resting);
      act(() => {
        pressableProps(tree.root).onBlur();
      });
      expect(rootStyle(tree.root)).toEqual(resting);
      unmountTree(tree);
    }
  });

  test('loading is announced through both accessibility channels', () => {
    // accessibilityState is what native reads. react-native-web reads only
    // the aria-* props and never looks at accessibilityState, so without
    // aria-busy a loading button announces nothing in a browser. RN
    // documents aria-busy as the alias, so one flag serves both.
    for (const variant of variants) {
      const resting = pressableProps(
        renderButton(
          <Button label="Label" onPress={() => {}} variant={variant} />,
        ).root,
      );
      expect({ variant, state: resting.accessibilityState.busy, aria: resting['aria-busy'] }).toEqual({
        variant,
        state: false,
        aria: false,
      });

      const busy = pressableProps(
        renderButton(
          <Button label="Label" loading onPress={() => {}} variant={variant} />,
        ).root,
      );
      expect({ variant, state: busy.accessibilityState.busy, aria: busy['aria-busy'] }).toEqual({
        variant,
        state: true,
        aria: true,
      });
    }
  });

  test('the two busy channels can never disagree', () => {
    for (const loading of [false, true]) {
      for (const disabled of [false, true]) {
        const props = pressableProps(
          renderButton(
            <Button
              disabled={disabled}
              label="Label"
              loading={loading}
              onPress={() => {}}
            />,
          ).root,
        );
        expect({
          loading,
          disabled,
          agree: props['aria-busy'] === props.accessibilityState.busy,
          busy: props['aria-busy'],
        }).toEqual({ loading, disabled, agree: true, busy: loading });
      }
    }
  });

  test('leaving loading clears busy without touching disabled', () => {
    const tree = renderButton(<Button label="Label" loading onPress={() => {}} />);
    expect(pressableProps(tree.root)['aria-busy']).toBe(true);
    act(() => {
      tree.update(<Button label="Label" onPress={() => {}} />);
    });
    const settled = pressableProps(tree.root);
    expect(settled['aria-busy']).toBe(false);
    expect(settled.accessibilityState).toEqual({ busy: false, disabled: false });
    // The reset must not cost the button its place in the focus order.
    expect(settled.focusable).toBe(true);
  });

  test('a disabled button is not busy', () => {
    const props = pressableProps(
      renderButton(
        <Button disabled label="Label" onPress={() => {}} />,
      ).root,
    );
    expect(props['aria-busy']).toBe(false);
    expect(props.accessibilityState).toEqual({ busy: false, disabled: true });
    expect(props.focusable).toBe(false);
  });

  test('a disabled button leaves the focus order entirely', () => {
    // No tab stop means the browser can never raise a ring on it.
    for (const variant of variants) {
      const tree = renderButton(
        <Button disabled label="Label" onPress={() => {}} variant={variant} />,
      );
      expect(pressableProps(tree.root).focusable).toBe(false);
      unmountTree(tree);
    }
  });
});

describe('Button icon slots', () => {
  // The labelled palette gives every token a distinct value, so a slot reading
  // the neighbouring token cannot pass by coincidence.
  const palettes: [string, ButtonColors][] = [
    ['light', theme.color],
    ['dark', darkColor],
    ['labelled', labelledPalette()],
  ];

  test('all four slot configurations render in order', () => {
    for (const variant of variants) {
      for (const size of sizes) {
        const cases: [ButtonIcon | undefined, ButtonIcon | undefined, string[]][] =
          [
            [undefined, undefined, []],
            ['arrow-left', undefined, ['arrow-left']],
            [undefined, 'arrow-right', ['arrow-right']],
            ['arrow-left', 'arrow-right', ['arrow-left', 'arrow-right']],
          ];
        for (const [leading, trailing, expected] of cases) {
          const tree = renderButton(
            <Button
              label="Label"
              leadingIcon={leading}
              onPress={() => {}}
              size={size}
              trailingIcon={trailing}
              variant={variant}
            />,
          );
          expect({ variant, size, names: iconNames(tree.root) }).toEqual({
            variant,
            size,
            names: expected,
          });
          unmountTree(tree);
        }
      }
    }
  });

  test('an empty slot renders nothing at all, so it cannot add a gap', () => {
    // RN applies `gap` between rendered children only: with the label alone
    // there is nothing for the gap to separate.
    const bare = renderButton(<Button label="Label" onPress={() => {}} />);
    expect(contentRow(bare.root).children).toHaveLength(1);
    unmountTree(bare);

    const one = renderButton(
      <Button label="Label" leadingIcon="check" onPress={() => {}} />,
    );
    expect(contentRow(one.root).children).toHaveLength(2);
    unmountTree(one);

    const both = renderButton(
      <Button
        label="Label"
        leadingIcon="check"
        onPress={() => {}}
        trailingIcon="chevron-right"
      />,
    );
    expect(contentRow(both.root).children).toHaveLength(3);
    unmountTree(both);
  });

  test('the Button sizes and tints its icons in every type, size and theme', () => {
    for (const [scheme, palette] of palettes) {
      mockPalette = palette;
      for (const variant of variants) {
        for (const size of sizes) {
          for (const disabled of [false, true]) {
            const tree = renderButton(
              <Button
                disabled={disabled}
                label="Label"
                leadingIcon="arrow-left"
                onPress={() => {}}
                size={size}
                trailingIcon="arrow-right"
                variant={variant}
              />,
            );
            const icons = tree.root.findAllByType(Feather);
            expect(icons).toHaveLength(2);
            for (const node of icons) {
              expect({
                scheme,
                variant,
                size,
                disabled,
                size_: node.props.size,
                color: node.props.color,
              }).toEqual({
                scheme,
                variant,
                size,
                disabled,
                size_: buttonSizeSpec(size).iconSize,
                color: buttonIconColor(palette, variant, { disabled }),
              });
            }
            unmountTree(tree);
          }
        }
      }
    }
    mockPalette = theme.color;
  });

  test('medium icons are 20 and large icons are 24', () => {
    for (const [size, expected] of [
      ['medium', 20],
      ['large', 24],
    ] as const) {
      const tree = renderButton(
        <Button
          label="Label"
          leadingIcon="check"
          onPress={() => {}}
          size={size}
        />,
      );
      expect(tree.root.findByType(Feather).props.size).toBe(expected);
      unmountTree(tree);
    }
  });

  test('a render slot receives size, colour and stroke width from the Button', () => {
    mockPalette = labelledPalette();
    for (const variant of variants) {
      for (const size of sizes) {
        for (const disabled of [false, true]) {
          const leading = probe('leading');
          const trailing = probe('trailing');
          const tree = renderButton(
            <Button
              disabled={disabled}
              label="Label"
              leadingIcon={leading.icon}
              onPress={() => {}}
              size={size}
              trailingIcon={trailing.icon}
              variant={variant}
            />,
          );
          const expected: ButtonIconProps = {
            size: buttonSizeSpec(size).iconSize,
            color: buttonIconColor(mockPalette, variant, { disabled }),
            strokeWidth: buttonSizeSpec(size).iconStrokeWidth,
          };
          expect(leading.seen()).toEqual(expected);
          expect(trailing.seen()).toEqual(expected);
          expect(expected.strokeWidth).toBe(2);
          unmountTree(tree);
        }
      }
    }
    mockPalette = theme.color;
  });

  test('loading keeps every slot configuration at its resting width', () => {
    // There is no layout engine here, so width is pinned by what determines
    // it: the same geometry on the frame, the same children in the content
    // row, and one opacity flag on the row itself.
    const configurations: [ButtonIcon | undefined, ButtonIcon | undefined][] = [
      [undefined, undefined],
      ['arrow-left', undefined],
      [undefined, 'arrow-right'],
      ['arrow-left', 'arrow-right'],
    ];

    for (const size of sizes) {
      for (const [leading, trailing] of configurations) {
        const frames: ViewStyle[] = [];
        const rowChildren: number[] = [];
        const rowOpacity: ViewStyle['opacity'][] = [];

        for (const loading of [false, true]) {
          const tree = renderButton(
            <Button
              label="Label"
              leadingIcon={leading}
              loading={loading}
              onPress={() => {}}
              size={size}
              trailingIcon={trailing}
            />,
          );
          const style = rootStyle(tree.root);
          frames.push({
            height: style.height,
            minWidth: style.minWidth,
            paddingHorizontal: style.paddingHorizontal,
            alignSelf: style.alignSelf,
          });
          const row = contentRow(tree.root, size);
          rowChildren.push(row.children.length);
          rowOpacity.push(
            StyleSheet.flatten(row.props.style as ViewStyle).opacity,
          );
          expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(
            loading ? 1 : 0,
          );
          unmountTree(tree);
        }

        expect(frames[1]).toEqual(frames[0]);
        expect(rowChildren[1]).toBe(rowChildren[0]);
        // Default is fully opaque, loading only hides the row in place.
        expect(rowOpacity).toEqual([undefined, 0]);
      }
    }
  });

  test('loading hides icons in place rather than unmounting them', () => {
    const tree = renderButton(
      <Button
        label="Label"
        leadingIcon="arrow-left"
        loading
        onPress={() => {}}
        trailingIcon="arrow-right"
      />,
    );
    expect(iconNames(tree.root)).toEqual(['arrow-left', 'arrow-right']);
    // The icons carry no opacity of their own: the row hides them.
    for (const node of tree.root.findAllByType(Feather)) {
      expect(node.props.style).toBeUndefined();
    }
  });
});

describe('Button spinner', () => {
  const palettes: [string, ButtonColors][] = [
    ['light', theme.color],
    ['dark', darkColor],
    ['labelled', labelledPalette()],
  ];

  // Every way the content row can be filled, because the spinner sits on top
  // of it and must not depend on what it covers.
  const slotConfigurations: [ButtonIcon | undefined, ButtonIcon | undefined][] =
    [
      [undefined, undefined],
      ['arrow-left', undefined],
      [undefined, 'arrow-right'],
      ['arrow-left', 'arrow-right'],
    ];

  test('the spinner takes its box from the button size, in every type and theme', () => {
    for (const [scheme, palette] of palettes) {
      mockPalette = palette;
      for (const variant of variants) {
        for (const size of sizes) {
          for (const [leading, trailing] of slotConfigurations) {
            const tree = renderButton(
              <Button
                label="Label"
                leadingIcon={leading}
                loading
                onPress={() => {}}
                size={size}
                trailingIcon={trailing}
                variant={variant}
              />,
            );
            const spinner = tree.root.findByType(ActivityIndicator);
            expect({ scheme, variant, size, box: spinner.props.size }).toEqual({
              scheme,
              variant,
              size,
              box: buttonSpinnerSize(size),
            });
            unmountTree(tree);
          }
        }
      }
    }
    mockPalette = theme.color;
  });

  test('the spinner carries the active label colour of its type', () => {
    // Figma binds it per type: Primary 591:885 -> action/primary/content,
    // Surface 901:1240 -> text/primary, Danger 591:1200 ->
    // action/destructive/content; each is that type's own label token.
    for (const [scheme, palette] of palettes) {
      mockPalette = palette;
      for (const variant of variants) {
        for (const size of sizes) {
          const tree = renderButton(
            <Button
              label="Label"
              loading
              onPress={() => {}}
              size={size}
              variant={variant}
            />,
          );
          expect({
            scheme,
            variant,
            color: tree.root.findByType(ActivityIndicator).props.color,
          }).toEqual({
            scheme,
            variant,
            color: buttonSurface(palette, variant).content,
          });
          unmountTree(tree);
        }
      }
    }
    mockPalette = theme.color;
  });

  test('medium spins at 20 and large at 24', () => {
    for (const [size, expected] of [
      ['medium', 20],
      ['large', 24],
    ] as const) {
      const tree = renderButton(
        <Button label="Label" loading onPress={() => {}} size={size} />,
      );
      expect(tree.root.findByType(ActivityIndicator).props.size).toBe(expected);
      unmountTree(tree);
    }
  });

  test('the spinner is centred on the button and out of the layout flow', () => {
    const tree = renderButton(<Button label="Label" loading onPress={() => {}} />);
    const spinner = tree.root.findByType(ActivityIndicator);
    const wrapper = spinner.parent;
    expect(wrapper).not.toBeNull();
    const style = StyleSheet.flatten(wrapper?.props.style as ViewStyle);
    expect(style).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
    });
    // Absolute and non-interactive, so it cannot displace the content row
    // or swallow a press meant for the button.
    expect(style.pointerEvents).toBe('none');
  });

  test('switching to loading leaves the frame geometry untouched', () => {
    for (const variant of variants) {
      for (const size of sizes) {
        for (const [leading, trailing] of slotConfigurations) {
          const frames: ViewStyle[] = [];
          for (const loading of [false, true]) {
            const tree = renderButton(
              <Button
                label="Label"
                leadingIcon={leading}
                loading={loading}
                onPress={() => {}}
                size={size}
                trailingIcon={trailing}
                variant={variant}
              />,
            );
            const style = rootStyle(tree.root);
            frames.push({
              height: style.height,
              minWidth: style.minWidth,
              paddingHorizontal: style.paddingHorizontal,
              borderRadius: style.borderRadius,
              borderWidth: style.borderWidth,
              alignSelf: style.alignSelf,
            });
            unmountTree(tree);
          }
          expect({ variant, size, frame: frames[1] }).toEqual({
            variant,
            size,
            frame: frames[0],
          });
        }
      }
    }
  });

  test('a spinning button of any type still refuses a second press', () => {
    for (const variant of variants) {
      const onPress = jest.fn();
      const tree = renderButton(
        <Button label="Label" loading onPress={onPress} variant={variant} />,
      );
      const props = pressableProps(tree.root);
      act(() => {
        props.onPress();
        props.onPress();
      });
      expect(onPress).not.toHaveBeenCalled();
      // Busy, not disabled: it keeps keyboard focus while it works.
      expect(props.accessibilityState).toEqual({ busy: true, disabled: false });
      expect(props.focusable).toBe(true);
      unmountTree(tree);
    }
  });
});

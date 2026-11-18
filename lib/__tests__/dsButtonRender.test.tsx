import { describe, expect, jest, test } from '@jest/globals';
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
  type ButtonSize,
  type ButtonVariant,
  buttonSizeSpec,
  buttonSurface,
} from '../../components/ds/Button';
import { darkColor, theme } from '../theme';

// The palette the mocked ThemeContext hands to the component under test, so
// one render pass can be repeated for light and for dark.
let mockPalette: ButtonColors = theme.color;

jest.mock('../../contexts/ThemeContext', () => ({
  useColors: () => mockPalette,
}));

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
  focusable: boolean;
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
    const hugging = renderButton(<Button label="Label" onPress={() => {}} />);
    expect(rootStyle(hugging.root).alignSelf).toBe('flex-start');
    const stretched = renderButton(
      <Button fullWidth label="Label" onPress={() => {}} />,
    );
    expect(rootStyle(stretched.root).alignSelf).toBe('stretch');
  });

  test('native renders no focus ring overlay', () => {
    // Platform.OS is native under jest-expo; the web ring is covered by
    // rendersFocusRing in dsButton.test.ts.
    const tree = renderButton(<Button label="Label" onPress={() => {}} />);
    act(() => {
      pressableProps(tree.root).onFocus();
    });
    const rings = tree.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        node.type.toLowerCase() === 'view' &&
        StyleSheet.flatten(node.props.style as ViewStyle).position === 'absolute' &&
        StyleSheet.flatten(node.props.style as ViewStyle).borderWidth ===
          theme.scale.stroke.focusRing,
    );
    expect(rings).toHaveLength(0);
  });
});

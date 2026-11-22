import { describe, expect, jest, test } from '@jest/globals';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { act, create, type ReactTestInstance } from 'react-test-renderer';

import {
  Toggle,
  type ToggleColors,
  type ToggleKeyEvent,
  type TogglePosition,
  type ToggleSize,
  isToggleKey,
  toggleCopyOffset,
  toggleFocusRing,
  toggleKeyboardProps,
  toggleSizeSpec,
  toggleSurface,
} from '../../components/ds/Toggle';
import { labelledPalette } from '../__fixtures__/buttonPalette';
import { darkColor, theme } from '../theme';

let mockPalette: ToggleColors = theme.color;

jest.mock('../../contexts/ThemeContext', () => ({
  useColors: () => mockPalette,
}));

const sizes: ToggleSize[] = ['small', 'medium', 'large'];
const positions: TogglePosition[] = ['leading', 'trailing'];
const states = ['default', 'hover', 'pressed', 'disabled'] as const;
const palettes: [string, ToggleColors][] = [
  ['light', theme.color],
  ['dark', darkColor],
  ['labelled', labelledPalette()],
];

function renderToggle(node: React.ReactElement) {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(node);
  });
  if (!tree) {
    throw new Error('Toggle did not render');
  }
  return tree;
}

function unmountTree(tree: ReturnType<typeof create>) {
  act(() => tree.unmount());
}

type PressableProps = {
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityRole: string;
  accessibilityState: { checked: boolean; disabled: boolean };
  'aria-checked': boolean;
  'aria-describedby'?: string;
  'aria-disabled': boolean;
  disabled: boolean;
  focusable: boolean;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onPress: () => void;
  tabIndex: 0 | -1;
};

function pressable(root: ReactTestInstance): ReactTestInstance {
  return root.find(
    (node) =>
      typeof node.type !== 'string' &&
      node.props.accessibilityRole === 'switch' &&
      typeof node.props.onPress === 'function',
  );
}

function props(root: ReactTestInstance): PressableProps {
  return pressable(root).props as PressableProps;
}

function hostByTestId(root: ReactTestInstance, testID: string) {
  return root.find(
    (node) =>
      typeof node.type === 'string' && node.props.testID === testID,
  );
}

function flat(node: ReactTestInstance): ViewStyle {
  return StyleSheet.flatten((node.props.style ?? {}) as ViewStyle) ?? {};
}

function texts(root: ReactTestInstance) {
  return root.findAll(
    (node) =>
      typeof node.type === 'string' && node.type.toLowerCase() === 'text',
  );
}

function keyEvent(key: string, repeat = false) {
  const preventDefault = jest.fn();
  return {
    event: { key, repeat, preventDefault } satisfies ToggleKeyEvent,
    preventDefault,
  };
}

describe('toggleSizeSpec', () => {
  test('matches the current Figma geometry for all three sizes', () => {
    expect(toggleSizeSpec('small')).toMatchObject({
      trackWidth: 32,
      trackHeight: 20,
      thumb: 14,
      thumbOffX: 3,
      thumbOnX: 15,
      focusWidth: 40,
      focusHeight: 28,
    });
    expect(toggleSizeSpec('medium')).toMatchObject({
      trackWidth: 40,
      trackHeight: 24,
      thumb: 18,
      thumbOffX: 3,
      thumbOnX: 19,
      focusWidth: 48,
      focusHeight: 32,
    });
    expect(toggleSizeSpec('large')).toMatchObject({
      trackWidth: 48,
      trackHeight: 28,
      thumb: 22,
      thumbOffX: 3,
      thumbOnX: 23,
      focusWidth: 56,
      focusHeight: 36,
    });
  });

  test('keeps the 3px inset, pill geometry and at least a 44px target', () => {
    for (const size of sizes) {
      const spec = toggleSizeSpec(size);
      expect(spec.thumbY).toBe(3);
      expect(spec.thumbOffX).toBe(3);
      expect(spec.targetWidth).toBeGreaterThanOrEqual(44);
      expect(spec.targetHeight).toBe(44);
      expect(spec.focusWidth).toBe(spec.trackWidth + 8);
      expect(spec.focusHeight).toBe(spec.trackHeight + 8);
    }
  });

  test('reuses the Checkbox/Radio typography and DS spacing', () => {
    expect(toggleSizeSpec('small').labelType).toBe(theme.type.labelSmall);
    expect(toggleSizeSpec('small').descriptionType).toBe(
      theme.type.captionSmall,
    );
    expect(toggleSizeSpec('medium').labelType).toBe(theme.type.labelLarge);
    expect(toggleSizeSpec('medium').descriptionType).toBe(
      theme.type.captionDefault,
    );
    expect(toggleSizeSpec('large').labelType).toBe(theme.type.labelLarge);
    expect(toggleSizeSpec('large').descriptionType).toBe(theme.type.bodySmall);
    for (const size of sizes) {
      expect(toggleSizeSpec(size).copyGap).toBe(theme.scale.space[1]);
      expect(toggleSizeSpec(size).rowGap).toBe(theme.scale.space[3]);
    }
  });

  test('copy starts inside the same 44px row without shifting the track', () => {
    for (const size of sizes) {
      const spec = toggleSizeSpec(size);
      expect(toggleCopyOffset(spec)).toBe(
        (theme.scale.size.touchTarget - spec.labelType.lineHeight) / 2,
      );
    }
  });
});

describe('toggleSurface', () => {
  test('binds every state to the exact semantic token', () => {
    const colors = labelledPalette();

    expect(toggleSurface(colors, { checked: false })).toMatchObject({
      track: 'control.trackOff',
      overlay: null,
      thumb: 'control.knob',
    });
    expect(
      toggleSurface(colors, { checked: false, hovered: true }),
    ).toMatchObject({ track: 'control.trackOff', overlay: 'state.hover' });
    expect(
      toggleSurface(colors, { checked: false, pressed: true }),
    ).toMatchObject({ track: 'control.trackOff', overlay: 'state.pressed' });

    expect(toggleSurface(colors, { checked: true })).toMatchObject({
      track: 'action.primary.fill',
      overlay: null,
      thumb: 'control.knob',
    });
    expect(
      toggleSurface(colors, { checked: true, hovered: true }),
    ).toMatchObject({ track: 'action.primary.hover', overlay: null });
    expect(
      toggleSurface(colors, { checked: true, pressed: true }),
    ).toMatchObject({ track: 'action.primary.pressed', overlay: null });

    for (const checked of [false, true]) {
      expect(
        toggleSurface(colors, {
          checked,
          disabled: true,
          hovered: true,
          pressed: true,
        }),
      ).toEqual({
        track: 'surface.muted',
        overlay: null,
        thumb: 'icon.disabled',
        label: 'text.disabled',
        description: 'text.disabled',
      });
    }
  });

  test('pressed wins over hover without changing geometry', () => {
    const colors = labelledPalette();
    expect(
      toggleSurface(colors, {
        checked: false,
        hovered: true,
        pressed: true,
      }).overlay,
    ).toBe('state.pressed');
    expect(
      toggleSurface(colors, {
        checked: true,
        hovered: true,
        pressed: true,
      }).track,
    ).toBe('action.primary.pressed');
  });

  test.each(palettes)('%s resolves all 8 visual states', (_name, colors) => {
    for (const checked of [false, true]) {
      for (const state of states) {
        const surface = toggleSurface(colors, {
          checked,
          disabled: state === 'disabled',
          hovered: state === 'hover',
          pressed: state === 'pressed',
        });
        expect(typeof surface.track).toBe('string');
        expect(typeof surface.thumb).toBe('string');
        expect(typeof surface.label).toBe('string');
        expect(typeof surface.description).toBe('string');
      }
    }
  });
});

describe('toggleFocusRing', () => {
  test('is the 2px border/focus ring at 2px offset', () => {
    expect(toggleFocusRing(labelledPalette(), true)).toEqual({
      outlineColor: 'border.focus',
      outlineOffset: theme.scale.stroke.focusRing,
      outlineStyle: 'solid',
      outlineWidth: theme.scale.stroke.focusRing,
    });
    expect(
      toggleFocusRing(labelledPalette(), true).outlineOffset +
        toggleFocusRing(labelledPalette(), true).outlineWidth,
    ).toBe(4);
  });

  test('clears the browser ring when keyboard focus is absent', () => {
    expect(toggleFocusRing(labelledPalette(), false)).toEqual({
      outlineColor: 'transparent',
      outlineOffset: 0,
      outlineStyle: 'solid',
      outlineWidth: 0,
    });
  });
});

describe('Toggle rendering', () => {
  test('all 48 Figma configurations render without geometry shifts', () => {
    let rendered = 0;
    for (const size of sizes) {
      const spec = toggleSizeSpec(size);
      for (const checked of [false, true]) {
        for (const state of states) {
          for (const position of positions) {
            const tree = renderToggle(
              <Toggle
                checked={checked}
                disabled={state === 'disabled'}
                label="Notifications"
                onChange={() => {}}
                position={position}
                size={size}
                testID="toggle"
              />,
            );
            if (state === 'hover') {
              act(() => props(tree.root).onHoverIn());
            }
            const track = flat(hostByTestId(tree.root, 'toggle-track'));
            const thumb = flat(hostByTestId(tree.root, 'toggle-thumb'));
            expect([track.width, track.height]).toEqual([
              spec.trackWidth,
              spec.trackHeight,
            ]);
            expect([thumb.width, thumb.height, thumb.top]).toEqual([
              spec.thumb,
              spec.thumb,
              3,
            ]);
            expect(thumb.left).toBe(
              checked ? spec.thumbOnX : spec.thumbOffX,
            );
            rendered += 1;
            unmountTree(tree);
          }
        }
      }
    }
    expect(rendered).toBe(48);
  });

  test.each(sizes)('%s keeps the visible track inside its touch target', (size) => {
    const spec = toggleSizeSpec(size);
    const tree = renderToggle(
      <Toggle
        accessibilityLabel="Notifications"
        checked={false}
        onChange={() => {}}
        size={size}
        testID="toggle"
      />,
    );
    const target = flat(hostByTestId(tree.root, 'toggle-target'));
    expect(target.width).toBe(spec.targetWidth);
    expect(target.height).toBe(theme.scale.size.touchTarget);
    expect(flat(hostByTestId(tree.root, 'toggle-track')).width).toBe(
      spec.trackWidth,
    );
    unmountTree(tree);
  });

  test.each(palettes)('%s paints track and thumb from tokens', (_name, colors) => {
    mockPalette = colors;
    try {
      const off = renderToggle(
        <Toggle
          accessibilityLabel="Notifications"
          checked={false}
          onChange={() => {}}
          testID="toggle"
        />,
      );
      expect(flat(hostByTestId(off.root, 'toggle-track')).backgroundColor).toBe(
        colors.control.trackOff,
      );
      expect(flat(hostByTestId(off.root, 'toggle-thumb')).backgroundColor).toBe(
        colors.control.knob,
      );
      unmountTree(off);

      const on = renderToggle(
        <Toggle
          accessibilityLabel="Notifications"
          checked
          onChange={() => {}}
          testID="toggle"
        />,
      );
      expect(flat(hostByTestId(on.root, 'toggle-track')).backgroundColor).toBe(
        colors.action.primary.fill,
      );
      unmountTree(on);
    } finally {
      mockPalette = theme.color;
    }
  });

  test('off hover is an overlay; on hover changes the track', () => {
    mockPalette = labelledPalette();
    try {
      const off = renderToggle(
        <Toggle
          accessibilityLabel="Notifications"
          checked={false}
          onChange={() => {}}
          testID="toggle"
        />,
      );
      act(() => props(off.root).onHoverIn());
      expect(flat(hostByTestId(off.root, 'toggle-track')).backgroundColor).toBe(
        'control.trackOff',
      );
      expect(flat(hostByTestId(off.root, 'toggle-overlay')).backgroundColor).toBe(
        'state.hover',
      );
      unmountTree(off);

      const on = renderToggle(
        <Toggle
          accessibilityLabel="Notifications"
          checked
          onChange={() => {}}
          testID="toggle"
        />,
      );
      act(() => props(on.root).onHoverIn());
      expect(flat(hostByTestId(on.root, 'toggle-track')).backgroundColor).toBe(
        'action.primary.hover',
      );
      expect(
        on.root.findAll((node) => node.props.testID === 'toggle-overlay'),
      ).toHaveLength(0);
      unmountTree(on);
    } finally {
      mockPalette = theme.color;
    }
  });

  test('leading/trailing change child order while copy remains flexible', () => {
    for (const position of positions) {
      const tree = renderToggle(
        <Toggle
          checked={false}
          description="A long description that can wrap onto several lines"
          label="A long notification label that must not overlap the switch"
          onChange={() => {}}
          position={position}
          testID="toggle"
        />,
      );
      const hostNodes = tree.root.findAll(
        (node) => typeof node.type === 'string',
      );
      const targetIndex = hostNodes.indexOf(
        hostByTestId(tree.root, 'toggle-target'),
      );
      const copyIndex = hostNodes.indexOf(
        hostByTestId(tree.root, 'toggle-copy'),
      );
      expect(targetIndex < copyIndex).toBe(
        position === 'leading'
          ? true
          : false,
      );
      const copyStyle = flat(hostByTestId(tree.root, 'toggle-copy'));
      expect(copyStyle.flex).toBe(1);
      expect(copyStyle.flexShrink).toBe(1);
      expect(copyStyle.minWidth).toBe(0);
      unmountTree(tree);
    }
  });

  test('the 375px row is bounded and leaves no copy gap when bare', () => {
    const withCopy = renderToggle(
      <Toggle
        checked={false}
        label="A label long enough to wrap on a 375 pixel screen"
        onChange={() => {}}
        testID="toggle"
      />,
    );
    const rowStyle = flat(
      pressable(withCopy.root).find(
        (node) =>
          typeof node.type === 'string' &&
          node.props.accessibilityRole === 'switch',
      ),
    );
    expect(rowStyle.maxWidth).toBe('100%');
    expect(rowStyle.width).toBe('100%');
    unmountTree(withCopy);

    const bare = renderToggle(
      <Toggle
        accessibilityLabel="Notifications"
        checked={false}
        onChange={() => {}}
        testID="toggle"
      />,
    );
    expect(
      bare.root.findAll((node) => node.props.testID === 'toggle-copy'),
    ).toHaveLength(0);
    unmountTree(bare);
  });

  test('label and description use the requested type roles and colors', () => {
    const tree = renderToggle(
      <Toggle
        checked={false}
        description="Recurring expense reminders"
        label="Notifications"
        onChange={() => {}}
        size="small"
      />,
    );
    const textStyles = texts(tree.root).map(
      (node) => StyleSheet.flatten(node.props.style as TextStyle) ?? {},
    );
    expect(textStyles[0]).toMatchObject({
      ...theme.type.labelSmall,
      color: theme.color.text.primary,
    });
    expect(textStyles[1]).toMatchObject({
      ...theme.type.captionSmall,
      color: theme.color.text.secondary,
    });
    unmountTree(tree);
  });
});

describe('Toggle behaviour and accessibility', () => {
  test('is controlled and asks for the opposite boolean', () => {
    for (const checked of [false, true]) {
      const onChange = jest.fn<(next: boolean) => void>();
      const tree = renderToggle(
        <Toggle checked={checked} label="Notifications" onChange={onChange} />,
      );
      act(() => props(tree.root).onPress());
      expect(onChange).toHaveBeenCalledWith(!checked);
      expect(props(tree.root)['aria-checked']).toBe(checked);
      unmountTree(tree);
    }
  });

  test('disabled does not change and is removed from the tab order', () => {
    const onChange = jest.fn<(next: boolean) => void>();
    const tree = renderToggle(
      <Toggle checked disabled label="Notifications" onChange={onChange} />,
    );
    act(() => props(tree.root).onPress());
    expect(onChange).not.toHaveBeenCalled();
    expect(props(tree.root)).toMatchObject({
      disabled: true,
      focusable: false,
      tabIndex: -1,
      'aria-disabled': true,
      accessibilityState: { checked: true, disabled: true },
    });
    unmountTree(tree);
  });

  test('enabled is exactly one switch and one tab stop', () => {
    const tree = renderToggle(
      <Toggle checked={false} label="Notifications" onChange={() => {}} />,
    );
    expect(
      tree.root.findAll(
        (node) =>
          typeof node.type === 'string' &&
          node.props.accessibilityRole === 'switch',
      ),
    ).toHaveLength(1);
    expect(props(tree.root).tabIndex).toBe(0);
    expect(props(tree.root).focusable).toBe(true);
    for (const text of texts(tree.root)) {
      expect(text.props.onPress).toBeUndefined();
      expect(text.props.tabIndex).toBeUndefined();
    }
    unmountTree(tree);
  });

  test('announces switch state, label, hint and description relation', () => {
    const tree = renderToggle(
      <Toggle
        checked
        description="Recurring expense reminders"
        label="Notifications"
        onChange={() => {}}
      />,
    );
    const switchProps = props(tree.root);
    expect(switchProps.accessibilityRole).toBe('switch');
    expect(switchProps.accessibilityLabel).toBe('Notifications');
    expect(switchProps.accessibilityHint).toBe(
      'Recurring expense reminders',
    );
    expect(switchProps['aria-checked']).toBe(true);
    expect(typeof switchProps['aria-describedby']).toBe('string');
    unmountTree(tree);
  });

  test('a bare toggle is still named and renders no text', () => {
    const tree = renderToggle(
      <Toggle
        accessibilityLabel="Notifications"
        checked={false}
        onChange={() => {}}
      />,
    );
    expect(props(tree.root).accessibilityLabel).toBe('Notifications');
    expect(texts(tree.root)).toHaveLength(0);
    unmountTree(tree);
  });

  test('Space toggles once, prevents scrolling, and repeats do nothing', () => {
    expect(isToggleKey(' ')).toBe(true);
    expect(isToggleKey('Spacebar')).toBe(true);
    expect(isToggleKey('Enter')).toBe(false);

    const toggle = jest.fn();
    const first = keyEvent(' ');
    toggleKeyboardProps('web', toggle).onKeyDown?.(first.event);
    expect(first.preventDefault).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveBeenCalledTimes(1);

    const repeat = keyEvent(' ', true);
    toggleKeyboardProps('web', toggle).onKeyDown?.(repeat.event);
    expect(repeat.preventDefault).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveBeenCalledTimes(1);

    const enter = keyEvent('Enter');
    toggleKeyboardProps('web', toggle).onKeyDown?.(enter.event);
    expect(enter.preventDefault).not.toHaveBeenCalled();
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  test('web gets keyboard handling; native gets no web-only key prop', () => {
    expect(toggleKeyboardProps('web', () => {}).onKeyDown).toBeDefined();
    expect(toggleKeyboardProps('android', () => {}).onKeyDown).toBeUndefined();
  });
});

describe('Toggle tokens', () => {
  test('adds only the two Figma control colors in both themes', () => {
    expect(theme.color.control).toEqual({
      trackOff: '#7C848A',
      knob: '#FFFFFF',
    });
    expect(darkColor.control).toEqual({
      trackOff: '#7A7A7A',
      knob: '#FFFFFF',
    });
  });
});

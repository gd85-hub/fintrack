import { describe, expect, jest, test } from '@jest/globals';
import {
  Platform,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { act, create, type ReactTestInstance } from 'react-test-renderer';

import {
  Radio,
  RadioGroup,
  type RadioColors,
  type RadioGroupOption,
  type RadioKeyEvent,
  type RadioSize,
  isRadioSelectKey,
  radioCopyOffset,
  radioFocusRing,
  radioGroupKeyboardProps,
  radioGroupMoveKey,
  radioGroupNextValue,
  radioGroupTabbableValue,
  radioKeyboardProps,
  radioShouldSelect,
  radioSizeSpec,
  radioSurface,
} from '../../components/ds/Radio';
import { labelledPalette } from '../__fixtures__/buttonPalette';
import { darkColor, theme } from '../theme';

// Asserts the Figma Radio spec (set 409:796, 24 variants) and the WAI-ARIA
// radio group pattern against the tokens and the behaviour they must bind,
// not against raw hex values.
let mockPalette: RadioColors = theme.color;

jest.mock('../../contexts/ThemeContext', () => ({
  useColors: () => mockPalette,
}));

const sizes: RadioSize[] = ['small', 'medium', 'large'];

const states = ['default', 'hover', 'pressed', 'disabled'] as const;

type VisualState = (typeof states)[number];

const themes: [string, RadioColors][] = [
  ['light', theme.color],
  ['dark', darkColor],
];

// The published palettes give several semantically different tokens the same
// hex, so the labelled palette is the run that can fail on a misbinding.
const palettes: [string, RadioColors][] = [
  ...themes,
  ['labelled', labelledPalette()],
];

function visual(state: VisualState, checked: boolean) {
  return {
    checked,
    disabled: state === 'disabled',
    hovered: state === 'hover',
    pressed: state === 'pressed',
  };
}

function renderRadio(node: React.ReactElement) {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(node);
  });
  if (!tree) {
    throw new Error('Radio did not render');
  }
  return tree;
}

function unmountTree(tree: ReturnType<typeof create>) {
  act(() => {
    tree.unmount();
  });
}

type RadioPressableProps = {
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
  onKeyDown?: (event: RadioKeyEvent) => void;
  onPress: () => void;
  tabIndex: 0 | -1;
};

function pressables(root: ReactTestInstance): ReactTestInstance[] {
  return root.findAll(
    (candidate) =>
      typeof candidate.type !== 'string' &&
      candidate.props !== null &&
      candidate.props.accessibilityRole === 'radio' &&
      typeof candidate.props.onPress === 'function',
  );
}

function pressableProps(
  root: ReactTestInstance,
  index = 0,
): RadioPressableProps {
  return pressables(root)[index].props as RadioPressableProps;
}

function groupProps(root: ReactTestInstance): {
  accessibilityLabel: string;
  accessibilityRole: string;
  onKeyDown?: (event: RadioKeyEvent) => void;
} {
  const node = root.find(
    (candidate) =>
      typeof candidate.type !== 'string' &&
      candidate.props !== null &&
      candidate.props.accessibilityRole === 'radiogroup',
  );
  return node.props as {
    accessibilityLabel: string;
    accessibilityRole: string;
    onKeyDown?: (event: RadioKeyEvent) => void;
  };
}

// react-test-renderer types host names in lower case, React Native emits
// 'View', so the host lookup compares case-insensitively.
function hostViews(root: ReactTestInstance) {
  return root.findAll(
    (node) =>
      typeof node.type === 'string' && node.type.toLowerCase() === 'view',
  );
}

// A view rendered without a style prop flattens to undefined, so reads go
// through this.
function flat(node: ReactTestInstance): ViewStyle {
  return StyleSheet.flatten((node.props.style ?? {}) as ViewStyle) ?? {};
}

/** The outermost host view: the row that takes the press and the focus. */
function rootStyle(root: ReactTestInstance): ViewStyle {
  return flat(hostViews(root)[0]);
}

function viewSized(root: ReactTestInstance, height: number): ViewStyle {
  const node = hostViews(root).find(
    (candidate) => flat(candidate).height === height,
  );
  if (!node) {
    throw new Error(`No view of height ${height} found`);
  }
  return flat(node);
}

function stateBackgroundStyle(
  root: ReactTestInstance,
  size: RadioSize,
): ViewStyle {
  return viewSized(root, radioSizeSpec(size).stateSize);
}

function controlStyle(root: ReactTestInstance, size: RadioSize): ViewStyle {
  return viewSized(root, radioSizeSpec(size).control);
}

function dotStyles(root: ReactTestInstance, size: RadioSize): ViewStyle[] {
  const spec = radioSizeSpec(size);
  return hostViews(root)
    .map(flat)
    .filter((style) => style.height === spec.dot && style.width === spec.dot);
}

function texts(root: ReactTestInstance) {
  return root.findAll(
    (node) =>
      typeof node.type === 'string' && node.type.toLowerCase() === 'text',
  );
}

function textStyles(root: ReactTestInstance): TextStyle[] {
  return texts(root).map(
    (node) => StyleSheet.flatten(node.props.style as TextStyle) ?? {},
  );
}

/**
 * Renders with `Platform.OS` reporting web, which is the only place the key
 * bindings exist. Jest runs the native project, so the override is what lets
 * the web half of the contract be exercised at all; everything it cannot
 * reach - real focus-visible, real scrolling - is checked in a browser.
 */
function withWebPlatform<T>(run: () => T): T {
  const original = Object.getOwnPropertyDescriptor(Platform, 'OS');
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => 'web',
  });
  try {
    return run();
  } finally {
    if (original) {
      Object.defineProperty(Platform, 'OS', original);
    }
  }
}

type HostInstance = { props: { testID?: string }; focus: () => void };

/**
 * Records which radio the group moves the focus to. React Native's host
 * instances carry `focus()` on a shared prototype and that is what a ref
 * forwarded through Pressable hands back, so swapping that one method is
 * what makes the hop observable; react-test-renderer's own node mocks never
 * reach such a ref. Returns the undo.
 */
function trackFocus(focused: string[]): () => void {
  const holder: { node: HostInstance | null } = { node: null };
  const probe = renderRadio(
    <Radio
      accessibilityLabel="probe"
      checked={false}
      onSelect={() => {}}
      ref={(node) => {
        holder.node = node as unknown as HostInstance | null;
      }}
    />,
  );
  const instance = holder.node;
  unmountTree(probe);
  if (instance === null) {
    throw new Error('No host instance to read focus() from');
  }
  const prototype = Object.getPrototypeOf(instance) as HostInstance;
  const original = prototype.focus;
  prototype.focus = function patched(this: HostInstance) {
    focused.push(String(this.props.testID));
  };
  return () => {
    prototype.focus = original;
  };
}

function keyEvent(key: string, repeat = false) {
  const preventDefault = jest.fn();
  return { event: { key, preventDefault, repeat }, preventDefault };
}

describe('radioSizeSpec', () => {
  test('the control, the dot and the state background match Figma', () => {
    expect(radioSizeSpec('small')).toMatchObject({
      control: 16,
      dot: 6,
      stateSize: 32,
    });
    expect(radioSizeSpec('medium')).toMatchObject({
      control: 20,
      dot: 8,
      stateSize: 36,
    });
    expect(radioSizeSpec('large')).toMatchObject({
      control: 24,
      dot: 10,
      stateSize: 40,
    });
  });

  test('the state background is always the control plus 16', () => {
    for (const size of sizes) {
      const spec = radioSizeSpec(size);
      expect(spec.stateSize).toBe(spec.control + 16);
    }
  });

  test('the control binds the icon size tokens', () => {
    expect(radioSizeSpec('small').control).toBe(theme.scale.size.iconSm);
    expect(radioSizeSpec('medium').control).toBe(theme.scale.size.iconMd);
    expect(radioSizeSpec('large').control).toBe(theme.scale.size.iconLg);
  });

  test('padding carries every size to a 44 touch target', () => {
    for (const size of sizes) {
      const spec = radioSizeSpec(size);
      expect(spec.stateSize + 2 * spec.targetPadding).toBe(
        theme.scale.size.touchTarget,
      );
      // The visible circle must not grow to get there.
      expect(spec.targetPadding).toBeGreaterThan(0);
    }
  });

  test('the border is a hairline and the copy gap is 4', () => {
    for (const size of sizes) {
      const spec = radioSizeSpec(size);
      expect(spec.borderWidth).toBe(theme.scale.stroke.hairline);
      expect(spec.copyGap).toBe(theme.scale.space[1]);
    }
  });

  test('each size takes the type Figma draws', () => {
    expect(radioSizeSpec('small').labelType).toBe(theme.type.labelSmall);
    expect(radioSizeSpec('small').descriptionType).toBe(theme.type.captionSmall);
    expect(radioSizeSpec('medium').labelType).toBe(theme.type.labelLarge);
    expect(radioSizeSpec('medium').descriptionType).toBe(
      theme.type.captionDefault,
    );
    expect(radioSizeSpec('large').labelType).toBe(theme.type.labelLarge);
    expect(radioSizeSpec('large').descriptionType).toBe(theme.type.bodySmall);
  });

  test('the type matches the sizes Figma sets', () => {
    expect(radioSizeSpec('small').labelType).toMatchObject({
      fontSize: 14,
      lineHeight: 20,
    });
    expect(radioSizeSpec('small').descriptionType).toMatchObject({
      fontSize: 12,
      lineHeight: 16,
    });
    expect(radioSizeSpec('medium').labelType).toMatchObject({
      fontSize: 16,
      lineHeight: 22,
    });
    expect(radioSizeSpec('medium').descriptionType).toMatchObject({
      fontSize: 13,
      lineHeight: 18,
    });
    expect(radioSizeSpec('large').descriptionType).toMatchObject({
      fontSize: 14,
      lineHeight: 20,
    });
  });
});

describe('radioCopyOffset', () => {
  test('the label sits level with the middle of the control', () => {
    for (const size of sizes) {
      const spec = radioSizeSpec(size);
      expect(radioCopyOffset(spec)).toBe(
        (spec.stateSize - spec.labelType.lineHeight) / 2,
      );
    }
  });

  test('a label taller than the control never pulls the copy up', () => {
    const spec = {
      ...radioSizeSpec('small'),
      labelType: { ...radioSizeSpec('small').labelType, lineHeight: 64 },
    };
    expect(radioCopyOffset(spec)).toBe(0);
  });
});

describe('radioShouldSelect', () => {
  test('an unchosen radio answers a press', () => {
    expect(radioShouldSelect({ checked: false })).toBe(true);
  });

  test('the chosen radio does not clear itself', () => {
    expect(radioShouldSelect({ checked: true })).toBe(false);
  });

  test('a disabled radio answers nothing', () => {
    expect(radioShouldSelect({ checked: false, disabled: true })).toBe(false);
    expect(radioShouldSelect({ checked: true, disabled: true })).toBe(false);
  });
});

describe('radioSurface', () => {
  test.each(palettes)('%s binds the resting tokens', (_name, colors) => {
    const off = radioSurface(colors, visual('default', false));
    expect(off).toMatchObject({
      background: colors.surface.raised,
      border: colors.border.strong,
      dot: colors.action.primary.content,
      stateTint: null,
      label: colors.text.primary,
      description: colors.text.secondary,
    });

    const on = radioSurface(colors, visual('default', true));
    expect(on).toMatchObject({
      background: colors.action.primary.fill,
      // A filled circle draws no stroke.
      border: null,
      dot: colors.action.primary.content,
      stateTint: null,
    });
  });

  test.each(palettes)('%s tints only on hover and press', (_name, colors) => {
    for (const checked of [false, true]) {
      expect(radioSurface(colors, visual('hover', checked)).stateTint).toBe(
        colors.state.hover,
      );
      expect(radioSurface(colors, visual('pressed', checked)).stateTint).toBe(
        colors.state.pressed,
      );
    }
  });

  test.each(palettes)('%s lets a press beat a hover', (_name, colors) => {
    const surface = radioSurface(colors, {
      checked: false,
      hovered: true,
      pressed: true,
    });
    expect(surface.stateTint).toBe(colors.state.pressed);
  });

  test.each(palettes)('%s binds the disabled tokens', (_name, colors) => {
    const off = radioSurface(colors, visual('disabled', false));
    expect(off).toMatchObject({
      background: colors.field.disabledFill,
      border: colors.field.disabledBorder,
      stateTint: null,
      label: colors.text.disabled,
      description: colors.text.disabled,
    });

    const on = radioSurface(colors, visual('disabled', true));
    expect(on).toMatchObject({
      background: colors.action.primary.disabled,
      border: null,
      dot: colors.action.primary.disabledContent,
      stateTint: null,
      label: colors.text.disabled,
    });
  });

  test.each(palettes)(
    '%s never tints a disabled radio the pointer is over',
    (_name, colors) => {
      const surface = radioSurface(colors, {
        checked: false,
        disabled: true,
        hovered: true,
        pressed: true,
      });
      expect(surface.stateTint).toBeNull();
    },
  );

  test('disabled is a colour change, never an opacity', () => {
    const surface = radioSurface(theme.color, visual('disabled', true)) as {
      opacity?: number;
    };
    expect(surface.opacity).toBeUndefined();
  });
});

describe('radioFocusRing', () => {
  test.each(palettes)('%s draws the ring from the focus token', (_n, colors) => {
    expect(radioFocusRing(colors, true)).toEqual({
      outlineColor: colors.border.focus,
      outlineOffset: theme.scale.stroke.focusRing,
      outlineStyle: 'solid',
      outlineWidth: theme.scale.stroke.focusRing,
    });
  });

  test('the ring lands 4 outside the control, as Figma draws it', () => {
    const ring = radioFocusRing(theme.color, true);
    expect(ring.outlineOffset + ring.outlineWidth).toBe(4);
  });

  test('an unfocused radio clears the user-agent ring', () => {
    expect(radioFocusRing(theme.color, false)).toEqual({
      outlineColor: 'transparent',
      outlineOffset: 0,
      outlineStyle: 'solid',
      outlineWidth: 0,
    });
  });
});

describe('isRadioSelectKey', () => {
  test('space selects, and nothing else does', () => {
    expect(isRadioSelectKey(' ')).toBe(true);
    expect(isRadioSelectKey('Spacebar')).toBe(true);
    expect(isRadioSelectKey('Enter')).toBe(false);
    expect(isRadioSelectKey('ArrowDown')).toBe(false);
    expect(isRadioSelectKey('a')).toBe(false);
  });
});

describe('radioKeyboardProps', () => {
  test('native gets no web-only prop at all', () => {
    expect(radioKeyboardProps('android', jest.fn())).toEqual({});
    expect(radioKeyboardProps('ios', jest.fn())).toEqual({});
  });

  test('space selects and never scrolls the page', () => {
    const select = jest.fn();
    const { event, preventDefault } = keyEvent(' ');
    radioKeyboardProps('web', select).onKeyDown?.(event);
    expect(select).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  test('a held space scrolls nothing and selects once', () => {
    const select = jest.fn();
    const { event, preventDefault } = keyEvent(' ', true);
    radioKeyboardProps('web', select).onKeyDown?.(event);
    expect(select).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  test('other keys pass straight through', () => {
    for (const key of ['Enter', 'ArrowDown', 'Tab', 'x']) {
      const select = jest.fn();
      const { event, preventDefault } = keyEvent(key);
      radioKeyboardProps('web', select).onKeyDown?.(event);
      expect(select).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    }
  });
});

describe('radioGroupMoveKey', () => {
  test('both axes move the same way', () => {
    expect(radioGroupMoveKey('ArrowDown')).toBe('next');
    expect(radioGroupMoveKey('ArrowRight')).toBe('next');
    expect(radioGroupMoveKey('ArrowUp')).toBe('previous');
    expect(radioGroupMoveKey('ArrowLeft')).toBe('previous');
  });

  test('anything else is not a move', () => {
    for (const key of [' ', 'Enter', 'Tab', 'Home', 'a']) {
      expect(radioGroupMoveKey(key)).toBeNull();
    }
  });
});

const groupOptions: RadioGroupOption[] = [
  { value: 'eur', label: 'Euro' },
  { value: 'usd', label: 'Dollar' },
  { value: 'rsd', label: 'Dinar' },
];

const withDisabled: RadioGroupOption[] = [
  { value: 'eur', label: 'Euro' },
  { value: 'usd', label: 'Dollar', disabled: true },
  { value: 'rsd', label: 'Dinar' },
];

describe('radioGroupTabbableValue', () => {
  test('the chosen option is the stop', () => {
    expect(radioGroupTabbableValue(groupOptions, 'usd')).toBe('usd');
  });

  test('with nothing chosen the first reachable option is the stop', () => {
    expect(radioGroupTabbableValue(groupOptions, null)).toBe('eur');
    expect(
      radioGroupTabbableValue(
        [{ value: 'eur', label: 'Euro', disabled: true }, ...groupOptions.slice(1)],
        null,
      ),
    ).toBe('usd');
  });

  test('a chosen option that is off does not hold the stop', () => {
    expect(radioGroupTabbableValue(withDisabled, 'usd')).toBe('eur');
  });

  test('a group with nothing reachable has no stop', () => {
    expect(
      radioGroupTabbableValue(
        groupOptions.map((option) => ({ ...option, disabled: true })),
        'eur',
      ),
    ).toBeNull();
    expect(radioGroupTabbableValue([], null)).toBeNull();
  });
});

describe('radioGroupNextValue', () => {
  test('next and previous walk the list', () => {
    expect(radioGroupNextValue(groupOptions, 'eur', 'next')).toBe('usd');
    expect(radioGroupNextValue(groupOptions, 'usd', 'previous')).toBe('eur');
  });

  test('both ends wrap round', () => {
    expect(radioGroupNextValue(groupOptions, 'rsd', 'next')).toBe('eur');
    expect(radioGroupNextValue(groupOptions, 'eur', 'previous')).toBe('rsd');
  });

  test('disabled options are stepped over, not landed on', () => {
    expect(radioGroupNextValue(withDisabled, 'eur', 'next')).toBe('rsd');
    expect(radioGroupNextValue(withDisabled, 'rsd', 'previous')).toBe('eur');
  });

  test('an empty start enters from the end the press came from', () => {
    expect(radioGroupNextValue(groupOptions, null, 'next')).toBe('eur');
    expect(radioGroupNextValue(groupOptions, null, 'previous')).toBe('rsd');
  });

  test('a group with nothing reachable goes nowhere', () => {
    expect(
      radioGroupNextValue(
        groupOptions.map((option) => ({ ...option, disabled: true })),
        'eur',
        'next',
      ),
    ).toBeNull();
  });
});

describe('radioGroupKeyboardProps', () => {
  test('native gets no web-only prop at all', () => {
    expect(radioGroupKeyboardProps('android', jest.fn())).toEqual({});
  });

  test('an arrow moves and never scrolls the page', () => {
    const move = jest.fn();
    const { event, preventDefault } = keyEvent('ArrowDown');
    radioGroupKeyboardProps('web', move).onKeyDown?.(event);
    expect(move).toHaveBeenCalledWith('next');
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  test('a held arrow scrolls nothing and moves once', () => {
    const move = jest.fn();
    const { event, preventDefault } = keyEvent('ArrowUp', true);
    radioGroupKeyboardProps('web', move).onKeyDown?.(event);
    expect(move).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  test('space belongs to the radio, not to the group', () => {
    const move = jest.fn();
    const { event, preventDefault } = keyEvent(' ');
    radioGroupKeyboardProps('web', move).onKeyDown?.(event);
    expect(move).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

describe('Radio rendering', () => {
  test('every one of the 24 Figma variants renders its circle', () => {
    for (const size of sizes) {
      for (const checked of [false, true]) {
        for (const state of states) {
          const spec = radioSizeSpec(size);
          const tree = renderRadio(
            <Radio
              accessibilityLabel="Option"
              checked={checked}
              disabled={state === 'disabled'}
              onSelect={() => {}}
              size={size}
            />,
          );
          const root = tree.root;
          if (state === 'hover') {
            act(() => {
              pressableProps(root).onHoverIn();
            });
          }

          const control = controlStyle(root, size);
          expect(control.width).toBe(spec.control);
          expect(control.borderRadius).toBe(theme.scale.radius.pill);
          expect(stateBackgroundStyle(root, size).borderRadius).toBe(
            theme.scale.radius.pill,
          );
          expect(dotStyles(root, size)).toHaveLength(checked ? 1 : 0);
          unmountTree(tree);
        }
      }
    }
  });

  test('the dot is a circle of the size Figma draws', () => {
    for (const size of sizes) {
      const tree = renderRadio(
        <Radio
          accessibilityLabel="Option"
          checked
          onSelect={() => {}}
          size={size}
        />,
      );
      const [dot] = dotStyles(tree.root, size);
      expect(dot.width).toBe(radioSizeSpec(size).dot);
      expect(dot.borderRadius).toBe(theme.scale.radius.pill);
      unmountTree(tree);
    }
  });

  test('an outlined circle strokes a hairline and a filled one none', () => {
    const off = renderRadio(
      <Radio accessibilityLabel="Option" checked={false} onSelect={() => {}} />,
    );
    expect(controlStyle(off.root, 'medium').borderWidth).toBe(
      theme.scale.stroke.hairline,
    );
    unmountTree(off);

    const on = renderRadio(
      <Radio accessibilityLabel="Option" checked onSelect={() => {}} />,
    );
    expect(controlStyle(on.root, 'medium').borderWidth).toBe(0);
    unmountTree(on);
  });

  test('the row reaches 44 without the circle growing', () => {
    for (const size of sizes) {
      const spec = radioSizeSpec(size);
      const tree = renderRadio(
        <Radio
          accessibilityLabel="Option"
          checked={false}
          onSelect={() => {}}
          size={size}
        />,
      );
      expect(rootStyle(tree.root).padding).toBe(spec.targetPadding);
      expect(controlStyle(tree.root, size).height).toBe(spec.control);
      unmountTree(tree);
    }
  });

  test('a labelled row lays out as a row and lifts only its height', () => {
    const tree = renderRadio(
      <Radio checked={false} label="Euro" onSelect={() => {}} />,
    );
    const style = rootStyle(tree.root);
    expect(style.flexDirection).toBe('row');
    expect(style.paddingVertical).toBe(radioSizeSpec('medium').targetPadding);
    expect(style.padding).toBeUndefined();
    unmountTree(tree);
  });

  test.each(palettes)('%s paints the circle from its tokens', (_n, colors) => {
    mockPalette = colors;
    const tree = renderRadio(
      <Radio accessibilityLabel="Option" checked onSelect={() => {}} />,
    );
    const control = controlStyle(tree.root, 'medium');
    expect(control.backgroundColor).toBe(colors.action.primary.fill);
    const [dot] = dotStyles(tree.root, 'medium');
    expect(dot.backgroundColor).toBe(colors.action.primary.content);
    unmountTree(tree);
    mockPalette = theme.color;
  });

  test.each(palettes)('%s tints only the state circle', (_n, colors) => {
    mockPalette = colors;
    const tree = renderRadio(
      <Radio accessibilityLabel="Option" checked={false} onSelect={() => {}} />,
    );
    act(() => {
      pressableProps(tree.root).onHoverIn();
    });
    expect(stateBackgroundStyle(tree.root, 'medium').backgroundColor).toBe(
      colors.state.hover,
    );
    expect(controlStyle(tree.root, 'medium').backgroundColor).toBe(
      colors.surface.raised,
    );

    act(() => {
      pressableProps(tree.root).onHoverOut();
    });
    expect(stateBackgroundStyle(tree.root, 'medium').backgroundColor).toBe(
      'transparent',
    );
    unmountTree(tree);
    mockPalette = theme.color;
  });

  test('a disabled radio the pointer is over stays untinted', () => {
    const tree = renderRadio(
      <Radio
        accessibilityLabel="Option"
        checked={false}
        disabled
        onSelect={() => {}}
      />,
    );
    act(() => {
      pressableProps(tree.root).onHoverIn();
    });
    expect(stateBackgroundStyle(tree.root, 'medium').backgroundColor).toBe(
      'transparent',
    );
    expect(controlStyle(tree.root, 'medium').backgroundColor).toBe(
      theme.color.field.disabledFill,
    );
    unmountTree(tree);
  });
});

describe('Radio behaviour', () => {
  test('pressing an unchosen radio chooses it', () => {
    const onSelect = jest.fn();
    const tree = renderRadio(
      <Radio checked={false} label="Euro" onSelect={onSelect} />,
    );
    act(() => {
      pressableProps(tree.root).onPress();
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    unmountTree(tree);
  });

  test('pressing the chosen radio changes nothing', () => {
    const onSelect = jest.fn();
    const tree = renderRadio(
      <Radio checked label="Euro" onSelect={onSelect} />,
    );
    act(() => {
      pressableProps(tree.root).onPress();
    });
    expect(onSelect).not.toHaveBeenCalled();
    unmountTree(tree);
  });

  test('a disabled radio answers no press', () => {
    const onSelect = jest.fn();
    const tree = renderRadio(
      <Radio checked={false} disabled label="Euro" onSelect={onSelect} />,
    );
    act(() => {
      pressableProps(tree.root).onPress();
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(pressableProps(tree.root).disabled).toBe(true);
    unmountTree(tree);
  });

  test('the label is part of the control, not a second one', () => {
    const tree = renderRadio(
      <Radio
        checked={false}
        description="Totals are shown in euro"
        label="Euro"
        onSelect={() => {}}
      />,
    );
    expect(pressables(tree.root)).toHaveLength(1);
    for (const node of texts(tree.root)) {
      expect(node.props.onPress).toBeUndefined();
      expect(node.props.focusable).toBeUndefined();
    }
    unmountTree(tree);
  });
});

describe('Radio accessibility', () => {
  test('it is a radio that says whether it is chosen', () => {
    for (const checked of [false, true]) {
      const tree = renderRadio(
        <Radio checked={checked} label="Euro" onSelect={() => {}} />,
      );
      const props = pressableProps(tree.root);
      expect(props.accessibilityRole).toBe('radio');
      expect(props['aria-checked']).toBe(checked);
      expect(props.accessibilityState.checked).toBe(checked);
      unmountTree(tree);
    }
  });

  test('a disabled radio says so and leaves the tab order', () => {
    const tree = renderRadio(
      <Radio checked={false} disabled label="Euro" onSelect={() => {}} />,
    );
    const props = pressableProps(tree.root);
    expect(props['aria-disabled']).toBe(true);
    expect(props.accessibilityState.disabled).toBe(true);
    expect(props.focusable).toBe(false);
    expect(props.tabIndex).toBe(-1);
    unmountTree(tree);
  });

  test('a radio handed tabbable false leaves the tab order too', () => {
    const tree = renderRadio(
      <Radio
        checked={false}
        label="Euro"
        onSelect={() => {}}
        tabbable={false}
      />,
    );
    // react-native-web's Pressable writes its own tabIndex from disabled
    // alone, so only the explicit one keeps an enabled radio out of the tab
    // order.
    expect(pressableProps(tree.root).focusable).toBe(false);
    expect(pressableProps(tree.root).tabIndex).toBe(-1);
    unmountTree(tree);
  });

  test('a radio that is the stop is reachable by tab', () => {
    const tree = renderRadio(
      <Radio checked={false} label="Euro" onSelect={() => {}} />,
    );
    expect(pressableProps(tree.root).focusable).toBe(true);
    expect(pressableProps(tree.root).tabIndex).toBe(0);
    unmountTree(tree);
  });

  test('the label names it, and an explicit name wins', () => {
    const plain = renderRadio(
      <Radio checked={false} label="Euro" onSelect={() => {}} />,
    );
    expect(pressableProps(plain.root).accessibilityLabel).toBe('Euro');
    unmountTree(plain);

    const named = renderRadio(
      <Radio
        accessibilityLabel="Primary currency: euro"
        checked={false}
        label="Euro"
        onSelect={() => {}}
      />,
    );
    expect(pressableProps(named.root).accessibilityLabel).toBe(
      'Primary currency: euro',
    );
    unmountTree(named);
  });

  test('a radio with no visible label is still named', () => {
    const tree = renderRadio(
      <Radio accessibilityLabel="Pick euro" checked={false} onSelect={() => {}} />,
    );
    expect(pressableProps(tree.root).accessibilityLabel).toBe('Pick euro');
    expect(texts(tree.root)).toHaveLength(0);
    unmountTree(tree);
  });

  test('the description becomes the hint, and is pointed at for web', () => {
    const tree = renderRadio(
      <Radio
        checked={false}
        description="Totals are shown in euro"
        label="Euro"
        onSelect={() => {}}
      />,
    );
    const props = pressableProps(tree.root);
    expect(props.accessibilityHint).toBe('Totals are shown in euro');
    const described = props['aria-describedby'];
    expect(described).toBeDefined();
    const ids = texts(tree.root).map((node) => node.props.id);
    expect(ids).toContain(described);
    unmountTree(tree);
  });

  test('a radio with no description points at nothing', () => {
    const tree = renderRadio(
      <Radio checked={false} label="Euro" onSelect={() => {}} />,
    );
    expect(pressableProps(tree.root)['aria-describedby']).toBeUndefined();
    unmountTree(tree);
  });

  test('two radios on one screen do not share a description id', () => {
    const tree = renderRadio(
      <>
        <Radio
          checked={false}
          description="Totals are shown in euro"
          label="Euro"
          onSelect={() => {}}
        />
        <Radio
          checked={false}
          description="Totals are shown in dollars"
          label="Dollar"
          onSelect={() => {}}
        />
      </>,
    );
    const [first, second] = pressables(tree.root).map(
      (node) => (node.props as RadioPressableProps)['aria-describedby'],
    );
    expect(first).toBeDefined();
    expect(first).not.toBe(second);
    unmountTree(tree);
  });

  test('the row is the only focus stop', () => {
    const tree = renderRadio(
      <Radio
        checked={false}
        description="Totals are shown in euro"
        label="Euro"
        onSelect={() => {}}
      />,
    );
    const stops = tree.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        node.props !== null &&
        node.props.focusable === true,
    );
    expect(stops).toHaveLength(1);
    unmountTree(tree);
  });

  test('native is handed no web-only key prop', () => {
    const tree = renderRadio(
      <Radio checked={false} label="Euro" onSelect={() => {}} />,
    );
    expect(pressableProps(tree.root).onKeyDown).toBeUndefined();
    unmountTree(tree);
  });
});

describe('Radio typography', () => {
  test.each(sizes)('%s takes its own label and description type', (size) => {
    const spec = radioSizeSpec(size);
    const tree = renderRadio(
      <Radio
        checked={false}
        description="Totals are shown in euro"
        label="Euro"
        onSelect={() => {}}
        size={size}
      />,
    );
    const [label, description] = textStyles(tree.root);
    expect(label).toMatchObject({
      fontFamily: spec.labelType.fontFamily,
      fontSize: spec.labelType.fontSize,
      lineHeight: spec.labelType.lineHeight,
    });
    expect(description).toMatchObject({
      fontFamily: spec.descriptionType.fontFamily,
      fontSize: spec.descriptionType.fontSize,
      lineHeight: spec.descriptionType.lineHeight,
    });
    unmountTree(tree);
  });

  test.each(palettes)('%s colours the copy from its tokens', (_n, colors) => {
    mockPalette = colors;
    const tree = renderRadio(
      <Radio
        checked={false}
        description="Totals are shown in euro"
        label="Euro"
        onSelect={() => {}}
      />,
    );
    const [label, description] = textStyles(tree.root);
    expect(label.color).toBe(colors.text.primary);
    expect(description.color).toBe(colors.text.secondary);
    unmountTree(tree);

    const off = renderRadio(
      <Radio
        checked={false}
        description="Totals are shown in euro"
        disabled
        label="Euro"
        onSelect={() => {}}
      />,
    );
    for (const style of textStyles(off.root)) {
      expect(style.color).toBe(colors.text.disabled);
    }
    unmountTree(off);
    mockPalette = theme.color;
  });
});

describe('RadioGroup', () => {
  test('it is a named radiogroup of radios', () => {
    const tree = renderRadio(
      <RadioGroup
        accessibilityLabel="Primary display currency"
        onChange={() => {}}
        options={groupOptions}
        value="eur"
      />,
    );
    const props = groupProps(tree.root);
    expect(props.accessibilityRole).toBe('radiogroup');
    expect(props.accessibilityLabel).toBe('Primary display currency');
    expect(pressables(tree.root)).toHaveLength(3);
    unmountTree(tree);
  });

  test('exactly one option is chosen, and it is the one in value', () => {
    const tree = renderRadio(
      <RadioGroup
        accessibilityLabel="Primary display currency"
        onChange={() => {}}
        options={groupOptions}
        value="usd"
      />,
    );
    const checked = pressables(tree.root).map(
      (node) => (node.props as RadioPressableProps)['aria-checked'],
    );
    expect(checked).toEqual([false, true, false]);
    unmountTree(tree);
  });

  test('nothing is chosen while value is null', () => {
    const tree = renderRadio(
      <RadioGroup
        accessibilityLabel="Reporting period"
        onChange={() => {}}
        options={groupOptions}
        value={null}
      />,
    );
    const checked = pressables(tree.root).map(
      (node) => (node.props as RadioPressableProps)['aria-checked'],
    );
    expect(checked).toEqual([false, false, false]);
    unmountTree(tree);
  });

  test('the whole group is one tab stop, on the chosen option', () => {
    const tree = renderRadio(
      <RadioGroup
        accessibilityLabel="Primary display currency"
        onChange={() => {}}
        options={groupOptions}
        value="rsd"
      />,
    );
    expect(
      pressables(tree.root).map(
        (node) => (node.props as RadioPressableProps).focusable,
      ),
    ).toEqual([false, false, true]);
    expect(
      pressables(tree.root).map(
        (node) => (node.props as RadioPressableProps).tabIndex,
      ),
    ).toEqual([-1, -1, 0]);
    unmountTree(tree);
  });

  test('an empty group still has one stop, on the first reachable option', () => {
    const tree = renderRadio(
      <RadioGroup
        accessibilityLabel="Reporting period"
        onChange={() => {}}
        options={withDisabled}
        value={null}
      />,
    );
    expect(
      pressables(tree.root).map(
        (node) => (node.props as RadioPressableProps).tabIndex,
      ),
    ).toEqual([0, -1, -1]);
    unmountTree(tree);
  });

  test('pressing another option reports it', () => {
    const onChange = jest.fn();
    const tree = renderRadio(
      <RadioGroup
        accessibilityLabel="Primary display currency"
        onChange={onChange}
        options={groupOptions}
        value="eur"
      />,
    );
    act(() => {
      pressableProps(tree.root, 2).onPress();
    });
    expect(onChange).toHaveBeenCalledWith('rsd');
    unmountTree(tree);
  });

  test('pressing the chosen option reports nothing', () => {
    const onChange = jest.fn();
    const tree = renderRadio(
      <RadioGroup
        accessibilityLabel="Primary display currency"
        onChange={onChange}
        options={groupOptions}
        value="eur"
      />,
    );
    act(() => {
      pressableProps(tree.root, 0).onPress();
    });
    expect(onChange).not.toHaveBeenCalled();
    unmountTree(tree);
  });

  test('a disabled option cannot be chosen', () => {
    const onChange = jest.fn();
    const tree = renderRadio(
      <RadioGroup
        accessibilityLabel="Reporting period"
        onChange={onChange}
        options={withDisabled}
        value="eur"
      />,
    );
    act(() => {
      pressableProps(tree.root, 1).onPress();
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(pressableProps(tree.root, 1).disabled).toBe(true);
    unmountTree(tree);
  });

  test('every option takes the group size', () => {
    const tree = renderRadio(
      <RadioGroup
        accessibilityLabel="Reporting period"
        onChange={() => {}}
        options={groupOptions}
        size="small"
        value="eur"
      />,
    );
    expect(
      hostViews(tree.root).filter(
        (node) => flat(node).height === radioSizeSpec('small').stateSize,
      ),
    ).toHaveLength(3);
    unmountTree(tree);
  });

  test('native is handed no web-only key prop', () => {
    const tree = renderRadio(
      <RadioGroup
        accessibilityLabel="Primary display currency"
        onChange={() => {}}
        options={groupOptions}
        value="eur"
      />,
    );
    expect(groupProps(tree.root).onKeyDown).toBeUndefined();
    unmountTree(tree);
  });
});

describe('RadioGroup keyboard on web', () => {
  function renderGroup(
    options: RadioGroupOption[],
    value: string | null,
    onChange: (next: string) => void,
  ) {
    return withWebPlatform(() =>
      renderRadio(
        <RadioGroup
          accessibilityLabel="Primary display currency"
          onChange={onChange}
          options={options}
          testID="group"
          value={value}
        />,
      ),
    );
  }

  test('the group binds the arrows and each radio binds space', () => {
    const tree = renderGroup(groupOptions, 'eur', () => {});
    expect(groupProps(tree.root).onKeyDown).toBeDefined();
    for (const node of pressables(tree.root)) {
      expect((node.props as RadioPressableProps).onKeyDown).toBeDefined();
    }
    unmountTree(tree);
  });

  test('an arrow moves the choice and the focus together', () => {
    const onChange = jest.fn();
    const focused: string[] = [];
    const restore = trackFocus(focused);
    const tree = renderGroup(groupOptions, 'eur', onChange);
    const { event, preventDefault } = keyEvent('ArrowDown');
    act(() => {
      groupProps(tree.root).onKeyDown?.(event);
    });
    expect(onChange).toHaveBeenCalledWith('usd');
    expect(focused).toEqual(['group-usd']);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    unmountTree(tree);
    restore();
  });

  test('the arrows wrap round both ends', () => {
    const onChange = jest.fn();
    const tree = renderGroup(groupOptions, 'eur', onChange);
    act(() => {
      groupProps(tree.root).onKeyDown?.(keyEvent('ArrowUp').event);
    });
    expect(onChange).toHaveBeenCalledWith('rsd');
    unmountTree(tree);

    const forward = jest.fn();
    const last = renderGroup(groupOptions, 'rsd', forward);
    act(() => {
      groupProps(last.root).onKeyDown?.(keyEvent('ArrowRight').event);
    });
    expect(forward).toHaveBeenCalledWith('eur');
    unmountTree(last);
  });

  test('the arrows step over a disabled option', () => {
    const onChange = jest.fn();
    const focused: string[] = [];
    const restore = trackFocus(focused);
    const tree = renderGroup(withDisabled, 'eur', onChange);
    act(() => {
      groupProps(tree.root).onKeyDown?.(keyEvent('ArrowDown').event);
    });
    expect(onChange).toHaveBeenCalledWith('rsd');
    expect(focused).toEqual(['group-rsd']);
    unmountTree(tree);
    restore();
  });

  test('an arrow in an empty group chooses from the end it came from', () => {
    const onChange = jest.fn();
    const tree = renderGroup(groupOptions, null, onChange);
    act(() => {
      groupProps(tree.root).onKeyDown?.(keyEvent('ArrowDown').event);
    });
    // Nothing is chosen, so the stop is the first option and the arrow takes
    // the one after it.
    expect(onChange).toHaveBeenCalledWith('usd');
    unmountTree(tree);
  });

  test('space chooses the focused option and never scrolls', () => {
    const onChange = jest.fn();
    const tree = renderGroup(groupOptions, 'eur', onChange);
    const { event, preventDefault } = keyEvent(' ');
    act(() => {
      (pressables(tree.root)[1].props as RadioPressableProps).onKeyDown?.(
        event,
      );
    });
    expect(onChange).toHaveBeenCalledWith('usd');
    expect(preventDefault).toHaveBeenCalledTimes(1);
    unmountTree(tree);
  });

  test('space on the chosen option leaves it chosen', () => {
    const onChange = jest.fn();
    const tree = renderGroup(groupOptions, 'eur', onChange);
    act(() => {
      (pressables(tree.root)[0].props as RadioPressableProps).onKeyDown?.(
        keyEvent(' ').event,
      );
    });
    expect(onChange).not.toHaveBeenCalled();
    unmountTree(tree);
  });

  test('a group with nothing reachable answers no arrow', () => {
    const onChange = jest.fn();
    const tree = renderGroup(
      groupOptions.map((option) => ({ ...option, disabled: true })),
      null,
      onChange,
    );
    act(() => {
      groupProps(tree.root).onKeyDown?.(keyEvent('ArrowDown').event);
    });
    expect(onChange).not.toHaveBeenCalled();
    unmountTree(tree);
  });
});

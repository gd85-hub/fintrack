import { describe, expect, jest, test } from '@jest/globals';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { act, create, type ReactTestInstance } from 'react-test-renderer';

import {
  Checkbox,
  type CheckboxChecked,
  type CheckboxColors,
  type CheckboxSize,
  checkboxAriaChecked,
  checkboxCopyOffset,
  checkboxFocusRing,
  checkboxNextChecked,
  checkboxSizeSpec,
  checkboxSurface,
  isCheckboxSelected,
  isCheckboxToggleKey,
} from '../../components/ds/Checkbox';
import { labelledPalette } from '../__fixtures__/buttonPalette';
import { darkColor, theme } from '../theme';

// Asserts the Figma Checkbox spec (set 409:755, 36 variants) against the
// tokens and the geometry it must bind, not against raw hex values.
let mockPalette: CheckboxColors = theme.color;

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
      mockReact.createElement(
        mockRn.Text,
        { testID: 'mark-glyph', style: { color: props.color } },
        `${props.name}:${props.size}`,
      ),
  };
});

const sizes: CheckboxSize[] = ['small', 'medium', 'large'];

const values: CheckboxChecked[] = [false, true, 'mixed'];

const states = ['default', 'hover', 'pressed', 'disabled'] as const;

const themes: [string, CheckboxColors][] = [
  ['light', theme.color],
  ['dark', darkColor],
];

// The published palettes give several semantically different tokens the same
// hex, so the labelled palette is the run that can fail on a misbinding.
const palettes: [string, CheckboxColors][] = [
  ...themes,
  ['labelled', labelledPalette()],
];

function renderCheckbox(node: React.ReactElement) {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(node);
  });
  if (!tree) {
    throw new Error('Checkbox did not render');
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
  accessibilityLabel?: string;
  accessibilityRole: string;
  accessibilityState: { checked: boolean | 'mixed'; disabled: boolean };
  'aria-checked': boolean | 'mixed';
  'aria-disabled': boolean;
  disabled: boolean;
  focusable: boolean;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onPress: () => void;
};

function pressable(root: ReactTestInstance): ReactTestInstance {
  return root.find(
    (candidate) =>
      typeof candidate.type !== 'string' &&
      candidate.props.accessibilityRole === 'checkbox' &&
      typeof candidate.props.onPress === 'function',
  );
}

function pressableProps(root: ReactTestInstance): PressableProps {
  return pressable(root).props as PressableProps;
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

function stateBackgroundStyle(
  root: ReactTestInstance,
  size: CheckboxSize,
): ViewStyle {
  const spec = checkboxSizeSpec(size);
  const node = hostViews(root).find(
    (candidate) => flat(candidate).height === spec.stateSize,
  );
  if (!node) {
    throw new Error('No state background found');
  }
  return flat(node);
}

function controlStyle(root: ReactTestInstance, size: CheckboxSize): ViewStyle {
  const spec = checkboxSizeSpec(size);
  const node = hostViews(root).find(
    (candidate) => flat(candidate).height === spec.control,
  );
  if (!node) {
    throw new Error('No control found');
  }
  return flat(node);
}

function texts(root: ReactTestInstance) {
  return root.findAll(
    (node) =>
      typeof node.type === 'string' && node.type.toLowerCase() === 'text',
  );
}

function textStyles(root: ReactTestInstance): TextStyle[] {
  return texts(root)
    .filter((node) => node.props.testID !== 'mark-glyph')
    .map(
      (node) => StyleSheet.flatten(node.props.style as TextStyle) ?? {},
    );
}

describe('checkboxSizeSpec', () => {
  test('each size binds the control, corner and marks Figma draws', () => {
    expect(checkboxSizeSpec('small')).toMatchObject({
      control: 16,
      controlRadius: 4,
      stateSize: 32,
      stateRadius: 10,
      markSize: 12,
      mixedWidth: 8,
      mixedHeight: 2,
    });
    expect(checkboxSizeSpec('medium')).toMatchObject({
      control: 20,
      controlRadius: 6,
      stateSize: 36,
      stateRadius: 12,
      markSize: 14,
      mixedWidth: 10,
      mixedHeight: 2,
    });
    expect(checkboxSizeSpec('large')).toMatchObject({
      control: 24,
      controlRadius: 8,
      stateSize: 40,
      stateRadius: 14,
      markSize: 16,
      mixedWidth: 12,
      mixedHeight: 2,
    });
  });

  test('the sizes come from tokens wherever a token exists', () => {
    expect(checkboxSizeSpec('small').control).toBe(theme.scale.size.iconSm);
    expect(checkboxSizeSpec('medium').control).toBe(theme.scale.size.iconMd);
    expect(checkboxSizeSpec('large').control).toBe(theme.scale.size.iconLg);
    expect(checkboxSizeSpec('medium').controlRadius).toBe(
      theme.scale.radius.xs,
    );
    expect(checkboxSizeSpec('medium').stateRadius).toBe(theme.scale.radius.sm);
    expect(checkboxSizeSpec('large').stateRadius).toBe(
      theme.scale.radius.buttonMedium,
    );
    for (const size of sizes) {
      expect(checkboxSizeSpec(size).mixedHeight).toBe(theme.scale.stroke.icon);
      expect(checkboxSizeSpec(size).borderWidth).toBe(
        theme.scale.stroke.hairline,
      );
      expect(checkboxSizeSpec(size).copyGap).toBe(theme.scale.space[1]);
    }
  });

  test('the state background is always the control plus 16', () => {
    for (const size of sizes) {
      const spec = checkboxSizeSpec(size);
      expect(spec.stateSize).toBe(spec.control + 2 * theme.scale.space[2]);
    }
  });

  test('the mixed bar is half the control wide', () => {
    for (const size of sizes) {
      const spec = checkboxSizeSpec(size);
      expect(spec.mixedWidth).toBe(spec.control / 2);
    }
  });

  test('the mark fits inside the control with room to spare', () => {
    for (const size of sizes) {
      const spec = checkboxSizeSpec(size);
      expect(spec.markSize).toBeLessThan(spec.control);
      // Figma centres it: 2, 3 and 4 of padding on every side.
      expect((spec.control - spec.markSize) % 2).toBe(0);
    }
  });

  test('padding lifts every size to a 44 target without growing the square', () => {
    for (const size of sizes) {
      const spec = checkboxSizeSpec(size);
      expect(spec.stateSize + 2 * spec.targetPadding).toBe(
        theme.scale.size.touchTarget,
      );
      expect(spec.targetPadding).toBeGreaterThan(0);
    }
  });

  test('the type comes from the DS scale, three pairs for three sizes', () => {
    expect(checkboxSizeSpec('small').labelType).toBe(theme.type.labelSmall);
    expect(checkboxSizeSpec('small').descriptionType).toBe(
      theme.type.captionSmall,
    );
    expect(checkboxSizeSpec('medium').labelType).toBe(theme.type.labelLarge);
    expect(checkboxSizeSpec('medium').descriptionType).toBe(
      theme.type.captionDefault,
    );
    expect(checkboxSizeSpec('large').labelType).toBe(theme.type.labelLarge);
    expect(checkboxSizeSpec('large').descriptionType).toBe(
      theme.type.bodySmall,
    );
  });

  test('the copy drops so the first line is level with the control', () => {
    expect(checkboxCopyOffset(checkboxSizeSpec('small'))).toBe(6);
    expect(checkboxCopyOffset(checkboxSizeSpec('medium'))).toBe(7);
    expect(checkboxCopyOffset(checkboxSizeSpec('large'))).toBe(9);
    for (const size of sizes) {
      const spec = checkboxSizeSpec(size);
      expect(checkboxCopyOffset(spec) * 2 + spec.labelType.lineHeight).toBe(
        spec.stateSize,
      );
    }
  });
});

describe('checkbox value helpers', () => {
  test('on and mixed both read as selected', () => {
    expect(isCheckboxSelected(true)).toBe(true);
    expect(isCheckboxSelected('mixed')).toBe(true);
    expect(isCheckboxSelected(false)).toBe(false);
  });

  test('a press turns mixed and off on, and on off', () => {
    expect(checkboxNextChecked(false)).toBe(true);
    expect(checkboxNextChecked('mixed')).toBe(true);
    expect(checkboxNextChecked(true)).toBe(false);
  });

  test('mixed reaches assistive technology as "mixed", not as a boolean', () => {
    expect(checkboxAriaChecked('mixed')).toBe('mixed');
    expect(checkboxAriaChecked(true)).toBe(true);
    expect(checkboxAriaChecked(false)).toBe(false);
  });
});

describe('checkboxSurface', () => {
  test('an empty box is a raised surface with a strong stroke', () => {
    const colors = labelledPalette();
    const surface = checkboxSurface(colors, { checked: false });
    expect(surface.background).toBe('surface.raised');
    expect(surface.border).toBe('border.strong');
  });

  test('a ticked box is the primary fill with no stroke', () => {
    const colors = labelledPalette();
    for (const checked of [true, 'mixed'] as CheckboxChecked[]) {
      const surface = checkboxSurface(colors, { checked });
      expect(surface.background).toBe('action.primary.fill');
      expect(surface.border).toBeNull();
      expect(surface.mark).toBe('action.primary.content');
    }
  });

  test('hover and pressed tint the square behind the control, not the fill', () => {
    const colors = labelledPalette();
    for (const checked of values) {
      const resting = checkboxSurface(colors, { checked });
      const hovered = checkboxSurface(colors, { checked, hovered: true });
      const pressed = checkboxSurface(colors, { checked, pressed: true });

      expect(resting.stateTint).toBeNull();
      expect(hovered.stateTint).toBe('state.hover');
      expect(pressed.stateTint).toBe('state.pressed');
      // The control itself is untouched by either.
      expect(hovered.background).toBe(resting.background);
      expect(pressed.background).toBe(resting.background);
    }
  });

  test('pressed wins over hover', () => {
    const colors = labelledPalette();
    const surface = checkboxSurface(colors, {
      checked: true,
      hovered: true,
      pressed: true,
    });
    expect(surface.stateTint).toBe('state.pressed');
  });

  test('disabled empty keeps a stroke; disabled ticked keeps the fill', () => {
    const colors = labelledPalette();
    const empty = checkboxSurface(colors, { checked: false, disabled: true });
    expect(empty.background).toBe('field.disabledFill');
    expect(empty.border).toBe('field.disabledBorder');

    for (const checked of [true, 'mixed'] as CheckboxChecked[]) {
      const ticked = checkboxSurface(colors, { checked, disabled: true });
      expect(ticked.background).toBe('action.primary.disabled');
      expect(ticked.border).toBeNull();
      expect(ticked.mark).toBe('action.primary.disabledContent');
    }
  });

  test('a disabled box never tints, whatever the pointer is doing', () => {
    const colors = labelledPalette();
    for (const checked of values) {
      expect(
        checkboxSurface(colors, {
          checked,
          disabled: true,
          hovered: true,
          pressed: true,
        }).stateTint,
      ).toBeNull();
    }
  });

  test('the label is primary text and the description secondary', () => {
    const colors = labelledPalette();
    const enabled = checkboxSurface(colors, { checked: false });
    expect(enabled.label).toBe('text.primary');
    expect(enabled.description).toBe('text.secondary');

    const disabled = checkboxSurface(colors, {
      checked: false,
      disabled: true,
    });
    expect(disabled.label).toBe('text.disabled');
    expect(disabled.description).toBe('text.disabled');
  });

  test.each(palettes)('%s resolves every state to a colour', (_name, colors) => {
    for (const checked of values) {
      for (const state of states) {
        const surface = checkboxSurface(colors, {
          checked,
          disabled: state === 'disabled',
          hovered: state === 'hover',
          pressed: state === 'pressed',
        });
        expect(typeof surface.background).toBe('string');
        expect(typeof surface.mark).toBe('string');
        expect(typeof surface.label).toBe('string');
        expect(typeof surface.description).toBe('string');
      }
    }
  });
});

describe('checkboxFocusRing', () => {
  test('the ring is border/focus, 2 wide at 2 offset', () => {
    const ring = checkboxFocusRing(labelledPalette(), true);
    expect(ring).toEqual({
      outlineColor: 'border.focus',
      outlineOffset: theme.scale.stroke.focusRing,
      outlineStyle: 'solid',
      outlineWidth: theme.scale.stroke.focusRing,
    });
  });

  test('an outline 2 wide at 2 offset lands 4 outside the square', () => {
    // Which is where Figma draws the Focus ring rect: control + 8.
    const ring = checkboxFocusRing(labelledPalette(), true);
    expect(ring.outlineOffset + ring.outlineWidth).toBe(4);
  });

  test('hidden means cleared, so the user-agent ring is suppressed too', () => {
    expect(checkboxFocusRing(labelledPalette(), false)).toEqual({
      outlineColor: 'transparent',
      outlineOffset: 0,
      outlineStyle: 'solid',
      outlineWidth: 0,
    });
  });
});

describe('Checkbox rendering', () => {
  test('every one of the 36 Figma variants renders', () => {
    let rendered = 0;
    for (const size of sizes) {
      for (const checked of values) {
        for (const state of states) {
          const tree = renderCheckbox(
            <Checkbox
              accessibilityLabel="Remember"
              checked={checked}
              disabled={state === 'disabled'}
              onChange={() => {}}
              size={size}
            />,
          );
          if (state === 'hover') {
            act(() => {
              pressableProps(tree.root).onHoverIn();
            });
          }
          expect(controlStyle(tree.root, size).height).toBe(
            checkboxSizeSpec(size).control,
          );
          rendered += 1;
          unmountTree(tree);
        }
      }
    }
    expect(rendered).toBe(36);
  });

  test.each(sizes)('%s draws the square and its state background', (size) => {
    const spec = checkboxSizeSpec(size);
    const tree = renderCheckbox(
      <Checkbox
        accessibilityLabel="Remember"
        checked={false}
        onChange={() => {}}
        size={size}
      />,
    );

    const control = controlStyle(tree.root, size);
    expect(control.width).toBe(spec.control);
    expect(control.borderRadius).toBe(spec.controlRadius);

    const stateBackground = stateBackgroundStyle(tree.root, size);
    expect(stateBackground.width).toBe(spec.stateSize);
    expect(stateBackground.borderRadius).toBe(spec.stateRadius);

    unmountTree(tree);
  });

  test.each(sizes)('%s answers a finger over at least 44 square', (size) => {
    const spec = checkboxSizeSpec(size);
    const tree = renderCheckbox(
      <Checkbox
        accessibilityLabel="Remember"
        checked={false}
        onChange={() => {}}
        size={size}
      />,
    );

    const root = rootStyle(tree.root);
    expect(root.padding).toBe(spec.targetPadding);
    expect(spec.stateSize + 2 * spec.targetPadding).toBe(44);
    // The square itself did not grow to get there.
    expect(controlStyle(tree.root, size).height).toBe(spec.control);

    unmountTree(tree);
  });

  test('a labelled row keeps the vertical target and lets the label widen it', () => {
    const spec = checkboxSizeSpec('medium');
    const tree = renderCheckbox(
      <Checkbox checked={false} label="Remember" onChange={() => {}} />,
    );

    const root = rootStyle(tree.root);
    expect(root.flexDirection).toBe('row');
    expect(root.paddingVertical).toBe(spec.targetPadding);
    expect(root.padding).toBeUndefined();

    unmountTree(tree);
  });

  test('the checkmark is drawn only when the box is on', () => {
    const glyphs = (tree: ReturnType<typeof create>) =>
      texts(tree.root).filter((node) => node.props.testID === 'mark-glyph');

    const off = renderCheckbox(
      <Checkbox
        accessibilityLabel="Remember"
        checked={false}
        onChange={() => {}}
      />,
    );
    expect(glyphs(off)).toHaveLength(0);
    unmountTree(off);

    const on = renderCheckbox(
      <Checkbox
        accessibilityLabel="Remember"
        checked
        onChange={() => {}}
      />,
    );
    expect(glyphs(on)).toHaveLength(1);
    expect(glyphs(on)[0].children.join('')).toBe('check:14');
    unmountTree(on);

    const mixed = renderCheckbox(
      <Checkbox
        accessibilityLabel="Remember"
        checked="mixed"
        onChange={() => {}}
      />,
    );
    expect(glyphs(mixed)).toHaveLength(0);
    unmountTree(mixed);
  });

  test.each(sizes)('%s draws the mixed bar centred in the control', (size) => {
    const spec = checkboxSizeSpec(size);
    const tree = renderCheckbox(
      <Checkbox
        accessibilityLabel="Remember"
        checked="mixed"
        onChange={() => {}}
        size={size}
      />,
    );

    const bar = hostViews(tree.root).find(
      (node) => flat(node).height === spec.mixedHeight,
    );
    if (!bar) {
      throw new Error('No mixed bar found');
    }
    const style = flat(bar);
    expect(style.width).toBe(spec.mixedWidth);
    expect(style.borderRadius).toBe(spec.mixedHeight / 2);
    expect(style.backgroundColor).toBe(theme.color.action.primary.content);

    unmountTree(tree);
  });

  test.each(palettes)('%s paints the control from its tokens', (_name, colors) => {
    mockPalette = colors;
    try {
      const empty = renderCheckbox(
        <Checkbox
          accessibilityLabel="Remember"
          checked={false}
          onChange={() => {}}
        />,
      );
      const emptyStyle = controlStyle(empty.root, 'medium');
      expect(emptyStyle.backgroundColor).toBe(colors.surface.raised);
      expect(emptyStyle.borderColor).toBe(colors.border.strong);
      expect(emptyStyle.borderWidth).toBe(theme.scale.stroke.hairline);
      unmountTree(empty);

      const ticked = renderCheckbox(
        <Checkbox accessibilityLabel="Remember" checked onChange={() => {}} />,
      );
      const tickedStyle = controlStyle(ticked.root, 'medium');
      expect(tickedStyle.backgroundColor).toBe(colors.action.primary.fill);
      expect(tickedStyle.borderWidth).toBe(0);
      unmountTree(ticked);
    } finally {
      mockPalette = theme.color;
    }
  });

  test('hover and pressed tint the state background only', () => {
    mockPalette = labelledPalette();
    try {
      const tree = renderCheckbox(
        <Checkbox
          accessibilityLabel="Remember"
          checked={false}
          onChange={() => {}}
        />,
      );

      expect(stateBackgroundStyle(tree.root, 'medium').backgroundColor).toBe(
        'transparent',
      );

      act(() => {
        pressableProps(tree.root).onHoverIn();
      });
      expect(stateBackgroundStyle(tree.root, 'medium').backgroundColor).toBe(
        'state.hover',
      );
      // The control kept its own fill through the hover.
      expect(controlStyle(tree.root, 'medium').backgroundColor).toBe(
        'surface.raised',
      );

      act(() => {
        pressableProps(tree.root).onHoverOut();
      });
      expect(stateBackgroundStyle(tree.root, 'medium').backgroundColor).toBe(
        'transparent',
      );

      unmountTree(tree);
    } finally {
      mockPalette = theme.color;
    }
  });

  test('a disabled box does not tint on hover', () => {
    mockPalette = labelledPalette();
    try {
      const tree = renderCheckbox(
        <Checkbox
          accessibilityLabel="Remember"
          checked={false}
          disabled
          onChange={() => {}}
        />,
      );
      act(() => {
        pressableProps(tree.root).onHoverIn();
      });
      expect(stateBackgroundStyle(tree.root, 'medium').backgroundColor).toBe(
        'transparent',
      );
      expect(controlStyle(tree.root, 'medium').backgroundColor).toBe(
        'field.disabledFill',
      );
      unmountTree(tree);
    } finally {
      mockPalette = theme.color;
    }
  });
});

describe('Checkbox behaviour', () => {
  test('a press asks for the next value and changes nothing by itself', () => {
    const onChange = jest.fn<(checked: boolean) => void>();
    const tree = renderCheckbox(
      <Checkbox checked={false} label="Remember" onChange={onChange} />,
    );

    act(() => {
      pressableProps(tree.root).onPress();
    });
    expect(onChange).toHaveBeenCalledWith(true);

    // Controlled: the box is still off, because the caller has not moved it.
    expect(pressableProps(tree.root)['aria-checked']).toBe(false);

    unmountTree(tree);
  });

  test('a press on a mixed box asks for on', () => {
    const onChange = jest.fn<(checked: boolean) => void>();
    const tree = renderCheckbox(
      <Checkbox checked="mixed" label="Remember" onChange={onChange} />,
    );
    act(() => {
      pressableProps(tree.root).onPress();
    });
    expect(onChange).toHaveBeenCalledWith(true);
    unmountTree(tree);
  });

  test('a press on a ticked box asks for off', () => {
    const onChange = jest.fn<(checked: boolean) => void>();
    const tree = renderCheckbox(
      <Checkbox checked label="Remember" onChange={onChange} />,
    );
    act(() => {
      pressableProps(tree.root).onPress();
    });
    expect(onChange).toHaveBeenCalledWith(false);
    unmountTree(tree);
  });

  test('a disabled box never calls back', () => {
    const onChange = jest.fn<(checked: boolean) => void>();
    const tree = renderCheckbox(
      <Checkbox checked={false} disabled label="Remember" onChange={onChange} />,
    );
    act(() => {
      pressableProps(tree.root).onPress();
    });
    expect(onChange).not.toHaveBeenCalled();
    unmountTree(tree);
  });

  test('Space is the toggle key, and Enter is not', () => {
    expect(isCheckboxToggleKey(' ')).toBe(true);
    expect(isCheckboxToggleKey('Spacebar')).toBe(true);
    expect(isCheckboxToggleKey('Enter')).toBe(false);
    expect(isCheckboxToggleKey('a')).toBe(false);
  });

  test('the label is inside the control, so pressing it toggles', () => {
    const onChange = jest.fn<(checked: boolean) => void>();
    const tree = renderCheckbox(
      <Checkbox
        checked={false}
        description="Skip entering your password"
        label="Remember this device"
        onChange={onChange}
      />,
    );

    const labelNode = texts(tree.root).find((node) =>
      node.children.join('').includes('Remember this device'),
    );
    if (!labelNode) {
      throw new Error('No label found');
    }
    // The label has no press handler of its own; the row above it has one.
    expect(labelNode.props.onPress).toBeUndefined();
    expect(pressable(tree.root).findAll((node) => node === labelNode)).toHaveLength(
      1,
    );

    unmountTree(tree);
  });
});

describe('Checkbox accessibility', () => {
  test.each(values)('%s is announced as a checkbox in that state', (checked) => {
    const tree = renderCheckbox(
      <Checkbox checked={checked} label="Remember" onChange={() => {}} />,
    );
    const props = pressableProps(tree.root);

    expect(props.accessibilityRole).toBe('checkbox');
    expect(props['aria-checked']).toBe(checkboxAriaChecked(checked));
    expect(props.accessibilityState.checked).toBe(checkboxAriaChecked(checked));

    unmountTree(tree);
  });

  test('the visible label names the control; an explicit one wins', () => {
    const fromLabel = renderCheckbox(
      <Checkbox checked={false} label="Remember" onChange={() => {}} />,
    );
    expect(pressableProps(fromLabel.root).accessibilityLabel).toBe('Remember');
    unmountTree(fromLabel);

    const explicit = renderCheckbox(
      <Checkbox
        accessibilityLabel="Remember this device"
        checked={false}
        label="Remember"
        onChange={() => {}}
      />,
    );
    expect(pressableProps(explicit.root).accessibilityLabel).toBe(
      'Remember this device',
    );
    unmountTree(explicit);
  });

  test('a box with no visible label is still named', () => {
    const tree = renderCheckbox(
      <Checkbox
        accessibilityLabel="Select this row"
        checked={false}
        onChange={() => {}}
      />,
    );
    expect(pressableProps(tree.root).accessibilityLabel).toBe('Select this row');
    expect(textStyles(tree.root)).toHaveLength(0);
    unmountTree(tree);
  });

  test('the description becomes the hint', () => {
    const tree = renderCheckbox(
      <Checkbox
        checked={false}
        description="Skip entering your password"
        label="Remember"
        onChange={() => {}}
      />,
    );
    expect(pressableProps(tree.root).accessibilityHint).toBe(
      'Skip entering your password',
    );
    unmountTree(tree);
  });

  test('the description is pointed at, because web has no hint', () => {
    const tree = renderCheckbox(
      <Checkbox
        checked={false}
        description="Skip entering your password"
        label="Remember"
        onChange={() => {}}
      />,
    );

    const describedBy = pressable(tree.root).props['aria-describedby'] as
      | string
      | undefined;
    expect(typeof describedBy).toBe('string');

    const target = texts(tree.root).find(
      (node) => node.props.id === describedBy,
    );
    if (!target) {
      throw new Error('aria-describedby points at nothing');
    }
    expect(target.children.join('')).toBe('Skip entering your password');

    unmountTree(tree);
  });

  test('a box with no description points at nothing', () => {
    const tree = renderCheckbox(
      <Checkbox checked={false} label="Remember" onChange={() => {}} />,
    );
    expect(pressable(tree.root).props['aria-describedby']).toBeUndefined();
    unmountTree(tree);
  });

  test('two checkboxes on one screen do not share a description id', () => {
    const tree = renderCheckbox(
      <>
        <Checkbox
          checked={false}
          description="First"
          label="One"
          onChange={() => {}}
        />
        <Checkbox
          checked={false}
          description="Second"
          label="Two"
          onChange={() => {}}
        />
      </>,
    );
    const ids = tree.root
      .findAll(
        (node) =>
          typeof node.type !== 'string' &&
          // The fragment this renders has no props at all.
          node.props !== null &&
          node.props.accessibilityRole === 'checkbox' &&
          typeof node.props.onPress === 'function',
      )
      .map((node) => node.props['aria-describedby'] as string);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    unmountTree(tree);
  });

  test('the row is the only focus stop, and a disabled one leaves the order', () => {
    const enabled = renderCheckbox(
      <Checkbox
        checked={false}
        description="Skip entering your password"
        label="Remember"
        onChange={() => {}}
      />,
    );
    // One host element in the whole tree can take focus: the row. The label
    // and the description are plain text under it, not stops of their own.
    const stops = enabled.root.findAll(
      (node) => typeof node.type === 'string' && node.props.focusable === true,
    );
    expect(stops).toHaveLength(1);
    for (const node of texts(enabled.root)) {
      expect(node.props.focusable).toBeUndefined();
      expect(node.props.onPress).toBeUndefined();
    }
    unmountTree(enabled);

    const disabled = renderCheckbox(
      <Checkbox checked={false} disabled label="Remember" onChange={() => {}} />,
    );
    const props = pressableProps(disabled.root);
    expect(props.focusable).toBe(false);
    expect(props.disabled).toBe(true);
    expect(props['aria-disabled']).toBe(true);
    expect(props.accessibilityState.disabled).toBe(true);
    unmountTree(disabled);
  });
});

describe('Checkbox typography', () => {
  test.each(sizes)('%s uses its own label and description styles', (size) => {
    const spec = checkboxSizeSpec(size);
    const tree = renderCheckbox(
      <Checkbox
        checked={false}
        description="Skip entering your password"
        label="Remember"
        onChange={() => {}}
        size={size}
      />,
    );

    const [label, description] = textStyles(tree.root);
    expect(label.fontSize).toBe(spec.labelType.fontSize);
    expect(label.lineHeight).toBe(spec.labelType.lineHeight);
    expect(label.fontFamily).toBe(spec.labelType.fontFamily);
    expect(description.fontSize).toBe(spec.descriptionType.fontSize);
    expect(description.lineHeight).toBe(spec.descriptionType.lineHeight);
    expect(description.fontFamily).toBe(spec.descriptionType.fontFamily);

    unmountTree(tree);
  });

  test.each(palettes)('%s colours the copy from its tokens', (_name, colors) => {
    mockPalette = colors;
    try {
      const tree = renderCheckbox(
        <Checkbox
          checked={false}
          description="Skip entering your password"
          label="Remember"
          onChange={() => {}}
        />,
      );
      const [label, description] = textStyles(tree.root);
      expect(label.color).toBe(colors.text.primary);
      expect(description.color).toBe(colors.text.secondary);
      unmountTree(tree);

      const off = renderCheckbox(
        <Checkbox
          checked={false}
          description="Skip entering your password"
          disabled
          label="Remember"
          onChange={() => {}}
        />,
      );
      const [disabledLabel, disabledDescription] = textStyles(off.root);
      expect(disabledLabel.color).toBe(colors.text.disabled);
      expect(disabledDescription.color).toBe(colors.text.disabled);
      unmountTree(off);
    } finally {
      mockPalette = theme.color;
    }
  });

  test('the new text tokens say what Figma draws', () => {
    expect(theme.type.labelSmall).toMatchObject({
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      lineHeight: 20,
    });
    expect(theme.type.bodySmall).toMatchObject({
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      lineHeight: 20,
    });
    expect(theme.type.captionSmall).toMatchObject({
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 16,
    });
  });
});

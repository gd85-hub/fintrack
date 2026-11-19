import { describe, expect, jest, test } from '@jest/globals';
import Feather from '@expo/vector-icons/Feather';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { act, create, type ReactTestInstance } from 'react-test-renderer';

import {
  InputField,
  type InputFieldColors,
  inputFieldContentHeight,
  inputFieldMetrics,
  inputFieldSurface,
} from '../../components/ds/InputField';
import { labelledPalette } from '../__fixtures__/buttonPalette';
import { darkColor, theme } from '../theme';

let mockPalette: InputFieldColors = theme.color;

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

const themes: [string, InputFieldColors][] = [
  ['light', theme.color],
  ['dark', darkColor],
];

function renderField(node: React.ReactElement) {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(node);
  });
  if (!tree) {
    throw new Error('InputField did not render');
  }
  return tree;
}

function unmountTree(tree: ReturnType<typeof create>) {
  act(() => {
    tree.unmount();
  });
}

type InputProps = {
  accessibilityLabel?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  disabled?: boolean;
  onBlur: () => void;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  placeholder?: string;
  placeholderTextColor: string;
  readOnly: boolean;
  secureTextEntry?: boolean;
  style: TextStyle;
  value: string;
};

function input(root: ReactTestInstance): InputProps {
  return root.findByType(TextInput).props as InputProps;
}

// The field frame: the only host view carrying the DS height.
function frame(root: ReactTestInstance): ViewStyle {
  const host = root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      node.type.toLowerCase() === 'view' &&
      StyleSheet.flatten(node.props.style as ViewStyle).height ===
        inputFieldMetrics.height,
  )[0];
  return StyleSheet.flatten(host.props.style as ViewStyle);
}

function labelStyle(root: ReactTestInstance, text: string): TextStyle {
  const node = root
    .findAllByType(Text)
    .find((candidate) => candidate.props.children === text);
  if (!node) {
    throw new Error(`No text node for ${text}`);
  }
  return StyleSheet.flatten(node.props.style as TextStyle);
}

function focus(root: ReactTestInstance) {
  act(() => {
    input(root).onFocus();
  });
}

function blur(root: ReactTestInstance) {
  act(() => {
    input(root).onBlur();
  });
}

describe('InputField geometry', () => {
  test('the frame is 56 tall whatever the state', () => {
    for (const props of [
      {},
      { error: true },
      { readOnly: true },
      { disabled: true },
    ]) {
      const tree = renderField(
        <InputField label="Label" onChangeText={() => {}} value="" {...props} />,
      );
      expect(frame(tree.root).height).toBe(56);
      focus(tree.root);
      expect(frame(tree.root).height).toBe(56);
      unmountTree(tree);
    }
  });

  test('focus thickens the border and gives back the same padding', () => {
    // The border eats into the box in React Native, so without the give-back
    // the text would jump sideways the moment the field is focused.
    const tree = renderField(
      <InputField label="Label" onChangeText={() => {}} value="" />,
    );
    const resting = frame(tree.root);
    expect(resting.borderWidth).toBe(1);

    focus(tree.root);
    const focused = frame(tree.root);
    expect(focused.borderWidth).toBe(2);

    for (const [side, total] of [
      ['paddingLeft', inputFieldMetrics.paddingLeft],
      ['paddingRight', inputFieldMetrics.paddingRight],
      ['paddingVertical', inputFieldMetrics.paddingVertical],
    ] as const) {
      expect({
        side,
        resting: Number(resting[side]) + Number(resting.borderWidth),
        focused: Number(focused[side]) + Number(focused.borderWidth),
      }).toEqual({ side, resting: total, focused: total });
    }
  });

  test('focus changes nothing else about the frame', () => {
    const tree = renderField(
      <InputField label="Label" onChangeText={() => {}} value="" />,
    );
    const before = { ...frame(tree.root) };
    focus(tree.root);
    const after = frame(tree.root);
    expect({
      height: after.height,
      borderRadius: after.borderRadius,
      backgroundColor: after.backgroundColor,
    }).toEqual({
      height: before.height,
      borderRadius: before.borderRadius,
      backgroundColor: before.backgroundColor,
    });
  });

  test('the input keeps its line height and never moves with the label', () => {
    const tree = renderField(
      <InputField label="Label" onChangeText={() => {}} value="" />,
    );
    const resting = input(tree.root).style;
    const restingBox = StyleSheet.flatten(resting);
    focus(tree.root);
    const focusedBox = StyleSheet.flatten(input(tree.root).style);
    expect({ top: focusedBox.top, height: focusedBox.height }).toEqual({
      top: restingBox.top,
      height: restingBox.height,
    });
    expect(focusedBox.height).toBe(inputFieldMetrics.valueHeight);
  });

  test('a field without a label centres its value instead of anchoring it', () => {
    const withLabel = renderField(
      <InputField label="Label" onChangeText={() => {}} value="" />,
    );
    expect(StyleSheet.flatten(input(withLabel.root).style).position).toBe(
      'absolute',
    );
    unmountTree(withLabel);

    const without = renderField(<InputField onChangeText={() => {}} value="" />);
    expect(StyleSheet.flatten(input(without.root).style).position).toBeUndefined();
  });
});

describe('InputField floating label', () => {
  test('an empty resting field centres the label at 16/22', () => {
    const tree = renderField(
      <InputField label="Merchant" onChangeText={() => {}} value="" />,
    );
    const style = labelStyle(tree.root, 'Merchant');
    expect({ fontSize: style.fontSize, lineHeight: style.lineHeight }).toEqual({
      fontSize: 16,
      lineHeight: 22,
    });
    expect(style.top).toBe((inputFieldContentHeight - 22) / 2);
  });

  test('focus floats the label to 12/14 at the top', () => {
    const tree = renderField(
      <InputField label="Merchant" onChangeText={() => {}} value="" />,
    );
    focus(tree.root);
    const style = labelStyle(tree.root, 'Merchant');
    expect({ fontSize: style.fontSize, lineHeight: style.lineHeight, top: style.top }).toEqual({
      fontSize: 12,
      lineHeight: 14,
      top: 0,
    });
  });

  test('a value floats the label without any focus', () => {
    const tree = renderField(
      <InputField label="Merchant" onChangeText={() => {}} value="Maxi" />,
    );
    expect(labelStyle(tree.root, 'Merchant').fontSize).toBe(12);
  });

  test('clearing a focused field leaves the label up, and blur drops it', () => {
    const tree = renderField(
      <InputField label="Merchant" onChangeText={() => {}} value="Maxi" />,
    );
    focus(tree.root);
    act(() => {
      tree.update(
        <InputField label="Merchant" onChangeText={() => {}} value="" />,
      );
    });
    expect(labelStyle(tree.root, 'Merchant').fontSize).toBe(12);

    blur(tree.root);
    expect(labelStyle(tree.root, 'Merchant').fontSize).toBe(16);
  });

  test('the label is painted over the input, never beside it', () => {
    // Absolute, so floating it cannot reflow the field or shift the caret.
    const tree = renderField(
      <InputField label="Merchant" onChangeText={() => {}} value="" />,
    );
    expect(labelStyle(tree.root, 'Merchant').position).toBe('absolute');
  });
});

describe('InputField placeholder', () => {
  test('with a label the placeholder waits for focus', () => {
    const tree = renderField(
      <InputField
        label="Merchant"
        onChangeText={() => {}}
        placeholder="Maxi"
        value=""
      />,
    );
    expect(input(tree.root).placeholder).toBeUndefined();
    focus(tree.root);
    expect(input(tree.root).placeholder).toBe('Maxi');
  });

  test('without a label it is there from the start', () => {
    const tree = renderField(
      <InputField onChangeText={() => {}} placeholder="Maxi" value="" />,
    );
    expect(input(tree.root).placeholder).toBe('Maxi');
  });

  test('its colour follows the state', () => {
    mockPalette = labelledPalette();
    const cases = [
      [{}, mockPalette.field.softPlaceholder],
      [{ readOnly: true }, mockPalette.field.readOnlyContent],
      [{ disabled: true }, mockPalette.field.disabledContent],
    ] as const;
    for (const [props, expected] of cases) {
      const tree = renderField(
        <InputField onChangeText={() => {}} placeholder="Maxi" value="" {...props} />,
      );
      expect(input(tree.root).placeholderTextColor).toBe(expected);
      unmountTree(tree);
    }
    mockPalette = theme.color;
  });
});

describe('InputField typing', () => {
  test('it is one real TextInput, controlled by value', () => {
    const tree = renderField(
      <InputField label="Merchant" onChangeText={() => {}} value="Maxi" />,
    );
    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
    expect(input(tree.root).value).toBe('Maxi');
  });

  test('every keystroke reaches onChangeText', () => {
    const onChangeText = jest.fn();
    const tree = renderField(
      <InputField label="Merchant" onChangeText={onChangeText} value="" />,
    );
    act(() => {
      input(tree.root).onChangeText('M');
      input(tree.root).onChangeText('Ma');
    });
    expect(onChangeText.mock.calls).toEqual([['M'], ['Ma']]);
  });

  test('the same input instance survives focus, typing and blur', () => {
    // A remount would lose the caret and the keyboard mid-word.
    const tree = renderField(
      <InputField label="Merchant" onChangeText={() => {}} value="" />,
    );
    const instance = tree.root.findByType(TextInput);
    focus(tree.root);
    act(() => {
      tree.update(
        <InputField label="Merchant" onChangeText={() => {}} value="Ma" />,
      );
    });
    blur(tree.root);
    expect(tree.root.findByType(TextInput)).toBe(instance);
  });

  test('onFocus and onBlur still reach the caller', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const tree = renderField(
      <InputField
        label="Merchant"
        onBlur={onBlur}
        onChangeText={() => {}}
        onFocus={onFocus}
        value=""
      />,
    );
    focus(tree.root);
    blur(tree.root);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test('a ref reaches the input for programmatic focus', () => {
    const ref = { current: null as TextInput | null };
    renderField(
      <InputField label="Merchant" onChangeText={() => {}} ref={ref} value="" />,
    );
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.focus).toBe('function');
  });
});

describe('InputField accessibility', () => {
  test('the accessible name comes from the label, then the placeholder', () => {
    const labelled = renderField(
      <InputField label="Merchant" onChangeText={() => {}} placeholder="Maxi" value="" />,
    );
    expect(input(labelled.root).accessibilityLabel).toBe('Merchant');
    unmountTree(labelled);

    const bare = renderField(
      <InputField onChangeText={() => {}} placeholder="Maxi" value="" />,
    );
    expect(input(bare.root).accessibilityLabel).toBe('Maxi');
    unmountTree(bare);

    const overridden = renderField(
      <InputField
        accessibilityLabel="Where you shopped"
        label="Merchant"
        onChangeText={() => {}}
        value=""
      />,
    );
    expect(input(overridden.root).accessibilityLabel).toBe('Where you shopped');
  });

  test('read-only is readable and focusable but not editable', () => {
    const tree = renderField(
      <InputField label="Rate" onChangeText={() => {}} readOnly value="117,5" />,
    );
    const props = input(tree.root);
    expect(props.readOnly).toBe(true);
    // Not disabled: the text can still be focused, selected and copied.
    expect(props.disabled).toBe(false);
  });

  test('disabled is out of the tab order and not editable', () => {
    const tree = renderField(
      <InputField disabled label="Rate" onChangeText={() => {}} value="117,5" />,
    );
    const props = input(tree.root);
    expect(props.disabled).toBe(true);
    expect(props.readOnly).toBe(true);
  });

  test('an invalid field says so, and a valid one says so too', () => {
    // react-native-web reads aria-invalid and never looks at
    // accessibilityState, so the flag has to travel as an aria prop.
    const valid = renderField(
      <InputField label="Email" onChangeText={() => {}} value="" />,
    );
    expect(input(valid.root)['aria-invalid']).toBe(false);
    unmountTree(valid);

    for (const props of [{ error: true }, { errorText: 'Enter a valid email.' }]) {
      const tree = renderField(
        <InputField label="Email" onChangeText={() => {}} value="" {...props} />,
      );
      expect(input(tree.root)['aria-invalid']).toBe(true);
      unmountTree(tree);
    }
  });

  test('supporting text is tied to the field by id', () => {
    for (const props of [{ hint: 'We only use it to sign you in.' }, { errorText: 'Enter a valid email.' }]) {
      const tree = renderField(
        <InputField label="Email" onChangeText={() => {}} value="" {...props} />,
      );
      const described = input(tree.root)['aria-describedby'];
      expect(described).toBeTruthy();
      const supporting = tree.root
        .findAllByType(Text)
        .find((node) => node.props.nativeID === described);
      expect(supporting?.props.children).toBe(Object.values(props)[0]);
      unmountTree(tree);
    }
  });

  test('a field with no supporting text describes nothing', () => {
    const tree = renderField(
      <InputField label="Email" onChangeText={() => {}} value="" />,
    );
    expect(input(tree.root)['aria-describedby']).toBeUndefined();
  });
});

describe('InputField supporting text', () => {
  test('a hint renders under the field with the hint gap', () => {
    const tree = renderField(
      <InputField hint="Up to two decimals." label="Amount" onChangeText={() => {}} value="" />,
    );
    const node = tree.root
      .findAllByType(Text)
      .find((candidate) => candidate.props.children === 'Up to two decimals.');
    const style = StyleSheet.flatten(node?.props.style as TextStyle);
    expect(style.paddingTop).toBe(inputFieldMetrics.hintGap);
    expect(style.color).toBe(theme.color.text.tertiary);
  });

  test('error text replaces the hint and uses the error gap and token', () => {
    const tree = renderField(
      <InputField
        errorText="Enter a valid email."
        hint="We only use it to sign you in."
        label="Email"
        onChangeText={() => {}}
        value=""
      />,
    );
    const texts = tree.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContain('Enter a valid email.');
    expect(texts).not.toContain('We only use it to sign you in.');

    const node = tree.root
      .findAllByType(Text)
      .find((candidate) => candidate.props.children === 'Enter a valid email.');
    const style = StyleSheet.flatten(node?.props.style as TextStyle);
    expect(style.paddingTop).toBe(inputFieldMetrics.errorGap);
    expect(style.color).toBe(theme.color.field.supportingError);
  });

  test('an error without a message adds no text and no height', () => {
    const tree = renderField(
      <InputField error label="Email" onChangeText={() => {}} value="" />,
    );
    // Only the label; nothing underneath the field.
    expect(tree.root.findAllByType(Text)).toHaveLength(1);
    expect(frame(tree.root).height).toBe(56);
  });

  test('no supporting text leaves no empty space behind', () => {
    const tree = renderField(
      <InputField label="Email" onChangeText={() => {}} value="" />,
    );
    const spacers = tree.root
      .findAllByType(Text)
      .filter((node) => node.props.nativeID !== undefined);
    expect(spacers).toHaveLength(0);
  });
});

describe('InputField icons', () => {
  test('the two slots are independent', () => {
    const cases: [string | undefined, string | undefined, string[]][] = [
      [undefined, undefined, []],
      ['map-pin', undefined, ['map-pin']],
      [undefined, 'chevron-down', ['chevron-down']],
      ['map-pin', 'chevron-down', ['map-pin', 'chevron-down']],
    ];
    for (const [leading, trailing, expected] of cases) {
      const tree = renderField(
        <InputField
          label="Merchant"
          leadingIcon={leading as never}
          onChangeText={() => {}}
          trailingIcon={trailing as never}
          value=""
        />,
      );
      expect(
        tree.root.findAllByType(Feather).map((node) => String(node.props.name)),
      ).toEqual(expected);
      unmountTree(tree);
    }
  });

  test('the field sizes and tints its icons, in both themes', () => {
    for (const [scheme, palette] of themes) {
      mockPalette = palette;
      for (const props of [{}, { disabled: true }]) {
        const tree = renderField(
          <InputField
            label="Merchant"
            leadingIcon="map-pin"
            onChangeText={() => {}}
            trailingIcon="chevron-down"
            value=""
            {...props}
          />,
        );
        const expected = inputFieldSurface(palette, 'softFilled', props).icon;
        for (const node of tree.root.findAllByType(Feather)) {
          expect({ scheme, size: node.props.size, color: node.props.color }).toEqual({
            scheme,
            size: inputFieldMetrics.iconSize,
            color: expected,
          });
        }
        unmountTree(tree);
      }
    }
    mockPalette = theme.color;
  });

  test('a decorative trailing icon is not a control', () => {
    const tree = renderField(
      <InputField
        label="Merchant"
        onChangeText={() => {}}
        trailingIcon="chevron-down"
        value=""
      />,
    );
    const buttons = tree.root.findAll(
      (node) =>
        typeof node.type !== 'string' &&
        node.props.accessibilityRole === 'button',
    );
    expect(buttons).toHaveLength(0);
  });

  test('an interactive trailing icon is a named button that fires', () => {
    const onTrailingIconPress = jest.fn();
    const tree = renderField(
      <InputField
        label="Password"
        onChangeText={() => {}}
        onTrailingIconPress={onTrailingIconPress}
        trailingIcon="eye"
        trailingIconAccessibilityLabel="Show password"
        value="hunter2"
      />,
    );
    const button = tree.root.find(
      (node) =>
        typeof node.type !== 'string' &&
        node.props.accessibilityRole === 'button' &&
        typeof node.props.onPress === 'function',
    );
    expect(button.props.accessibilityLabel).toBe('Show password');
    act(() => {
      button.props.onPress();
    });
    expect(onTrailingIconPress).toHaveBeenCalledTimes(1);
    // Pressing it must not disturb what is being typed.
    expect(input(tree.root).value).toBe('hunter2');
  });

  test('a disabled field disables its trailing action too', () => {
    const tree = renderField(
      <InputField
        disabled
        label="Password"
        onChangeText={() => {}}
        onTrailingIconPress={() => {}}
        trailingIcon="eye"
        trailingIconAccessibilityLabel="Show password"
        value="hunter2"
      />,
    );
    const button = tree.root.find(
      (node) =>
        typeof node.type !== 'string' &&
        node.props.accessibilityRole === 'button' &&
        typeof node.props.onPress === 'function',
    );
    expect(button.props.disabled).toBe(true);
    expect(button.props.focusable).toBe(false);
  });

  test('secureTextEntry can be toggled without remounting the input', () => {
    const tree = renderField(
      <InputField label="Password" onChangeText={() => {}} secureTextEntry value="hunter2" />,
    );
    const instance = tree.root.findByType(TextInput);
    expect(input(tree.root).secureTextEntry).toBe(true);
    act(() => {
      tree.update(
        <InputField
          label="Password"
          onChangeText={() => {}}
          secureTextEntry={false}
          value="hunter2"
        />,
      );
    });
    expect(input(tree.root).secureTextEntry).toBe(false);
    expect(tree.root.findByType(TextInput)).toBe(instance);
    expect(input(tree.root).value).toBe('hunter2');
  });
});

describe('InputField appearances', () => {
  test('all 24 Figma configurations render with their contract colours', () => {
    // 2 appearances x 6 states x empty/filled, checked against the surface
    // contract rather than against raw hex.
    for (const [scheme, palette] of themes) {
      mockPalette = palette;
      for (const appearance of ['softFilled', 'cleanOutline'] as const) {
        for (const [name, props, state] of [
          ['default', {}, {}],
          ['error', { error: true }, { error: true }],
          ['read-only', { readOnly: true }, { readOnly: true }],
          ['disabled', { disabled: true }, { disabled: true }],
        ] as const) {
          for (const value of ['', 'Maxi Zemun']) {
            const tree = renderField(
              <InputField
                appearance={appearance}
                label="Merchant"
                onChangeText={() => {}}
                value={value}
                {...props}
              />,
            );
            const expected = inputFieldSurface(palette, appearance, state);
            const style = frame(tree.root);
            expect({
              scheme,
              appearance,
              name,
              value,
              background: style.backgroundColor,
              border: style.borderColor,
              borderWidth: style.borderWidth,
            }).toEqual({
              scheme,
              appearance,
              name,
              value,
              background: expected.background,
              border: expected.border,
              borderWidth: expected.borderWidth,
            });
            unmountTree(tree);
          }

          // The focus half of the matrix, reached the way a user reaches it.
          const focusTree = renderField(
            <InputField
              appearance={appearance}
              label="Merchant"
              onChangeText={() => {}}
              value=""
              {...props}
            />,
          );
          focus(focusTree.root);
          const focusExpected = inputFieldSurface(palette, appearance, {
            ...state,
            focused: true,
          });
          expect(frame(focusTree.root).borderColor).toBe(focusExpected.border);
          unmountTree(focusTree);
        }
      }
    }
    mockPalette = theme.color;
  });

  test('hover paints an overlay over the fill, not instead of it', () => {
    mockPalette = labelledPalette();
    const tree = renderField(
      <InputField label="Merchant" onChangeText={() => {}} value="" />,
    );
    const field = tree.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        node.type.toLowerCase() === 'view' &&
        StyleSheet.flatten(node.props.style as ViewStyle).height ===
          inputFieldMetrics.height,
    )[0];
    act(() => {
      field.props.onPointerEnter();
    });

    const style = frame(tree.root);
    expect(style.backgroundColor).toBe(mockPalette.field.softFill);
    const overlays = tree.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        node.type.toLowerCase() === 'view' &&
        StyleSheet.flatten(node.props.style as ViewStyle).backgroundColor ===
          mockPalette.field.hoverOverlay,
    );
    expect(overlays).toHaveLength(1);
    expect(
      StyleSheet.flatten(overlays[0].props.style as ViewStyle).pointerEvents,
    ).toBe('none');

    act(() => {
      field.props.onPointerLeave();
    });
    expect(
      tree.root.findAll(
        (node) =>
          typeof node.type === 'string' &&
          StyleSheet.flatten(node.props.style as ViewStyle).backgroundColor ===
            mockPalette.field.hoverOverlay,
      ),
    ).toHaveLength(0);
    mockPalette = theme.color;
  });

  test('a disabled field does not light up under the pointer', () => {
    mockPalette = labelledPalette();
    const tree = renderField(
      <InputField disabled label="Merchant" onChangeText={() => {}} value="" />,
    );
    const field = tree.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        node.type.toLowerCase() === 'view' &&
        StyleSheet.flatten(node.props.style as ViewStyle).height ===
          inputFieldMetrics.height,
    )[0];
    const before = frame(tree.root).backgroundColor;
    act(() => {
      field.props.onPointerEnter();
    });
    expect(frame(tree.root).backgroundColor).toBe(before);
    expect(
      tree.root.findAll(
        (node) =>
          typeof node.type === 'string' &&
          StyleSheet.flatten(node.props.style as ViewStyle).backgroundColor ===
            mockPalette.field.hoverOverlay,
      ),
    ).toHaveLength(0);
    mockPalette = theme.color;
  });
});

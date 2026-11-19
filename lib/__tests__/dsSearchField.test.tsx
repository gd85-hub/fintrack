import { describe, expect, jest, test } from '@jest/globals';
import Feather from '@expo/vector-icons/Feather';
import {
  StyleSheet,
  TextInput,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { act, create, type ReactTestInstance } from 'react-test-renderer';

import {
  SearchField,
  type SearchFieldColors,
  searchFieldFocusRing,
  searchFieldMetrics,
  searchFieldSurface,
} from '../../components/ds/SearchField';
import { labelledPalette } from '../__fixtures__/buttonPalette';
import { darkColor, theme } from '../theme';

// Asserts the Figma Search Field spec (set 597:5010) against the tokens it
// must bind, not against raw hex values.
let mockPalette: SearchFieldColors = theme.color;

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

const themes: [string, SearchFieldColors][] = [
  ['light', theme.color],
  ['dark', darkColor],
];

const palettes: [string, SearchFieldColors][] = [
  ...themes,
  ['labelled', labelledPalette()],
];

function renderSearch(node: React.ReactElement) {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(node);
  });
  if (!tree) {
    throw new Error('SearchField did not render');
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
  disabled?: boolean;
  onBlur: () => void;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  placeholder?: string;
  placeholderTextColor: string;
  readOnly: boolean;
  style: TextStyle;
  value: string;
};

function input(root: ReactTestInstance): InputProps {
  return root.findByType(TextInput).props as InputProps;
}

// The pill: the only host view carrying the DS field height.
function pill(root: ReactTestInstance) {
  return root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      node.type.toLowerCase() === 'view' &&
      StyleSheet.flatten(node.props.style as ViewStyle).height ===
        searchFieldMetrics.height,
  )[0];
}

function pillStyle(root: ReactTestInstance): ViewStyle {
  return StyleSheet.flatten(pill(root).props.style as ViewStyle);
}

function focus(root: ReactTestInstance) {
  act(() => {
    input(root).onFocus();
  });
}

describe('searchFieldMetrics', () => {
  test('a 40 pill inside a 44 root, fully rounded', () => {
    expect(searchFieldMetrics.height).toBe(40);
    expect(searchFieldMetrics.rootHeight).toBe(44);
    expect(searchFieldMetrics.radius).toBe(999);
    // Figma binds size/field-height and size/touch-target here.
    expect(searchFieldMetrics.height).toBe(theme.scale.size.fieldHeight);
    expect(searchFieldMetrics.rootHeight).toBe(theme.scale.size.touchTarget);
    expect(searchFieldMetrics.radius).toBe(theme.scale.radius.pill);
  });

  test('padding 16, gap 8', () => {
    expect(searchFieldMetrics.paddingHorizontal).toBe(16);
    expect(searchFieldMetrics.gap).toBe(8);
  });

  test('the search glyph is 18 and the trailing slot 20, both at stroke 2', () => {
    expect(searchFieldMetrics.searchIconSize).toBe(18);
    expect(searchFieldMetrics.trailingIconSize).toBe(20);
    expect(searchFieldMetrics.trailingIconSize).toBe(theme.scale.size.iconMd);
    expect(searchFieldMetrics.iconStrokeWidth).toBe(2);
  });

  test('the ring is 2 wide at 2 offset, and the root leaves it room', () => {
    expect(searchFieldMetrics.focusRingWidth).toBe(2);
    expect(searchFieldMetrics.focusRingOffset).toBe(2);
    // 40 + 2 + 2 = 44: the ring reaches exactly the root's edge.
    expect(
      searchFieldMetrics.height +
        searchFieldMetrics.focusRingOffset +
        searchFieldMetrics.focusRingWidth,
    ).toBe(searchFieldMetrics.rootHeight);
  });

  test('the content lines up with the Figma variant', () => {
    // Figma 597:4994: glyph at x=16, text at x=42.
    expect(searchFieldMetrics.paddingHorizontal).toBe(16);
    expect(
      searchFieldMetrics.paddingHorizontal +
        searchFieldMetrics.searchIconSize +
        searchFieldMetrics.gap,
    ).toBe(42);
  });
});

describe('searchFieldSurface', () => {
  test('resting binds the search pill of its own', () => {
    for (const [scheme, palette] of palettes) {
      expect({ scheme, ...searchFieldSurface(palette) }).toEqual({
        scheme,
        background: palette.field.searchFill,
        content: palette.text.primary,
        placeholder: palette.field.softPlaceholder,
        icon: palette.icon.secondary,
      });
    }
  });

  test('disabled goes quiet, icons included', () => {
    for (const [scheme, palette] of palettes) {
      expect({ scheme, ...searchFieldSurface(palette, { disabled: true }) }).toEqual({
        scheme,
        background: palette.field.subtleDisabledFill,
        content: palette.field.disabledContent,
        placeholder: palette.field.disabledContent,
        // Deliberate: both glyphs use the icon token, not the field one, so
        // the acting icon and the search glyph stay consistent.
        icon: palette.icon.disabled,
      });
    }
  });

  test('the search fill is its own token, not the input field one', () => {
    const palette = labelledPalette();
    expect(searchFieldSurface(palette).background).toBe(
      palette.field.searchFill,
    );
    expect(palette.field.searchFill).not.toBe(palette.field.softFill);
  });

  test('dark keeps the authored transparency', () => {
    expect(darkColor.field.searchFill).toBe('#ffffff08');
    expect(theme.color.field.searchFill).toBe('#f4f6f8');
  });

  test('there are only two states', () => {
    // No hover, pressed, error or read-only: the contract has none.
    const palette = labelledPalette();
    expect(searchFieldSurface(palette)).not.toEqual(
      searchFieldSurface(palette, { disabled: true }),
    );
  });
});

describe('searchFieldFocusRing', () => {
  test('a visible ring is 2 wide at 2 offset in the focus token', () => {
    for (const [scheme, palette] of palettes) {
      expect({ scheme, ...searchFieldFocusRing(palette, true) }).toEqual({
        scheme,
        outlineColor: palette.field.softFocusBorder,
        outlineOffset: 2,
        outlineStyle: 'solid',
        outlineWidth: 2,
      });
    }
  });

  test('a hidden ring keeps an author outline style, so the browser draws none', () => {
    for (const [, palette] of palettes) {
      expect(searchFieldFocusRing(palette, false)).toEqual({
        outlineColor: 'transparent',
        outlineOffset: 0,
        outlineStyle: 'solid',
        outlineWidth: 0,
      });
    }
  });

  test('the ring touches nothing that takes part in layout', () => {
    for (const visible of [true, false]) {
      expect(
        Object.keys(searchFieldFocusRing(theme.color, visible)).sort(),
      ).toEqual([
        'outlineColor',
        'outlineOffset',
        'outlineStyle',
        'outlineWidth',
      ]);
    }
  });
});

describe('SearchField rendering', () => {
  test('the pill is 40 tall and fully rounded, in both themes', () => {
    for (const [scheme, palette] of themes) {
      mockPalette = palette;
      const tree = renderSearch(
        <SearchField onChangeText={() => {}} placeholder="Search" value="" />,
      );
      const style = pillStyle(tree.root);
      expect({ scheme, height: style.height, radius: style.borderRadius }).toEqual({
        scheme,
        height: 40,
        radius: 999,
      });
      expect(style.backgroundColor).toBe(palette.field.searchFill);
      // Borderless by contract.
      expect(style.borderWidth).toBeUndefined();
      unmountTree(tree);
    }
    mockPalette = theme.color;
  });

  test('the search glyph is always there, at 18', () => {
    const tree = renderSearch(
      <SearchField onChangeText={() => {}} placeholder="Search" value="" />,
    );
    const glyphs = tree.root.findAllByType(Feather);
    expect(glyphs).toHaveLength(1);
    expect({ name: glyphs[0].props.name, size: glyphs[0].props.size }).toEqual({
      name: 'search',
      size: 18,
    });
  });

  test('focus draws the ring and changes nothing else', () => {
    const tree = renderSearch(
      <SearchField onChangeText={() => {}} placeholder="Search" value="" />,
    );
    const resting = { ...pillStyle(tree.root) };
    focus(tree.root);
    const focused = pillStyle(tree.root);
    expect({
      height: focused.height,
      radius: focused.borderRadius,
      background: focused.backgroundColor,
      padding: focused.paddingHorizontal,
    }).toEqual({
      height: resting.height,
      radius: resting.borderRadius,
      background: resting.backgroundColor,
      padding: resting.paddingHorizontal,
    });
  });

  test('a disabled field never rings, even if focus reaches it', () => {
    const tree = renderSearch(
      <SearchField disabled onChangeText={() => {}} placeholder="Search" value="" />,
    );
    focus(tree.root);
    // Platform is native under Jest, so the outline is absent entirely; the
    // decision itself is covered by searchFieldFocusRing above.
    expect(pillStyle(tree.root).outlineWidth).toBeUndefined();
  });

  test('it is one controlled TextInput', () => {
    const onChangeText = jest.fn();
    const tree = renderSearch(
      <SearchField onChangeText={onChangeText} placeholder="Search" value="Maxi" />,
    );
    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
    expect(input(tree.root).value).toBe('Maxi');
    act(() => {
      input(tree.root).onChangeText('Maxi Z');
    });
    expect(onChangeText).toHaveBeenCalledWith('Maxi Z');
  });

  test('typing never remounts the input', () => {
    const tree = renderSearch(
      <SearchField onChangeText={() => {}} placeholder="Search" value="" />,
    );
    const instance = tree.root.findByType(TextInput);
    focus(tree.root);
    act(() => {
      tree.update(
        <SearchField onChangeText={() => {}} placeholder="Search" value="Ma" />,
      );
    });
    expect(tree.root.findByType(TextInput)).toBe(instance);
  });

  test('the placeholder shows at rest and in focus, in its own token', () => {
    mockPalette = labelledPalette();
    const tree = renderSearch(
      <SearchField onChangeText={() => {}} placeholder="Search" value="" />,
    );
    expect(input(tree.root).placeholder).toBe('Search');
    expect(input(tree.root).placeholderTextColor).toBe(
      mockPalette.field.softPlaceholder,
    );
    focus(tree.root);
    expect(input(tree.root).placeholder).toBe('Search');
    mockPalette = theme.color;
  });

  test('onFocus and onBlur still reach the caller', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const tree = renderSearch(
      <SearchField
        onBlur={onBlur}
        onChangeText={() => {}}
        onFocus={onFocus}
        placeholder="Search"
        value=""
      />,
    );
    act(() => {
      input(tree.root).onFocus();
      input(tree.root).onBlur();
    });
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test('a ref reaches the input for programmatic focus', () => {
    const ref = { current: null as TextInput | null };
    const tree = renderSearch(
      <SearchField
        onChangeText={() => {}}
        placeholder="Search"
        ref={ref}
        value=""
      />,
    );
    expect(ref.current).toBe(tree.root.findByType(TextInput).instance);
    expect(typeof ref.current?.focus).toBe('function');
  });
});

describe('SearchField accessibility', () => {
  test('the accessible name falls back to the placeholder', () => {
    const fallback = renderSearch(
      <SearchField onChangeText={() => {}} placeholder="Search receipts" value="" />,
    );
    expect(input(fallback.root).accessibilityLabel).toBe('Search receipts');
    unmountTree(fallback);

    const named = renderSearch(
      <SearchField
        accessibilityLabel="Search your receipts"
        onChangeText={() => {}}
        placeholder="Search receipts"
        value=""
      />,
    );
    expect(input(named.root).accessibilityLabel).toBe('Search your receipts');
  });

  test('disabled is not editable and leaves the tab order', () => {
    const tree = renderSearch(
      <SearchField disabled onChangeText={() => {}} placeholder="Search" value="" />,
    );
    const props = input(tree.root);
    expect(props.disabled).toBe(true);
    expect(props.readOnly).toBe(true);
  });

  test('an enabled field is editable and stays in the tab order', () => {
    const tree = renderSearch(
      <SearchField onChangeText={() => {}} placeholder="Search" value="" />,
    );
    const props = input(tree.root);
    expect(props.disabled).toBe(false);
    expect(props.readOnly).toBe(false);
  });

  test('the field adds no second tab stop', () => {
    const tree = renderSearch(
      <SearchField onChangeText={() => {}} placeholder="Search" value="" />,
    );
    const focusable = tree.root.findAll(
      (node) =>
        typeof node.type !== 'string' &&
        (node.props.accessibilityRole === 'button' ||
          node.props.focusable === true),
    );
    expect(focusable).toHaveLength(0);
  });
});

describe('SearchField activation', () => {
  function spyOnFocus(tree: ReturnType<typeof renderSearch>) {
    const node = tree.root.findByType(TextInput);
    const focusSpy = jest.fn();
    (node.instance as unknown as { focus: () => void }).focus = focusSpy;
    return focusSpy;
  }

  test('pressing the pill hands focus to the input', () => {
    const tree = renderSearch(
      <SearchField onChangeText={() => {}} placeholder="Search" value="" />,
    );
    const focusSpy = spyOnFocus(tree);
    const node = pill(tree.root);
    expect(node.props.onStartShouldSetResponder()).toBe(true);
    act(() => {
      node.props.onResponderRelease();
    });
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  test('a disabled pill claims no press and focuses nothing', () => {
    const tree = renderSearch(
      <SearchField disabled onChangeText={() => {}} placeholder="Search" value="" />,
    );
    const focusSpy = spyOnFocus(tree);
    const node = pill(tree.root);
    expect(node.props.onStartShouldSetResponder()).toBe(false);
    act(() => {
      node.props.onResponderRelease();
    });
    expect(focusSpy).not.toHaveBeenCalled();
  });

  test('the search glyph lets presses through', () => {
    const tree = renderSearch(
      <SearchField onChangeText={() => {}} placeholder="Search" value="" />,
    );
    const box = tree.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        node.type.toLowerCase() === 'view' &&
        StyleSheet.flatten(node.props.style as ViewStyle).width ===
          searchFieldMetrics.searchIconSize,
    )[0];
    expect(StyleSheet.flatten(box.props.style as ViewStyle).pointerEvents).toBe(
      'none',
    );
  });
});

describe('SearchField trailing icon', () => {
  function actionNode(root: ReactTestInstance) {
    return root.find(
      (node) =>
        typeof node.type !== 'string' &&
        node.props.accessibilityRole === 'button' &&
        typeof node.props.onPress === 'function',
    );
  }

  test('no trailing icon by default', () => {
    const tree = renderSearch(
      <SearchField onChangeText={() => {}} placeholder="Search" value="" />,
    );
    expect(tree.root.findAllByType(Feather)).toHaveLength(1);
  });

  test('a decorative one renders but is not a control', () => {
    const tree = renderSearch(
      <SearchField
        onChangeText={() => {}}
        placeholder="Search"
        trailingIcon="sliders"
        value=""
      />,
    );
    expect(
      tree.root.findAllByType(Feather).map((node) => String(node.props.name)),
    ).toEqual(['search', 'sliders']);
    expect(
      tree.root.findAll(
        (node) =>
          typeof node.type !== 'string' &&
          node.props.accessibilityRole === 'button',
      ),
    ).toHaveLength(0);
  });

  test('an acting one is a named button that fires and keeps the query', () => {
    const onTrailingIconPress = jest.fn();
    const tree = renderSearch(
      <SearchField
        onChangeText={() => {}}
        onTrailingIconPress={onTrailingIconPress}
        placeholder="Search"
        trailingIcon="x"
        trailingIconAccessibilityLabel="Clear search"
        value="coffee"
      />,
    );
    const button = actionNode(tree.root);
    expect(button.props.accessibilityLabel).toBe('Clear search');
    act(() => {
      button.props.onPress();
    });
    expect(onTrailingIconPress).toHaveBeenCalledTimes(1);
    // Clearing is the caller's business; the component touches nothing.
    expect(input(tree.root).value).toBe('coffee');
  });

  test('its target fills the pill without covering the text', () => {
    const tree = renderSearch(
      <SearchField
        onChangeText={() => {}}
        onTrailingIconPress={() => {}}
        placeholder="Search"
        trailingIcon="x"
        trailingIconAccessibilityLabel="Clear search"
        value="coffee"
      />,
    );
    const style = StyleSheet.flatten(
      actionNode(tree.root).props.style as ViewStyle,
    );
    expect(style.height).toBe(searchFieldMetrics.height);
    expect(style.width).toBe(searchFieldMetrics.trailingIconSize);
    const slop = actionNode(tree.root).props.hitSlop;
    expect(slop).toEqual(searchFieldMetrics.trailingHitSlop);
    expect(Number(slop.right)).toBeLessThanOrEqual(
      searchFieldMetrics.paddingHorizontal,
    );
  });

  test('a disabled field disables its trailing action too', () => {
    const tree = renderSearch(
      <SearchField
        disabled
        onChangeText={() => {}}
        onTrailingIconPress={() => {}}
        placeholder="Search"
        trailingIcon="x"
        trailingIconAccessibilityLabel="Clear search"
        value="coffee"
      />,
    );
    const button = actionNode(tree.root);
    expect(button.props.disabled).toBe(true);
    expect(button.props.focusable).toBe(false);
  });

  test('both glyphs take the same colour, in every state and theme', () => {
    for (const [scheme, palette] of themes) {
      mockPalette = palette;
      for (const disabled of [false, true]) {
        const tree = renderSearch(
          <SearchField
            disabled={disabled}
            onChangeText={() => {}}
            placeholder="Search"
            trailingIcon="sliders"
            value=""
          />,
        );
        const expected = searchFieldSurface(palette, { disabled }).icon;
        for (const glyph of tree.root.findAllByType(Feather)) {
          expect({ scheme, disabled, color: glyph.props.color }).toEqual({
            scheme,
            disabled,
            color: expected,
          });
        }
        unmountTree(tree);
      }
    }
    mockPalette = theme.color;
  });
});

import Feather from '@expo/vector-icons/Feather';
import {
  type ComponentProps,
  forwardRef,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { type ColorShape, type Colors, theme } from '../../lib/theme';

// Fintrack DS · Search Field.
// Component: Figma "Components" page, set 597:5010.
// A borderless pill with a leading search glyph that is always there, an
// optional trailing icon, and nothing else: no floating label, no hint, no
// error, and no hover, pressed, error or read-only states - the contract has
// none of them.
//
// It shares no code with Input Field on purpose: the two look and behave
// differently enough that an abstraction would cost more than it saves.

export type SearchFieldIconName = ComponentProps<typeof Feather>['name'];

export type SearchFieldIconProps = {
  size: number;
  color: string;
  strokeWidth: number;
};

export type SearchFieldIcon =
  | SearchFieldIconName
  | ((props: SearchFieldIconProps) => ReactNode);

// The palette shape the component reads, so light, dark and a test palette
// built from distinct values all fit.
export type SearchFieldColors = ColorShape<Colors>;

// What the caller may hand straight to the underlying TextInput.
type PassthroughProps = Pick<
  TextInputProps,
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'autoFocus'
  | 'inputMode'
  | 'maxLength'
  | 'onSubmitEditing'
  | 'returnKeyType'
  | 'testID'
>;

// A trailing icon that acts is a control, and a control without a name is
// unusable with a screen reader, so the two travel together.
export type SearchFieldTrailingAction =
  | {
      onTrailingIconPress: () => void;
      trailingIconAccessibilityLabel: string;
    }
  | {
      onTrailingIconPress?: undefined;
      trailingIconAccessibilityLabel?: undefined;
    };

export type SearchFieldProps = PassthroughProps &
  SearchFieldTrailingAction & {
    value: string;
    onChangeText: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    /** Decorative unless onTrailingIconPress makes it a button. */
    trailingIcon?: SearchFieldIcon;
    onBlur?: () => void;
    onFocus?: () => void;
    accessibilityLabel?: string;
  };

export type SearchFieldSurface = {
  background: string;
  content: string;
  placeholder: string;
  icon: string;
};

// Geometry, in one place. The root is taller than the field so the focus
// ring has room to sit outside it without anything clipping.
export const searchFieldMetrics = {
  rootHeight: theme.scale.size.touchTarget,
  height: theme.scale.size.fieldHeight,
  radius: theme.scale.radius.pill,
  paddingHorizontal: theme.scale.space[4],
  gap: theme.scale.space[2],
  // Figma draws the search glyph at 18, which no size token names; the
  // trailing slot is the usual 20.
  searchIconSize: 18,
  trailingIconSize: theme.scale.size.iconMd,
  iconStrokeWidth: theme.scale.stroke.icon,
  focusRingWidth: theme.scale.stroke.focusRing,
  focusRingOffset: theme.scale.stroke.focusRing,
  trailingHitSlop: {
    bottom: theme.scale.space[1],
    left: theme.scale.space[2],
    right: theme.scale.space[2],
    top: theme.scale.space[1],
  },
} as const;

// Two states, and that is the whole contract: resting and disabled.
export function searchFieldSurface(
  colors: SearchFieldColors,
  state: { disabled?: boolean } = {},
): SearchFieldSurface {
  const { field, icon, text } = colors;

  if (state.disabled) {
    return {
      background: field.subtleDisabledFill,
      content: field.disabledContent,
      placeholder: field.disabledContent,
      // Both glyphs go quiet together, the acting one included.
      icon: icon.disabled,
    };
  }

  return {
    background: field.searchFill,
    content: text.primary,
    placeholder: field.softPlaceholder,
    icon: icon.secondary,
  };
}

export type SearchFieldFocusRing = {
  outlineColor: string;
  outlineOffset: number;
  outlineStyle: 'solid';
  outlineWidth: number;
};

// The browser's own outline draws the ring: it takes no part in layout, it
// follows the pill, and setting it replaces the user-agent ring instead of
// stacking a second one on top. Cleared, it suppresses that ring too.
export function searchFieldFocusRing(
  colors: SearchFieldColors,
  visible: boolean,
): SearchFieldFocusRing {
  if (!visible) {
    return {
      outlineColor: 'transparent',
      outlineOffset: 0,
      outlineStyle: 'solid',
      outlineWidth: 0,
    };
  }
  return {
    outlineColor: colors.field.softFocusBorder,
    outlineOffset: searchFieldMetrics.focusRingOffset,
    outlineStyle: 'solid',
    outlineWidth: searchFieldMetrics.focusRingWidth,
  };
}

export function renderSearchFieldIcon(
  icon: SearchFieldIcon | undefined,
  props: SearchFieldIconProps,
): ReactNode {
  if (icon === undefined) {
    return null;
  }
  if (typeof icon === 'function') {
    return icon(props);
  }
  // Feather ships as an icon font: its 2px stroke is baked into the glyph
  // and cannot be set per instance.
  return <Feather color={props.color} name={icon} size={props.size} />;
}

export const SearchField = forwardRef<TextInput, SearchFieldProps>(
  function SearchField(
    {
      accessibilityLabel,
      disabled = false,
      onBlur,
      onChangeText,
      onFocus,
      onTrailingIconPress,
      placeholder,
      trailingIcon,
      trailingIconAccessibilityLabel,
      value,
      ...passthrough
    },
    ref,
  ) {
    const colors = useColors();
    const [focused, setFocused] = useState(false);
    const styles = useMemo(() => makeStyles(), []);
    // The component needs the input to hand it focus when the pill is
    // tapped, and the caller still gets the ref it asked for.
    const inputRef = useRef<TextInput | null>(null);
    const attachInput = useCallback(
      (node: TextInput | null) => {
        inputRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    const surface = searchFieldSurface(colors, { disabled });
    const ring = searchFieldFocusRing(colors, focused && !disabled);
    const trailing = renderSearchFieldIcon(trailingIcon, {
      size: searchFieldMetrics.trailingIconSize,
      color: surface.icon,
      strokeWidth: searchFieldMetrics.iconStrokeWidth,
    });

    // react-native-web reads the aria-* props and never looks at
    // accessibilityState, so the web-only pair travels in its own bag.
    const webAria = {
      // The DOM disabled attribute: not editable and out of the tab order.
      disabled,
    } as Partial<TextInputProps>;

    // Anywhere on the pill that is not the input - the padding, either icon -
    // hands focus to the input. The responder is only claimed when no child
    // wants the gesture, so a press on the text keeps its own caret
    // placement, and the trailing button keeps its press.
    const claimsPress = () => !disabled;
    const focusInput = () => {
      if (!disabled) {
        inputRef.current?.focus();
      }
    };

    return (
      <View style={styles.root}>
        <View
          onResponderRelease={focusInput}
          onStartShouldSetResponder={claimsPress}
          style={[
            styles.field,
            { backgroundColor: surface.background },
            // Web only: on native the outline props would be a ring the
            // platform never asked for.
            Platform.OS === 'web' && ring,
          ]}
        >
          <View style={styles.searchIcon}>
            <Feather
              color={surface.icon}
              name="search"
              size={searchFieldMetrics.searchIconSize}
            />
          </View>

          <TextInput
            {...passthrough}
            {...webAria}
            accessibilityLabel={accessibilityLabel ?? placeholder}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            onChangeText={onChangeText}
            onFocus={() => {
              setFocused(true);
              onFocus?.();
            }}
            placeholder={placeholder}
            placeholderTextColor={surface.placeholder}
            // readOnly rather than editable: editable is deprecated on web
            // and readOnly keeps the text selectable and copyable.
            readOnly={disabled}
            ref={attachInput}
            style={[styles.input, { color: surface.content }]}
            value={value}
          />

          {trailing ? (
            onTrailingIconPress ? (
              <Pressable
                accessibilityLabel={trailingIconAccessibilityLabel}
                accessibilityRole="button"
                aria-disabled={disabled}
                disabled={disabled}
                focusable={!disabled}
                hitSlop={searchFieldMetrics.trailingHitSlop}
                onPress={onTrailingIconPress}
                style={styles.trailingAction}
              >
                {trailing}
              </Pressable>
            ) : (
              // Decorative: the screen reader skips it and presses fall
              // through to the field underneath.
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.trailingIcon}
              >
                {trailing}
              </View>
            )
          ) : null}
        </View>
      </View>
    );
  },
);

function makeStyles() {
  const m = searchFieldMetrics;

  return StyleSheet.create({
    field: {
      alignItems: 'center',
      borderRadius: m.radius,
      flexDirection: 'row',
      gap: m.gap,
      height: m.height,
      paddingHorizontal: m.paddingHorizontal,
    },
    input: {
      ...theme.type.bodyDefault,
      flex: 1,
      height: theme.type.bodyDefault.lineHeight,
      // The pill draws the focus ring; the input's own chrome is not wanted.
      ...Platform.select({
        web: { outlineStyle: 'solid' as const, outlineWidth: 0 },
        default: {},
      }),
      padding: 0,
    },
    root: {
      alignSelf: 'stretch',
      // Taller than the pill, so the ring has room and nothing clips it.
      height: m.rootHeight,
      justifyContent: 'center',
      width: '100%',
    },
    searchIcon: {
      height: m.searchIconSize,
      // Decorative: never swallows a press meant for the field.
      pointerEvents: 'none',
      width: m.searchIconSize,
    },
    trailingAction: {
      alignItems: 'center',
      // The glyph keeps its 20; the target fills the pill's height. The
      // width stays at the glyph so it cannot steal presses from the text,
      // and hitSlop adds the rest without taking part in layout.
      height: m.height,
      justifyContent: 'center',
      width: m.trailingIconSize,
    },
    trailingIcon: {
      height: m.trailingIconSize,
      pointerEvents: 'none',
      width: m.trailingIconSize,
    },
  });
}

import Feather from '@expo/vector-icons/Feather';
import {
  type ComponentProps,
  forwardRef,
  type ReactNode,
  useId,
  useMemo,
  useState,
} from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { useColors } from '../../contexts/ThemeContext';
import { type ColorShape, type Colors, theme } from '../../lib/theme';

// Fintrack DS · Input Field.
// Component: Figma "Components" page, set 596:1014 (24 variants).
// Appearances Soft Filled / Clean Outline across default, hover, focus,
// error, read-only and disabled, empty and filled, with a floating label,
// optional hint or error text and two independent icon slots.
//
// One real TextInput does the typing. It never remounts and never moves: the
// label is drawn over it and only changes position, so focus cannot shift the
// caret, drop a keystroke or resize the field.

export type InputFieldAppearance = 'softFilled' | 'cleanOutline';

// Same shape as the Button's icon slots: a Feather glyph name the component
// draws itself, or a render function handed the resolved props.
export type InputFieldIconName = ComponentProps<typeof Feather>['name'];

export type InputFieldIconProps = {
  size: number;
  color: string;
  strokeWidth: number;
};

export type InputFieldIcon =
  | InputFieldIconName
  | ((props: InputFieldIconProps) => ReactNode);

// The palette shape the component reads, so light, dark and a test palette
// built from distinct values all fit.
export type InputFieldColors = ColorShape<Colors>;

// What the caller may hand straight to the underlying TextInput. Everything
// that decides how the field looks is owned by the component instead.
type PassthroughProps = Pick<
  TextInputProps,
  | 'autoCapitalize'
  | 'autoComplete'
  | 'autoCorrect'
  | 'autoFocus'
  | 'inputMode'
  | 'keyboardType'
  | 'maxLength'
  | 'onSubmitEditing'
  | 'returnKeyType'
  | 'secureTextEntry'
  | 'selectTextOnFocus'
  | 'submitBehavior'
  | 'testID'
  | 'textContentType'
>;

export type InputFieldProps = PassthroughProps & {
  value: string;
  onChangeText: (value: string) => void;
  appearance?: InputFieldAppearance;
  /** Floats above the value once the field is focused or filled. */
  label?: string;
  /** Shown while the field is empty and focused, or whenever there is no label. */
  placeholder?: string;
  /** Supporting text under the field. Hidden while an error is shown. */
  hint?: string;
  /** Marks the field invalid. Red border, no message of its own. */
  error?: boolean;
  /** Marks the field invalid and says why. Replaces the hint. */
  errorText?: string;
  disabled?: boolean;
  /** Readable, selectable and focusable, but not editable. */
  readOnly?: boolean;
  leadingIcon?: InputFieldIcon;
  trailingIcon?: InputFieldIcon;
  /** Makes the trailing icon a button. Needs trailingIconAccessibilityLabel. */
  onTrailingIconPress?: () => void;
  trailingIconAccessibilityLabel?: string;
  onBlur?: () => void;
  onFocus?: () => void;
  /** Overrides the accessible name, which otherwise comes from the label. */
  accessibilityLabel?: string;
};

// The state the field is actually in, highest priority first. Only one of
// these decides the border, the fill and the content colours.
export type InputFieldState =
  | 'disabled'
  | 'readOnly'
  | 'error'
  | 'focus'
  | 'hover'
  | 'default';

export type InputFieldVisualState = {
  disabled?: boolean;
  readOnly?: boolean;
  error?: boolean;
  focused?: boolean;
  hovered?: boolean;
};

export type InputFieldSurface = {
  background: string;
  border: string;
  borderWidth: number;
  /** Painted over the fill, never instead of it. */
  overlay: string | null;
  label: string;
  content: string;
  placeholder: string;
  icon: string;
};

// Figma's State property is a single enum, so the order below is the contract
// the implementation adds on top of it: the most restrictive wins.
export function inputFieldState(
  state: InputFieldVisualState = {},
): InputFieldState {
  if (state.disabled) {
    return 'disabled';
  }
  if (state.readOnly) {
    return 'readOnly';
  }
  if (state.error) {
    return 'error';
  }
  if (state.focused) {
    return 'focus';
  }
  if (state.hovered) {
    return 'hover';
  }
  return 'default';
}

// Geometry, in one place. Everything here is independent of the state, which
// is what keeps the field from moving when it gains a border.
export const inputFieldMetrics = {
  height: theme.scale.size.controlLg,
  radius: theme.scale.radius.md,
  borderWidth: theme.scale.stroke.hairline,
  focusBorderWidth: theme.scale.stroke.focusRing,
  paddingLeft: theme.scale.space[4],
  paddingRight: theme.scale.space[3],
  paddingVertical: theme.scale.space[2],
  iconGap: theme.scale.space[3],
  iconSize: theme.scale.size.iconMd,
  iconStrokeWidth: theme.scale.stroke.icon,
  labelGap: theme.scale.space[1],
  floatingLabelHeight: theme.type.inputFloatingLabel.lineHeight,
  valueHeight: theme.type.bodyDefault.lineHeight,
  restingLabelHeight: theme.type.labelLarge.lineHeight,
  supportingHeight: theme.type.captionDefault.lineHeight,
  hintGap: theme.scale.space[2],
  errorGap: theme.scale.space[1],
} as const;

// 14 + 4 + 22 = 40, and 8 + 40 + 8 = 56 whatever the border does.
export const inputFieldContentHeight =
  inputFieldMetrics.floatingLabelHeight +
  inputFieldMetrics.labelGap +
  inputFieldMetrics.valueHeight;

// Resolves every colour of one appearance in one state. Hover tints through
// `overlay`; the fill underneath is the resting one.
export function inputFieldSurface(
  colors: InputFieldColors,
  appearance: InputFieldAppearance,
  state: InputFieldVisualState = {},
): InputFieldSurface {
  const { field, text } = colors;
  const resolved = inputFieldState(state);
  const soft = appearance === 'softFilled';
  const restingFill = soft ? field.softFill : field.outlineFill;
  const restingBorder = soft ? field.softBorder : field.outlineBorder;

  const base = {
    background: restingFill,
    border: restingBorder,
    borderWidth: inputFieldMetrics.borderWidth,
    overlay: null as string | null,
    label: text.secondary,
    content: text.primary,
    placeholder: field.softPlaceholder,
    // Icons keep the legacy placeholder token, not the new soft one.
    icon: field.placeholder,
  };

  switch (resolved) {
    case 'disabled':
      return {
        ...base,
        background: field.subtleDisabledFill,
        label: field.disabledContent,
        content: field.disabledContent,
        placeholder: field.disabledContent,
        icon: field.disabledContent,
      };
    case 'readOnly':
      return {
        ...base,
        background: field.subtleReadOnlyFill,
        content: field.readOnlyContent,
        placeholder: field.readOnlyContent,
      };
    case 'error':
      return {
        ...base,
        border: field.softErrorBorder,
        // An errored field that also has focus keeps the red, thickened.
        borderWidth: state.focused
          ? inputFieldMetrics.focusBorderWidth
          : inputFieldMetrics.borderWidth,
        overlay: state.hovered ? field.hoverOverlay : null,
      };
    case 'focus':
      return {
        ...base,
        border: field.softFocusBorder,
        borderWidth: inputFieldMetrics.focusBorderWidth,
      };
    case 'hover':
      return {
        ...base,
        border: soft ? field.softBorder : field.outlineBorderHover,
        overlay: field.hoverOverlay,
      };
    default:
      return base;
  }
}

// Whether the label has left the middle of the field. It floats on focus and
// stays floating while there is a value, so clearing a focused field does not
// drop it back down mid-edit.
export function inputFieldLabelFloats(state: {
  focused?: boolean;
  filled?: boolean;
}): boolean {
  return Boolean(state.focused) || Boolean(state.filled);
}

// With a label, the placeholder would collide with it: the label is the
// resting hint, so the placeholder waits for focus. Without a label there is
// nothing to collide with and it shows all the time.
export function inputFieldShowsPlaceholder(state: {
  hasLabel: boolean;
  focused?: boolean;
}): boolean {
  return !state.hasLabel || Boolean(state.focused);
}

export function renderInputFieldIcon(
  icon: InputFieldIcon | undefined,
  props: InputFieldIconProps,
): ReactNode {
  if (icon === undefined) {
    return null;
  }
  if (typeof icon === 'function') {
    return icon(props);
  }
  // Feather ships as an icon font: its 2px stroke is baked into the glyph and
  // cannot be set per instance.
  return <Feather color={props.color} name={icon} size={props.size} />;
}

export const InputField = forwardRef<TextInput, InputFieldProps>(
  function InputField(
    {
      accessibilityLabel,
      appearance = 'softFilled',
      disabled = false,
      error = false,
      errorText,
      hint,
      label,
      leadingIcon,
      onBlur,
      onChangeText,
      onFocus,
      onTrailingIconPress,
      placeholder,
      readOnly = false,
      trailingIcon,
      trailingIconAccessibilityLabel,
      value,
      ...passthrough
    },
    ref,
  ) {
    const colors = useColors();
    const [focused, setFocused] = useState(false);
    const [hovered, setHovered] = useState(false);
    const styles = useMemo(() => makeStyles(), []);
    const supportingId = useId();

    const invalid = error || (errorText ?? '') !== '';
    const interactive = !disabled && !readOnly;
    const surface = inputFieldSurface(colors, appearance, {
      disabled,
      error: invalid,
      focused,
      hovered: hovered && interactive,
      readOnly,
    });
    const floats = inputFieldLabelFloats({ filled: value !== '', focused });
    const showsPlaceholder = inputFieldShowsPlaceholder({
      focused,
      hasLabel: label !== undefined,
    });
    const supportingText = errorText ?? hint;
    const supportingIsError = (errorText ?? '') !== '';

    const iconProps: InputFieldIconProps = {
      size: inputFieldMetrics.iconSize,
      color: surface.icon,
      strokeWidth: inputFieldMetrics.iconStrokeWidth,
    };
    const leading = renderInputFieldIcon(leadingIcon, iconProps);
    const trailing = renderInputFieldIcon(trailingIcon, iconProps);

    // react-native-web reads the aria-* props and never looks at
    // accessibilityState, and React Native does not declare aria-invalid or
    // aria-describedby at all, so the web-only pair travels in its own bag.
    const webAria = {
      'aria-describedby': supportingText === undefined ? undefined : supportingId,
      'aria-invalid': invalid,
      // The DOM disabled attribute: not editable and out of the tab order.
      disabled,
    } as Partial<TextInputProps>;

    return (
      <View style={styles.root}>
        <View
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          style={[
            styles.field,
            {
              backgroundColor: surface.background,
              borderColor: surface.border,
              borderWidth: surface.borderWidth,
              // The border eats into the box, so the padding gives back
              // exactly what it took and the content never shifts.
              paddingLeft: inputFieldMetrics.paddingLeft - surface.borderWidth,
              paddingRight: inputFieldMetrics.paddingRight - surface.borderWidth,
              paddingVertical:
                inputFieldMetrics.paddingVertical - surface.borderWidth,
            },
          ]}
        >
          {surface.overlay ? (
            <View
              style={[
                styles.overlay,
                { backgroundColor: surface.overlay, borderRadius: inputFieldMetrics.radius },
              ]}
            />
          ) : null}

          {leading ? <View style={styles.leadingIcon}>{leading}</View> : null}

          <View style={styles.column}>
            {label === undefined ? null : (
              <Text
                numberOfLines={1}
                // Absolute, so moving it can never push the input around.
                style={[
                  styles.label,
                  floats ? styles.labelFloating : styles.labelResting,
                  floats ? theme.type.inputFloatingLabel : theme.type.labelLarge,
                  { color: surface.label },
                ]}
              >
                {label}
              </Text>
            )}
            <TextInput
              {...passthrough}
              {...webAria}
              accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
              onBlur={() => {
                setFocused(false);
                onBlur?.();
              }}
              onChangeText={onChangeText}
              onFocus={() => {
                setFocused(true);
                onFocus?.();
              }}
              placeholder={showsPlaceholder ? placeholder : undefined}
              placeholderTextColor={surface.placeholder}
              // readOnly rather than editable: editable is deprecated on web
              // and readOnly keeps the text selectable and copyable.
              readOnly={readOnly || disabled}
              ref={ref}
              style={[
                styles.input,
                label === undefined ? styles.inputCentred : styles.inputAnchored,
                { color: surface.content },
              ]}
              value={value}
            />
          </View>

          {trailing ? (
            onTrailingIconPress ? (
              <Pressable
                accessibilityLabel={trailingIconAccessibilityLabel}
                accessibilityRole="button"
                aria-disabled={disabled}
                disabled={disabled}
                focusable={!disabled}
                onPress={onTrailingIconPress}
                style={styles.trailingAction}
              >
                {trailing}
              </Pressable>
            ) : (
              // Decorative: the screen reader skips it and taps fall through
              // to the field underneath.
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

        {supportingText === undefined ? null : (
          <Text
            nativeID={supportingId}
            style={[
              styles.supporting,
              supportingIsError ? styles.supportingError : styles.supportingHint,
              {
                color: supportingIsError
                  ? colors.field.supportingError
                  : colors.text.tertiary,
              },
            ]}
          >
            {supportingText}
          </Text>
        )}
      </View>
    );
  },
);

function makeStyles() {
  const m = inputFieldMetrics;
  // The input sits on the value line and stays there; the label moves over it.
  const anchorTop = m.floatingLabelHeight + m.labelGap;

  return StyleSheet.create({
    column: {
      flex: 1,
      height: inputFieldContentHeight,
      justifyContent: 'center',
    },
    field: {
      alignItems: 'center',
      borderRadius: m.radius,
      flexDirection: 'row',
      gap: m.iconGap,
      height: m.height,
    },
    input: {
      ...theme.type.bodyDefault,
      height: m.valueHeight,
      // Web renders a text input with its own chrome; none of it is wanted.
      ...Platform.select({
        web: { outlineStyle: 'solid' as const, outlineWidth: 0 },
        default: {},
      }),
      padding: 0,
    },
    inputAnchored: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: anchorTop,
    },
    inputCentred: {
      width: '100%',
    },
    label: {
      position: 'absolute',
      left: 0,
      right: 0,
    },
    labelFloating: {
      top: 0,
    },
    labelResting: {
      top: (inputFieldContentHeight - m.restingLabelHeight) / 2,
    },
    leadingIcon: {
      height: m.iconSize,
      width: m.iconSize,
    },
    overlay: {
      bottom: 0,
      left: 0,
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
      top: 0,
    },
    root: {
      alignSelf: 'stretch',
      width: '100%',
    },
    supporting: {
      ...theme.type.captionDefault,
    },
    supportingError: {
      paddingTop: m.errorGap,
    },
    supportingHint: {
      paddingTop: m.hintGap,
    },
    trailingAction: {
      alignItems: 'center',
      height: m.iconSize,
      justifyContent: 'center',
      width: m.iconSize,
    },
    trailingIcon: {
      height: m.iconSize,
      width: m.iconSize,
    },
  });
}

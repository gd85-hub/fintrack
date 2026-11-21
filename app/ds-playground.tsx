import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  type ButtonIcon,
  type ButtonSize,
  type ButtonVariant,
} from '../components/ds/Button';
import {
  InputField,
  type InputFieldAppearance,
} from '../components/ds/InputField';
import {
  IconButton,
  type IconButtonIconName,
  type IconButtonSize,
  type IconButtonVariant,
} from '../components/ds/IconButton';
import { SearchField } from '../components/ds/SearchField';
import { useLanguage } from '../contexts/LanguageContext';
import { ThemeOverride, useColors } from '../contexts/ThemeContext';
import { isPlaygroundEnabled } from '../lib/devRoutes';
import { theme, type ColorScheme, type Colors } from '../lib/theme';

// Design-system playground. Development builds only: it renders the real
// components from components/ds/ with no account, no Supabase data and no app
// navigation around them, so a component can be checked on Web and Android
// without signing in.
//
// Adding the next component means adding one gallery function plus the
// <Section> that calls it - nothing else on this page needs to change. Only
// components that exist get a section.

const VARIANTS: ButtonVariant[] = [
  'primary',
  'neutral',
  'surface',
  'outline',
  'ghost',
  'danger',
];

const SIZES: ButtonSize[] = ['medium', 'large'];

const ICON_BUTTON_VARIANTS: IconButtonVariant[] = [
  'primary',
  'neutral',
  'outline',
  'surface',
  'ghost',
  'danger',
  'onMedia',
];

const ICON_BUTTON_SIZES: IconButtonSize[] = ['small', 'medium', 'large'];

const APPEARANCES: InputFieldAppearance[] = ['softFilled', 'cleanOutline'];

// Hover and focus come from real interaction, so the gallery only pins the
// states a caller can ask for; hover and focus are there to be tried.
const INPUT_STATES: {
  name: string;
  props: { disabled?: boolean; error?: boolean; readOnly?: boolean };
}[] = [
  { name: 'default', props: {} },
  { name: 'error', props: { error: true } },
  { name: 'read-only', props: { readOnly: true } },
  { name: 'disabled', props: { disabled: true } },
];

// Variant, size and state names are the component's API, not product copy, so
// they stay in English next to the code that uses them.
const ICON_SLOTS: { name: string; leading?: ButtonIcon; trailing?: ButtonIcon }[] =
  [
    { name: 'no icons' },
    { name: 'leading', leading: 'arrow-left' },
    { name: 'trailing', trailing: 'arrow-right' },
    { name: 'both', leading: 'arrow-left', trailing: 'arrow-right' },
  ];

export default function DsPlaygroundScreen() {
  const [scheme, setScheme] = useState<ColorScheme>('light');

  if (!isPlaygroundEnabled()) {
    return <PlaygroundUnavailable />;
  }

  return (
    <ThemeOverride scheme={scheme}>
      <Playground onSchemeChange={setScheme} scheme={scheme} />
    </ThemeOverride>
  );
}

// What a production build answers if someone types the URL. No component
// gallery, no links onward.
function PlaygroundUnavailable() {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  return (
    <View style={[styles.screen, styles.centered]}>
      <Text style={styles.title}>{t('dsPlayground.unavailable.title')}</Text>
      <Text style={styles.subtitle}>{t('dsPlayground.unavailable.body')}</Text>
    </View>
  );
}

function Playground({
  onSchemeChange,
  scheme,
}: {
  onSchemeChange: (scheme: ColorScheme) => void;
  scheme: ColorScheme;
}) {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const [lastPress, setLastPress] = useState<string | null>(null);
  const [pressCount, setPressCount] = useState(0);

  function recordPress(label: string) {
    setLastPress(label);
    setPressCount((count) => count + 1);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.screen}
      testID="ds-playground"
    >
      <Text style={styles.title}>{t('dsPlayground.title')}</Text>
      <Text style={styles.subtitle}>{t('dsPlayground.subtitle')}</Text>

      <View style={styles.toolbar}>
        <Text style={styles.toolbarLabel}>{t('dsPlayground.theme.label')}</Text>
        <View style={styles.row}>
          <Button
            label={t('dsPlayground.theme.light')}
            onPress={() => onSchemeChange('light')}
            variant={scheme === 'light' ? 'primary' : 'outline'}
          />
          <Button
            label={t('dsPlayground.theme.dark')}
            onPress={() => onSchemeChange('dark')}
            variant={scheme === 'dark' ? 'primary' : 'outline'}
          />
        </View>
      </View>

      <View style={styles.readout}>
        <Text style={styles.readoutText}>
          {lastPress === null
            ? t('dsPlayground.press.idle')
            : t('dsPlayground.press.last', {
                count: pressCount,
                label: lastPress,
              })}
        </Text>
        <Button
          label={t('dsPlayground.press.reset')}
          onPress={() => {
            setLastPress(null);
            setPressCount(0);
          }}
          variant="ghost"
        />
      </View>

      <ButtonGallery onPress={recordPress} />
      <IconButtonGallery onPress={recordPress} />
      <InputFieldGallery />
      <SearchFieldGallery />
    </ScrollView>
  );
}

function IconButtonGallery({ onPress }: { onPress: (label: string) => void }) {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  const title = t('dsPlayground.iconButton.title');
  const glyphs: Record<IconButtonVariant, IconButtonIconName> = {
    primary: 'plus',
    neutral: 'edit-2',
    outline: 'filter',
    surface: 'more-horizontal',
    ghost: 'x',
    danger: 'trash-2',
    onMedia: 'camera',
  };
  const labels: Record<IconButtonVariant, string> = {
    primary: t('dsPlayground.iconButton.label.add'),
    neutral: t('dsPlayground.iconButton.label.edit'),
    outline: t('dsPlayground.iconButton.label.more'),
    surface: t('dsPlayground.iconButton.label.more'),
    ghost: t('dsPlayground.iconButton.label.close'),
    danger: t('dsPlayground.iconButton.label.remove'),
    onMedia: t('dsPlayground.iconButton.label.close'),
  };

  return (
    <>
      <Section title={`${title} · ${t('dsPlayground.iconButton.section.types')}`}>
        {ICON_BUTTON_SIZES.map((size) => (
          <Group key={size} name={size}>
            {ICON_BUTTON_VARIANTS.filter((variant) => variant !== 'onMedia').map(
              (variant) => (
                <IconButton
                  accessibilityLabel={labels[variant]}
                  icon={glyphs[variant]}
                  key={variant}
                  onPress={() => onPress(`${variant} / ${size}`)}
                  size={size}
                  variant={variant}
                />
              ),
            )}
          </Group>
        ))}
      </Section>

      <Section title={`${title} · ${t('dsPlayground.iconButton.section.states')}`}>
        {ICON_BUTTON_SIZES.map((size) => (
          <View key={size}>
            <Group name={`${size} · disabled`}>
              {ICON_BUTTON_VARIANTS.filter((v) => v !== 'onMedia').map(
                (variant) => (
                  <IconButton
                    accessibilityLabel={labels[variant]}
                    disabled
                    icon={glyphs[variant]}
                    key={variant}
                    onPress={() => onPress(`disabled ${variant}`)}
                    size={size}
                    variant={variant}
                  />
                ),
              )}
            </Group>
            <Group name={`${size} · loading`}>
              {ICON_BUTTON_VARIANTS.filter((v) => v !== 'onMedia').map(
                (variant) => (
                  <IconButton
                    accessibilityLabel={labels[variant]}
                    icon={glyphs[variant]}
                    key={variant}
                    loading
                    onPress={() => onPress(`loading ${variant}`)}
                    size={size}
                    variant={variant}
                  />
                ),
              )}
            </Group>
          </View>
        ))}
      </Section>

      {/* On media only reads on something to sit on: a photo-dark panel. */}
      <Section title={`${title} · ${t('dsPlayground.iconButton.section.onMedia')}`}>
        <Group name="default, disabled, loading">
          <View style={styles.media}>
            {ICON_BUTTON_SIZES.map((size) => (
              <IconButton
                accessibilityLabel={labels.onMedia}
                icon={glyphs.onMedia}
                key={size}
                onPress={() => onPress(`onMedia / ${size}`)}
                size={size}
                variant="onMedia"
              />
            ))}
            <IconButton
              accessibilityLabel={labels.onMedia}
              disabled
              icon={glyphs.onMedia}
              onPress={() => onPress('onMedia disabled')}
              variant="onMedia"
            />
            <IconButton
              accessibilityLabel={labels.onMedia}
              icon={glyphs.onMedia}
              loading
              onPress={() => onPress('onMedia loading')}
              variant="onMedia"
            />
          </View>
        </Group>
      </Section>

      <Section
        title={`${title} · ${t('dsPlayground.iconButton.section.interaction')}`}
      >
        <Text style={styles.hint}>{t('dsPlayground.iconButton.hint')}</Text>
        <Group name="press me, then try the loading one next to me">
          {ICON_BUTTON_VARIANTS.filter((v) => v !== 'onMedia').map((variant) => (
            <IconButton
              accessibilityLabel={labels[variant]}
              icon={glyphs[variant]}
              key={variant}
              onPress={() => onPress(`tap ${variant}`)}
              size="large"
              variant={variant}
            />
          ))}
          <IconButton
            accessibilityLabel={labels.primary}
            icon={glyphs.primary}
            loading
            onPress={() => onPress('blocked while loading')}
            size="large"
          />
        </Group>
      </Section>
    </>
  );
}

function SearchFieldGallery() {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const [empty, setEmpty] = useState('');
  const [filled, setFilled] = useState('Maxi Zemun');
  const [withTrailing, setWithTrailing] = useState('');
  const [clearable, setClearable] = useState('кофе');
  const [live, setLive] = useState('');
  const [submitted, setSubmitted] = useState('');

  const title = t('dsPlayground.searchField.title');
  const placeholder = t('dsPlayground.searchField.placeholder');

  return (
    <>
      <Section title={`${title} · ${t('dsPlayground.searchField.section.states')}`}>
        <Group column name="empty">
          <SearchField
            onChangeText={setEmpty}
            placeholder={placeholder}
            value={empty}
          />
        </Group>
        <Group column name="filled">
          <SearchField
            onChangeText={setFilled}
            placeholder={placeholder}
            value={filled}
          />
        </Group>
        <Group column name="disabled">
          <SearchField
            disabled
            onChangeText={() => {}}
            placeholder={placeholder}
            value=""
          />
        </Group>
        <Group column name="disabled, filled">
          <SearchField
            disabled
            onChangeText={() => {}}
            placeholder={placeholder}
            value="Maxi Zemun"
          />
        </Group>
      </Section>

      <Section title={`${title} · ${t('dsPlayground.searchField.section.trailing')}`}>
        <Group column name="decorative">
          <SearchField
            onChangeText={setWithTrailing}
            placeholder={placeholder}
            trailingIcon="sliders"
            value={withTrailing}
          />
        </Group>
        <Group column name="clears the query">
          <SearchField
            onChangeText={setClearable}
            onTrailingIconPress={() => setClearable('')}
            placeholder={placeholder}
            trailingIcon="x"
            trailingIconAccessibilityLabel={t('dsPlayground.searchField.clear')}
            value={clearable}
          />
        </Group>
        <Group column name="disabled with an action">
          <SearchField
            disabled
            onChangeText={() => {}}
            onTrailingIconPress={() => {}}
            placeholder={placeholder}
            trailingIcon="x"
            trailingIconAccessibilityLabel={t('dsPlayground.searchField.clear')}
            value="Maxi"
          />
        </Group>
      </Section>

      <Section
        title={`${title} · ${t('dsPlayground.searchField.section.interactive')}`}
      >
        <View style={styles.column}>
          {/* The clear action appears with the query. The two props travel
              together by type, so this is two elements rather than one with
              conditional props. */}
          {live === '' ? (
            <SearchField
              onChangeText={setLive}
              onSubmitEditing={() => setSubmitted(live)}
              placeholder={placeholder}
              value={live}
            />
          ) : (
            <SearchField
              onChangeText={setLive}
              onSubmitEditing={() => setSubmitted(live)}
              onTrailingIconPress={() => setLive('')}
              placeholder={placeholder}
              trailingIcon="x"
              trailingIconAccessibilityLabel={t('dsPlayground.searchField.clear')}
              value={live}
            />
          )}
          <Text style={styles.hint}>
            {live === ''
              ? t('dsPlayground.searchField.empty')
              : t('dsPlayground.searchField.results', { query: live })}
          </Text>
          {submitted === '' ? null : (
            <Text style={styles.hint}>{`Enter: ${submitted}`}</Text>
          )}
        </View>
      </Section>
    </>
  );
}

function InputFieldGallery() {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const [empty, setEmpty] = useState('');
  const [filled, setFilled] = useState('Maxi Zemun');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [noLabel, setNoLabel] = useState('');

  // Every field below is a live instance; these keep the uncontrolled-looking
  // demos typable without giving each one its own state hook.
  const [states, setStates] = useState<Record<string, string>>({});
  const stateValue = (key: string, initial = '') => states[key] ?? initial;
  const setStateValue = (key: string) => (next: string) =>
    setStates((current) => ({ ...current, [key]: next }));

  return (
    <>
      <Section title={`${t('dsPlayground.inputField.title')} · ${t('dsPlayground.inputField.section.appearances')}`}>
        {APPEARANCES.map((appearance) => (
          <View key={appearance}>
            {INPUT_STATES.map((state) => (
              <Group column key={`${appearance}-${state.name}`} name={`${appearance} · ${state.name}`}>
                <InputField
                  appearance={appearance}
                  label={t('dsPlayground.inputField.sample.merchant')}
                  onChangeText={setStateValue(`${appearance}-${state.name}-empty`)}
                  placeholder="Maxi"
                  value={stateValue(`${appearance}-${state.name}-empty`)}
                  {...state.props}
                />
                <InputField
                  appearance={appearance}
                  label={t('dsPlayground.inputField.sample.merchant')}
                  onChangeText={setStateValue(`${appearance}-${state.name}-filled`)}
                  placeholder="Maxi"
                  value={stateValue(`${appearance}-${state.name}-filled`, 'Maxi Zemun')}
                  {...state.props}
                />
              </Group>
            ))}
          </View>
        ))}
      </Section>

      <Section title={`${t('dsPlayground.inputField.title')} · ${t('dsPlayground.inputField.section.icons')}`}>
        <Group column name="no icons">
          <InputField
            label={t('dsPlayground.inputField.sample.merchant')}
            onChangeText={setEmpty}
            value={empty}
          />
        </Group>
        <Group column name="leading">
          <InputField
            label={t('dsPlayground.inputField.sample.merchant')}
            leadingIcon="map-pin"
            onChangeText={setFilled}
            value={filled}
          />
        </Group>
        <Group column name="trailing">
          <InputField
            label={t('dsPlayground.inputField.sample.merchant')}
            onChangeText={setStateValue('icon-trailing')}
            trailingIcon="chevron-down"
            value={stateValue('icon-trailing')}
          />
        </Group>
        <Group column name="both, trailing is a button">
          <InputField
            label={t('dsPlayground.inputField.sample.merchant')}
            leadingIcon="map-pin"
            onChangeText={setStateValue('icon-both')}
            onTrailingIconPress={() => setStateValue('icon-both')('')}
            trailingIcon="x"
            trailingIconAccessibilityLabel="Clear"
            value={stateValue('icon-both', 'Maxi Zemun')}
          />
        </Group>
      </Section>

      <Section title={`${t('dsPlayground.inputField.title')} · ${t('dsPlayground.inputField.section.supporting')}`}>
        <Group column name="hint">
          <InputField
            hint={t('dsPlayground.inputField.sample.emailHint')}
            label={t('dsPlayground.inputField.sample.email')}
            onChangeText={setStateValue('supporting-hint')}
            value={stateValue('supporting-hint')}
          />
        </Group>
        <Group column name="error text">
          <InputField
            errorText={t('dsPlayground.inputField.sample.emailError')}
            label={t('dsPlayground.inputField.sample.email')}
            onChangeText={setStateValue('supporting-error')}
            value={stateValue('supporting-error', 'not-an-email')}
          />
        </Group>
        <Group column name="error without text, height stays 56">
          <InputField
            error
            label={t('dsPlayground.inputField.sample.email')}
            onChangeText={setStateValue('supporting-bare')}
            value={stateValue('supporting-bare')}
          />
        </Group>
        <Group column name="error wins over hint">
          <InputField
            errorText={t('dsPlayground.inputField.sample.emailError')}
            hint={t('dsPlayground.inputField.sample.emailHint')}
            label={t('dsPlayground.inputField.sample.email')}
            onChangeText={setStateValue('supporting-both')}
            value={stateValue('supporting-both')}
          />
        </Group>
      </Section>

      <Section title={`${t('dsPlayground.inputField.title')} · ${t('dsPlayground.inputField.section.noLabel')}`}>
        <Group column name="placeholder shows with no label, focused or not">
          <InputField
            onChangeText={setNoLabel}
            placeholder={t('dsPlayground.inputField.sample.merchant')}
            value={noLabel}
          />
          <InputField
            appearance="cleanOutline"
            leadingIcon="search"
            onChangeText={setStateValue('nolabel-outline')}
            placeholder={t('dsPlayground.inputField.sample.merchant')}
            value={stateValue('nolabel-outline')}
          />
        </Group>
      </Section>

      <Section title={`${t('dsPlayground.inputField.title')} · ${t('dsPlayground.inputField.section.practical')}`}>
        <View style={styles.column}>
          <InputField
            autoCapitalize="none"
            autoComplete="email"
            hint={t('dsPlayground.inputField.sample.emailHint')}
            inputMode="email"
            label={t('dsPlayground.inputField.sample.email')}
            leadingIcon="mail"
            onChangeText={setEmail}
            placeholder="name@example.com"
            value={email}
          />
          <InputField
            autoCapitalize="none"
            autoComplete="password"
            label={t('dsPlayground.inputField.sample.password')}
            leadingIcon="lock"
            onChangeText={setPassword}
            onTrailingIconPress={() => setPasswordVisible((shown) => !shown)}
            secureTextEntry={!passwordVisible}
            trailingIcon={passwordVisible ? 'eye-off' : 'eye'}
            trailingIconAccessibilityLabel={
              passwordVisible
                ? t('dsPlayground.inputField.sample.passwordHide')
                : t('dsPlayground.inputField.sample.passwordShow')
            }
            value={password}
          />
          <InputField
            label={t('dsPlayground.inputField.sample.merchant')}
            leadingIcon="map-pin"
            onChangeText={setMerchant}
            placeholder="Maxi"
            value={merchant}
          />
          <InputField
            appearance="cleanOutline"
            hint={t('dsPlayground.inputField.sample.amountHint')}
            inputMode="decimal"
            label={t('dsPlayground.inputField.sample.amount')}
            onChangeText={setAmount}
            placeholder="0,00"
            trailingIcon="dollar-sign"
            value={amount}
          />
        </View>
      </Section>
    </>
  );
}

function ButtonGallery({ onPress }: { onPress: (label: string) => void }) {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  return (
    <>
      <Section title={t('dsPlayground.section.types')}>
        {SIZES.map((size) => (
          <Group key={size} name={size}>
            {VARIANTS.map((variant) => (
              <Button
                key={variant}
                label={variant}
                onPress={() => onPress(`${variant} / ${size}`)}
                size={size}
                variant={variant}
              />
            ))}
          </Group>
        ))}
      </Section>

      <Section title={t('dsPlayground.section.states')}>
        {SIZES.map((size) => (
          <View key={size}>
            <Group name={`${size} · default`}>
              {VARIANTS.map((variant) => (
                <Button
                  key={variant}
                  label={variant}
                  onPress={() => onPress(`${variant} / ${size}`)}
                  size={size}
                  variant={variant}
                />
              ))}
            </Group>
            <Group name={`${size} · disabled`}>
              {VARIANTS.map((variant) => (
                <Button
                  disabled
                  key={variant}
                  label={variant}
                  onPress={() => onPress(`disabled ${variant}`)}
                  size={size}
                  variant={variant}
                />
              ))}
            </Group>
            <Group name={`${size} · loading`}>
              {VARIANTS.map((variant) => (
                <Button
                  key={variant}
                  label={variant}
                  loading
                  onPress={() => onPress(`loading ${variant}`)}
                  size={size}
                  variant={variant}
                />
              ))}
            </Group>
          </View>
        ))}
      </Section>

      <Section title={t('dsPlayground.section.icons')}>
        {SIZES.map((size) => (
          <Group key={size} name={size}>
            {ICON_SLOTS.map((slot) => (
              <Button
                key={slot.name}
                label={slot.name}
                leadingIcon={slot.leading}
                onPress={() => onPress(`${slot.name} / ${size}`)}
                size={size}
                trailingIcon={slot.trailing}
              />
            ))}
          </Group>
        ))}
        <Group name="loading keeps its width">
          {ICON_SLOTS.map((slot) => (
            <Button
              key={slot.name}
              label={slot.name}
              leadingIcon={slot.leading}
              loading
              onPress={() => onPress(`loading ${slot.name}`)}
              trailingIcon={slot.trailing}
            />
          ))}
        </Group>
      </Section>

      {/* Both directions, because the parent's flexDirection decides what a
          cross-axis stretch means and fullWidth has to survive either. */}
      <Section title={t('dsPlayground.section.width')}>
        <Group column name={`${t('dsPlayground.width.hug')} · column`}>
          <Button
            label="hug column"
            onPress={() => onPress('hug column')}
            trailingIcon="arrow-right"
          />
        </Group>
        <Group column name={`${t('dsPlayground.width.fullWidth')} · column`}>
          <Button
            fullWidth
            label="full width column"
            onPress={() => onPress('full width column')}
            trailingIcon="arrow-right"
          />
        </Group>
        <Group name={`${t('dsPlayground.width.hug')} · row`}>
          <Button
            label="hug row"
            onPress={() => onPress('hug row')}
            trailingIcon="arrow-right"
          />
        </Group>
        <Group name={`${t('dsPlayground.width.fullWidth')} · row`}>
          <Button
            fullWidth
            label="full width row"
            onPress={() => onPress('full width row')}
            trailingIcon="arrow-right"
          />
        </Group>
        <Group name={`${t('dsPlayground.width.fullWidth')} · row, loading`}>
          <Button
            fullWidth
            label="full width row"
            loading
            onPress={() => onPress('full width row loading')}
            trailingIcon="arrow-right"
          />
        </Group>
      </Section>

      <Section title={t('dsPlayground.section.interaction')}>
        <Text style={styles.hint}>{t('dsPlayground.interaction.hint')}</Text>
        <Group name={t('dsPlayground.interaction.focusTarget')}>
          {VARIANTS.map((variant) => (
            <Button
              key={variant}
              label={variant}
              leadingIcon="check"
              onPress={() => onPress(`focus ${variant}`)}
              size="large"
              variant={variant}
            />
          ))}
        </Group>
      </Section>
    </>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Group({
  children,
  column = false,
  name,
}: {
  children: React.ReactNode;
  column?: boolean;
  name: string;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  return (
    <View style={styles.group}>
      <Text style={styles.groupName}>{name}</Text>
      <View style={column ? styles.column : styles.row}>{children}</View>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.scale.space[6],
    },
    column: {
      flexDirection: 'column',
      gap: theme.scale.space[3],
    },
    content: {
      gap: theme.scale.space[4],
      maxWidth: theme.sizes.maxContentWidth,
      padding: theme.scale.space[5],
      paddingBottom: theme.scale.space[8],
      width: '100%',
    },
    group: {
      gap: theme.scale.space[2],
      paddingTop: theme.scale.space[3],
    },
    groupName: {
      ...theme.type.microLabel,
      color: colors.text.tertiary,
      textTransform: 'uppercase',
    },
    media: {
      alignItems: 'center',
      backgroundColor: colors.bg.sunken,
      borderRadius: theme.scale.radius.lg,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.scale.space[3],
      padding: theme.scale.space[4],
    },
    hint: {
      ...theme.type.captionDefault,
      color: colors.text.secondary,
      paddingTop: theme.scale.space[2],
    },
    readout: {
      alignItems: 'center',
      backgroundColor: colors.surface.muted,
      borderRadius: theme.scale.radius.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.scale.space[3],
      justifyContent: 'space-between',
      padding: theme.scale.space[4],
    },
    readoutText: {
      ...theme.type.bodyDefault,
      color: colors.text.primary,
      flexShrink: 1,
    },
    row: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.scale.space[3],
    },
    screen: {
      backgroundColor: colors.bg.base,
      flex: 1,
    },
    section: {
      backgroundColor: colors.surface.default,
      borderColor: colors.border.subtle,
      borderRadius: theme.scale.radius.lg,
      borderWidth: theme.scale.stroke.hairline,
      gap: theme.scale.space[1],
      padding: theme.scale.space[4],
    },
    sectionTitle: {
      ...theme.type.titleSection,
      color: colors.text.primary,
    },
    subtitle: {
      ...theme.type.bodyDefault,
      color: colors.text.secondary,
    },
    title: {
      ...theme.type.titleScreen,
      color: colors.text.primary,
    },
    toolbar: {
      gap: theme.scale.space[2],
    },
    toolbarLabel: {
      ...theme.type.microLabel,
      color: colors.text.tertiary,
      textTransform: 'uppercase',
    },
  });
}

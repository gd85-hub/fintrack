import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  type ButtonIcon,
  type ButtonSize,
  type ButtonVariant,
} from '../components/ds/Button';
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
    </ScrollView>
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

import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  CurrencyPickerModal,
  type CurrencyPickerOption,
} from '../../components/CurrencyPickerModal';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useHomeCurrency } from '../../contexts/HomeCurrencyContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSecondaryCurrency } from '../../contexts/SecondaryCurrencyContext';
import { useColors } from '../../contexts/ThemeContext';
import { SUPPORTED_HOME_CURRENCIES } from '../../lib/homeCurrency';
import { theme, type Colors } from '../../lib/theme';

type PickerKind = 'primary' | 'secondary' | null;

type CurrencyRowProps = {
  expanded: boolean;
  label: string;
  onPress: () => void;
  value: string;
};

function CurrencyRow({
  expanded,
  label,
  onPress,
  value,
}: CurrencyRowProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.rowValue}>
        {value}
      </Text>
      <Feather
        color={colors.icon.secondary}
        name="chevron-right"
        size={theme.spacing.lg}
      />
    </Pressable>
  );
}

export default function ManageCurrencyScreen() {
  const router = useRouter();
  const { homeCurrency, setHomeCurrency } = useHomeCurrency();
  const { secondaryCurrency, setSecondaryCurrency } =
    useSecondaryCurrency();
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const [pickerKind, setPickerKind] = useState<PickerKind>(null);
  const currencyOptions = useMemo<readonly CurrencyPickerOption[]>(
    () =>
      SUPPORTED_HOME_CURRENCIES.map((currency) => ({
        label: currency,
        value: currency,
      })),
    [],
  );
  const secondaryOptions = useMemo<readonly CurrencyPickerOption[]>(
    () => [
      { label: t('manageCurrency.off'), value: null },
      ...currencyOptions,
    ],
    [currencyOptions, t],
  );
  const primaryPickerVisible = pickerKind === 'primary';
  const secondaryPickerVisible = pickerKind === 'secondary';

  return (
    <View style={styles.screen}>
      <ScreenHeader
        backAccessibilityLabel={t('common.back')}
        onBack={() => router.replace('/(app)/settings')}
        title={t('settings.manageCurrencies')}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.list}>
          <CurrencyRow
            expanded={primaryPickerVisible}
            label={t('manageCurrency.primary.row')}
            onPress={() => setPickerKind('primary')}
            value={homeCurrency}
          />
          <View style={styles.separator} />
          <View>
            <CurrencyRow
              expanded={secondaryPickerVisible}
              label={t('manageCurrency.secondary.row')}
              onPress={() => setPickerKind('secondary')}
              value={secondaryCurrency ?? t('manageCurrency.off')}
            />
            <Text style={styles.hint}>
              {t('manageCurrency.secondary.hint')}
            </Text>
          </View>
        </View>
      </ScrollView>

      <CurrencyPickerModal
        onClose={() => setPickerKind(null)}
        onSelect={(value) => {
          if (value !== null) {
            setHomeCurrency(value);
          }
        }}
        options={currencyOptions}
        title={t('manageCurrency.primary.title')}
        value={homeCurrency}
        visible={primaryPickerVisible}
      />
      <CurrencyPickerModal
        onClose={() => setPickerKind(null)}
        onSelect={setSecondaryCurrency}
        options={secondaryOptions}
        title={t('manageCurrency.secondary.title')}
        value={secondaryCurrency}
        visible={secondaryPickerVisible}
      />
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    content: {
      alignSelf: 'center',
      maxWidth: theme.sizes.maxContentWidth,
      padding: theme.spacing.lg,
      width: '100%',
    },
    hint: {
      color: c.text.secondary,
      fontSize: theme.fontSizes.caption,
      paddingBottom: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    list: {
      backgroundColor: c.surface.default,
      borderColor: c.border.default,
      borderRadius: theme.radii.card,
      borderWidth: theme.sizes.border,
      overflow: 'hidden',
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: theme.sizes.floatingButton,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    rowLabel: {
      color: c.text.primary,
      flex: 1,
      fontSize: theme.fontSizes.body,
      fontWeight: '600',
    },
    rowPressed: {
      backgroundColor: c.state.pressed,
    },
    rowValue: {
      color: c.text.secondary,
      flexShrink: 1,
      fontSize: theme.fontSizes.caption,
      textAlign: 'right',
    },
    screen: {
      backgroundColor: c.bg.base,
      flex: 1,
    },
    separator: {
      backgroundColor: c.separatorInset,
      height: theme.sizes.border,
      marginLeft: theme.spacing.md,
    },
  });

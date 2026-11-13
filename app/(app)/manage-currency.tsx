import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  fetchLatestAnchorRates,
  type LatestAnchorRate,
} from '../../lib/anchorRates';
import { formatDayMonth, todayLocalISO } from '../../lib/dates';
import { SUPPORTED_HOME_CURRENCIES } from '../../lib/homeCurrency';
import { formatRate } from '../../lib/money';
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
  const { locale, t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const [pickerKind, setPickerKind] = useState<PickerKind>(null);
  const [rates, setRates] = useState<Map<string, LatestAnchorRate>>(
    () => new Map(),
  );
  const [ratesLoading, setRatesLoading] = useState(true);
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
  const latestDate = useMemo(
    () =>
      [...rates.values()].reduce<string | null>(
        (latest, rate) =>
          latest === null || rate.date > latest ? rate.date : latest,
        null,
      ),
    [rates],
  );

  useEffect(() => {
    let active = true;
    setRatesLoading(true);

    void fetchLatestAnchorRates(
      SUPPORTED_HOME_CURRENCIES,
      todayLocalISO(),
    )
      .then((latestRates) => {
        if (active) {
          setRates(latestRates);
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to load latest FX rates:', error);
        if (active) {
          setRates(new Map());
        }
      })
      .finally(() => {
        if (active) {
          setRatesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [homeCurrency]);

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

        <View style={styles.ratesSection}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {t('manageCurrency.rates.title')}
          </Text>
          {ratesLoading ? (
            <ActivityIndicator color={colors.action.primary.fill} />
          ) : (
            <>
              <View style={styles.ratesList}>
                {SUPPORTED_HOME_CURRENCIES.filter(
                  (currency) => currency !== homeCurrency,
                ).map((currency, index, visibleCurrencies) => {
                  const primaryRate =
                    homeCurrency === 'EUR'
                      ? 1
                      : rates.get(homeCurrency)?.ratePerEur;
                  const quoteRate =
                    currency === 'EUR'
                      ? 1
                      : rates.get(currency)?.ratePerEur;
                  const crossRate =
                    primaryRate !== undefined &&
                    primaryRate > 0 &&
                    quoteRate !== undefined &&
                    quoteRate > 0
                      ? primaryRate / quoteRate
                      : null;

                  return (
                    <View key={currency}>
                      <View style={styles.rateRow}>
                        <Text style={styles.rateText}>
                          1 {currency} ={' '}
                          {crossRate === null
                            ? '—'
                            : formatRate(crossRate)}{' '}
                          {homeCurrency}
                        </Text>
                      </View>
                      {index < visibleCurrencies.length - 1 ? (
                        <View style={styles.separator} />
                      ) : null}
                    </View>
                  );
                })}
              </View>
              <Text style={styles.sourceText}>
                {t('manageCurrency.rates.source')} ·{' '}
                {latestDate
                  ? t('manageCurrency.rates.updated', {
                      date: formatDayMonth(latestDate, locale),
                    })
                  : t('manageCurrency.rates.unavailable')}
              </Text>
            </>
          )}
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
      gap: theme.spacing.lg,
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
    rateRow: {
      justifyContent: 'center',
      minHeight: theme.sizes.floatingButton,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    ratesList: {
      backgroundColor: c.surface.default,
      borderColor: c.border.default,
      borderRadius: theme.radii.card,
      borderWidth: theme.sizes.border,
      overflow: 'hidden',
    },
    ratesSection: {
      gap: theme.spacing.xs,
    },
    rateText: {
      color: c.text.primary,
      fontSize: theme.fontSizes.body,
      fontVariant: ['tabular-nums'],
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
    sectionTitle: {
      color: c.text.tertiary,
      fontSize: theme.fontSizes.caption,
      fontWeight: '600',
      paddingHorizontal: theme.spacing.xs,
      textTransform: 'uppercase',
    },
    sourceText: {
      color: c.text.secondary,
      fontSize: theme.fontSizes.caption,
      paddingHorizontal: theme.spacing.xs,
    },
  });

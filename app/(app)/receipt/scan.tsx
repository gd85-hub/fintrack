import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import { ReceiptCamera } from '../../../components/ReceiptCamera';
import { ReceiptImageInput } from '../../../components/ReceiptImageInput';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useReceiptDraft } from '../../../contexts/ReceiptDraftContext';
import { useColors } from '../../../contexts/ThemeContext';
import { listCategories, listMerchantTypes } from '../../../lib/db';
import {
  analyzeReceiptImages,
  compressReceiptImages,
  receiptFromImageAnalysis,
  receiptImageErrorMessage,
  type ReceiptImageSource,
} from '../../../lib/receiptImage';
import {
  fetchAndParseReceipt,
  isSupportedReceiptUrl,
  receiptParseErrorMessage,
} from '../../../lib/receipts';
import { theme, type Colors } from '../../../lib/theme';

function useScanTheme() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  return { colors, styles };
}

export default function ScanReceiptScreen() {
  if (Platform.OS === 'web') {
    return <WebImageReceiptScreen />;
  }

  return <NativeScanReceiptScreen />;
}

function WebImageReceiptScreen() {
  const { t } = useLanguage();
  const { styles } = useScanTheme();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>{t('scan.photoTitle')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>{t('scan.photoIntro')}</Text>
        <ImageReceiptFlow />
      </ScrollView>
    </View>
  );
}

function ImageReceiptFlow() {
  const { t } = useLanguage();
  const { setDraft } = useReceiptDraft();
  const { colors, styles } = useScanTheme();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImages = async (sources: ReceiptImageSource[]) => {
    setError(null);
    setProcessing(true);
    try {
      const [categories, merchantTypes, images] = await Promise.all([
        listCategories(),
        listMerchantTypes(),
        compressReceiptImages(sources),
      ]);
      const analysis = await analyzeReceiptImages(
        images,
        categories,
        merchantTypes,
      );
      if (!analysis.ok) {
        setError(receiptImageErrorMessage(analysis.error, t));
        return;
      }
      const receipt = receiptFromImageAnalysis(analysis);
      if (!receipt) {
        setError(t('scan.photoFailDateCurrency'));
        return;
      }
      setDraft(receipt);
      router.replace('/(app)/receipt/review');
    } catch (caught: unknown) {
      setError(
        caught instanceof Error && caught.message === 'bad_input'
          ? receiptImageErrorMessage('bad_input', t)
          : t('scan.photoFailPrepare'),
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.imageFlow}>
      <ReceiptImageInput
        disabled={processing}
        onError={setError}
        onSelect={handleImages}
      />
      {processing ? (
        <View style={styles.processingCard}>
          <ActivityIndicator color={colors.action.primary.fill} />
          <Text style={styles.processingText}>{t('scan.recognizing')}</Text>
        </View>
      ) : null}
      {error ? (
        <View accessibilityRole="alert" style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retryText}>{t('scan.pickAgain')}</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={processing}
        onPress={() => router.push('/(app)/expense/new')}
        style={({ pressed }) => [
          styles.linkButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.linkText}>{t('add.manual')}</Text>
      </Pressable>
    </View>
  );
}

function NativeScanReceiptScreen() {
  const { mode } = useLocalSearchParams<{
    mode?: string | string[];
  }>();
  const initialImageMode =
    (Array.isArray(mode) ? mode[0] : mode) === 'image';
  const { t } = useLanguage();
  const { setDraft } = useReceiptDraft();
  const { colors, styles } = useScanTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [imageMode, setImageMode] = useState(initialImageMode);
  const [manualUrl, setManualUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanArmed, setScanArmed] = useState(true);
  const [cameraFocusKey, setCameraFocusKey] = useState(0);
  const scanClaimed = useRef(false);

  useFocusEffect(
    useCallback(() => {
      scanClaimed.current = false;
      setScanArmed(true);
      setIsFocused(true);
      setCameraFocusKey((key) => key + 1);

      return () => {
        scanClaimed.current = true;
        setScanArmed(false);
        setIsFocused(false);
      };
    }, []),
  );

  const handleReceiptUrl = useCallback(
    async (value: string) => {
      if (processing || !scanArmed || scanClaimed.current) {
        return;
      }
      scanClaimed.current = true;
      setScanArmed(false);
      setError(null);

      if (!isSupportedReceiptUrl(value)) {
        setError(t('scan.notSufLink'));
        return;
      }

      setProcessing(true);
      const result = await fetchAndParseReceipt(value);
      setProcessing(false);
      if (!result.ok) {
        setError(receiptParseErrorMessage(result.error));
        return;
      }

      setDraft(result);
      router.replace('/(app)/receipt/review');
    },
    [processing, scanArmed, setDraft],
  );

  const resetScan = () => {
    scanClaimed.current = false;
    setScanArmed(true);
    setError(null);
  };

  const showManual = () => {
    resetScan();
    setManualMode(true);
  };

  const showCamera = () => {
    resetScan();
    setManualMode(false);
    setImageMode(false);
  };

  const showImages = () => {
    scanClaimed.current = true;
    setScanArmed(false);
    setError(null);
    setManualMode(false);
    setImageMode(true);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>{t('add.scan')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {imageMode ? (
          <>
            <Text style={styles.help}>{t('scan.cameraIntro')}</Text>
            <ImageReceiptFlow />
            <Pressable
              accessibilityRole="button"
              onPress={showCamera}
              style={({ pressed }) => [
                styles.linkButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.linkText}>{t('scan.backToQr')}</Text>
            </Pressable>
          </>
        ) : manualMode ? (
          <View style={styles.manualCard}>
            <Text style={styles.label}>{t('scan.qrLinkLabel')}</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!processing}
              keyboardType="url"
              onChangeText={(value) => {
                setManualUrl(value);
                if (error) {
                  resetScan();
                }
              }}
              onSubmitEditing={() => void handleReceiptUrl(manualUrl)}
              placeholder="https://suf.purs.gov.rs/v/?vl=…"
              placeholderTextColor={colors.field.placeholder}
              returnKeyType="go"
              style={styles.input}
              value={manualUrl}
            />
            <Pressable
              accessibilityRole="button"
              disabled={processing || !manualUrl.trim()}
              onPress={() => void handleReceiptUrl(manualUrl)}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || processing || !manualUrl.trim()) &&
                  styles.disabled,
              ]}
            >
              {processing ? (
                <Text style={styles.primaryButtonText}>
                  {t('scan.loading')}
                </Text>
              ) : (
                <Text style={styles.primaryButtonText}>
                  {t('scan.loadReceipt')}
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={showCamera}
              style={({ pressed }) => [
                styles.linkButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.linkText}>{t('scan.backToCamera')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.help}>{t('scan.pointAtQr')}</Text>
            {isFocused ? (
              <ReceiptCamera
                active={isFocused && scanArmed && !processing}
                key={cameraFocusKey}
                onScan={(value) => void handleReceiptUrl(value)}
                onUseManual={showManual}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={showManual}
              style={({ pressed }) => [
                styles.linkButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.linkText}>
                {t('scan.enterLinkManually')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={showImages}
              style={({ pressed }) => [
                styles.linkButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.linkText}>{t('scan.fromPhoto')}</Text>
            </Pressable>
          </>
        )}

        {error ? (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={resetScan}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.retryText}>
                {manualMode ? t('scan.tryAgain') : t('scan.scanAgain')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {processing && !manualMode ? (
          <View style={styles.processingCard}>
            <ActivityIndicator color={colors.action.primary.fill} />
            <Text style={styles.processingText}>{t('scan.loading')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  backButton: {
    alignItems: 'center',
    height: theme.sizes.iconButton,
    justifyContent: 'center',
    width: theme.sizes.iconButton,
  },
  backText: {
    color: c.text.primary,
    fontSize: theme.fontSizes.title,
  },
  content: {
    alignSelf: 'center',
    gap: theme.spacing.lg,
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
    width: '100%',
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  errorCard: {
    backgroundColor: c.status.error.container,
    borderRadius: theme.radii.card,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  errorText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.body,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: c.border.default,
    borderBottomWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  help: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.body,
    textAlign: 'center',
  },
  imageFlow: {
    gap: theme.spacing.md,
  },
  input: {
    borderColor: c.field.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: c.text.primary,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  label: {
    color: c.text.primary,
    fontSize: theme.fontSizes.label,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  linkText: {
    color: c.action.link.rest,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  manualCard: {
    gap: theme.spacing.md,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: c.action.primary.fill,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  primaryButtonText: {
    color: c.action.primary.content,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  processingCard: {
    alignItems: 'center',
    backgroundColor: c.surface.default,
    borderRadius: theme.radii.card,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  processingText: {
    color: c.text.secondary,
    fontSize: theme.fontSizes.body,
  },
  retryButton: {
    alignSelf: 'flex-start',
    minHeight: theme.sizes.iconButton,
    justifyContent: 'center',
  },
  retryText: {
    color: c.status.error.content,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  screen: {
    backgroundColor: c.bg.base,
    flex: 1,
  },
  title: {
    color: c.text.primary,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
});

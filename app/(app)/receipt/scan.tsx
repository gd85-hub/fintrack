import { useCallback, useRef, useState } from 'react';
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
import { router } from 'expo-router';

import { ReceiptCamera } from '../../../components/ReceiptCamera';
import { useReceiptDraft } from '../../../contexts/ReceiptDraftContext';
import {
  fetchAndParseReceipt,
  isSupportedReceiptUrl,
  receiptParseErrorMessage,
} from '../../../lib/receipts';
import { theme } from '../../../lib/theme';

export default function ScanReceiptScreen() {
  if (Platform.OS === 'web') {
    return <WebScanUnavailable />;
  }

  return <NativeScanReceiptScreen />;
}

function WebScanUnavailable() {
  return (
    <View style={styles.screen}>
      <View style={styles.webFallbackContent}>
        <Text style={styles.webFallbackTitle}>
          Сканирование доступно в приложении
        </Text>
        <Text style={styles.webFallbackBody}>
          Сканирование чеков работает в мобильном приложении на телефоне.
          Откройте Fintrack на Android, чтобы отсканировать QR-код чека.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(app)')}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Вернуться</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NativeScanReceiptScreen() {
  const { setDraft } = useReceiptDraft();
  const [manualMode, setManualMode] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanArmed = useRef(true);

  const handleReceiptUrl = useCallback(
    async (value: string) => {
      if (processing || !scanArmed.current) {
        return;
      }
      scanArmed.current = false;
      setError(null);

      if (!isSupportedReceiptUrl(value)) {
        setError('Это не ссылка на фискальный чек SUF.');
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
    [processing, setDraft],
  );

  const resetScan = () => {
    scanArmed.current = true;
    setError(null);
  };

  const showManual = () => {
    resetScan();
    setManualMode(true);
  };

  const showCamera = () => {
    resetScan();
    setManualMode(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Назад"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Сканировать чек</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {manualMode ? (
          <View style={styles.manualCard}>
            <Text style={styles.label}>Ссылка из QR-кода</Text>
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
              placeholderTextColor={theme.colors.textMuted}
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
                <Text style={styles.primaryButtonText}>Читаем чек…</Text>
              ) : (
                <Text style={styles.primaryButtonText}>Загрузить чек</Text>
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
              <Text style={styles.linkText}>Вернуться к камере</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.help}>
              Наведите камеру на QR-код фискального чека
            </Text>
            <ReceiptCamera
              active={scanArmed.current && !processing}
              onScan={(value) => void handleReceiptUrl(value)}
              onUseManual={showManual}
            />
            <Pressable
              accessibilityRole="button"
              onPress={showManual}
              style={({ pressed }) => [
                styles.linkButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.linkText}>Ввести ссылку вручную</Text>
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
                {manualMode ? 'Попробовать снова' : 'Сканировать ещё раз'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {processing && !manualMode ? (
          <View style={styles.processingCard}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.processingText}>Читаем чек…</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    height: theme.sizes.iconButton,
    justifyContent: 'center',
    width: theme.sizes.iconButton,
  },
  backText: {
    color: theme.colors.text,
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
    backgroundColor: theme.colors.dangerMuted,
    borderRadius: theme.radii.card,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.body,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: theme.colors.border,
    borderBottomWidth: theme.sizes.border,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  help: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.body,
    textAlign: 'center',
  },
  input: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  label: {
    color: theme.colors.text,
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
    color: theme.colors.accent,
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
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  processingCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  processingText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.body,
  },
  retryButton: {
    alignSelf: 'flex-start',
    minHeight: theme.sizes.iconButton,
    justifyContent: 'center',
  },
  retryText: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.button,
    fontWeight: '700',
  },
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  title: {
    color: theme.colors.text,
    flex: 1,
    fontSize: theme.fontSizes.body,
    fontWeight: '700',
  },
  webFallbackBody: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.body,
    textAlign: 'center',
  },
  webFallbackContent: {
    alignSelf: 'center',
    flex: 1,
    gap: theme.spacing.lg,
    justifyContent: 'center',
    maxWidth: theme.sizes.maxContentWidth,
    padding: theme.spacing.lg,
    width: '100%',
  },
  webFallbackTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.title,
    fontWeight: '700',
    textAlign: 'center',
  },
});

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColors } from '../../contexts/ThemeContext';
import { submitFeedback } from '../../lib/db/feedback';
import { theme, type Colors } from '../../lib/theme';

export default function FeedbackScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const submitDisabled = !message.trim() || submitting;

  async function handleSubmit() {
    if (submitDisabled) {
      return;
    }

    setSubmitting(true);
    setHasError(false);

    const { error } = await submitFeedback(message);
    if (error) {
      setHasError(true);
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        backAccessibilityLabel={t('common.back')}
        onBack={() => router.back()}
        title={t('settings.feedback.title')}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {submitted ? (
          <View style={styles.successState}>
            <Text style={styles.successTitle}>
              {t('settings.feedback.successTitle')}
            </Text>
            <Text style={styles.bodyText}>
              {t('settings.feedback.successBody')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {t('settings.feedback.done')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.bodyText}>
              {t('settings.feedback.intro')}
            </Text>
            <TextInput
              accessibilityLabel={t('settings.feedback.placeholder')}
              maxLength={4000}
              multiline={true}
              onChangeText={setMessage}
              placeholder={t('settings.feedback.placeholder')}
              placeholderTextColor={colors.field.placeholder}
              style={styles.messageInput}
              textAlignVertical="top"
              value={message}
            />

            {hasError ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {t('settings.feedback.error')}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: submitDisabled }}
              disabled={submitDisabled}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
                submitDisabled && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {submitting
                  ? t('settings.feedback.submitting')
                  : t('settings.feedback.submit')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    bodyText: {
      color: c.text.secondary,
      fontSize: theme.fontSizes.body,
    },
    buttonDisabled: {
      opacity: theme.opacity.disabled,
    },
    buttonPressed: {
      opacity: theme.opacity.pressed,
    },
    content: {
      alignSelf: 'center',
      maxWidth: theme.sizes.maxContentWidth,
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
      width: '100%',
    },
    errorText: {
      color: c.status.error.content,
      fontSize: theme.fontSizes.caption,
    },
    form: {
      gap: theme.spacing.md,
    },
    messageInput: {
      backgroundColor: c.field.fill,
      borderColor: c.field.border,
      borderRadius: theme.radii.input,
      borderWidth: theme.sizes.border,
      color: c.text.primary,
      fontSize: theme.fontSizes.body,
      minHeight: theme.sizes.multilineInputHeight,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
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
      fontWeight: '600',
    },
    screen: {
      backgroundColor: c.bg.base,
      flex: 1,
    },
    successState: {
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    successTitle: {
      color: c.text.primary,
      fontSize: theme.fontSizes.title,
      fontWeight: '700',
      textAlign: 'center',
    },
  });

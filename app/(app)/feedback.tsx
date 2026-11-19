import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/ds/Button';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColors } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { submitFeedback } from '../../lib/db/feedback';
import { theme, type Colors } from '../../lib/theme';

export default function FeedbackScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submitDisabled = !message.trim() || submitting;

  async function handleSubmit() {
    if (submitDisabled) {
      return;
    }

    setSubmitting(true);

    const { error } = await submitFeedback(message);
    if (error) {
      toast.error(t('settings.feedback.error'));
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
            {/* The button hugs its label and keeps its place in the middle
                of the card. Button sets alignSelf itself, which would beat
                the card's alignItems, so the row centres it instead. */}
            <View style={styles.doneRow}>
              <Button
                label={t('settings.feedback.done')}
                onPress={() => router.back()}
                size="medium"
                variant="primary"
              />
            </View>
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

            {/* Nothing to send is Disabled; sending is Loading. They are
                different states, so the button shows them differently - the
                submitDisabled guard in handleSubmit still covers both. */}
            <Button
              accessibilityLabel={
                submitting
                  ? t('settings.feedback.submitting')
                  : t('settings.feedback.submit')
              }
              disabled={!message.trim()}
              fullWidth
              label={t('settings.feedback.submit')}
              loading={submitting}
              onPress={() => void handleSubmit()}
              size="medium"
              variant="primary"
            />
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
    content: {
      alignSelf: 'center',
      maxWidth: theme.sizes.maxContentWidth,
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
      width: '100%',
    },
    // A row, so justifyContent centres the button horizontally: in a column
    // the button's own alignSelf would decide instead.
    doneRow: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      justifyContent: 'center',
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

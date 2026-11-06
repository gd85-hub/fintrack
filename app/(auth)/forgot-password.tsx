import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useColors } from '../../contexts/ThemeContext';
import { theme, type Colors } from '../../lib/theme';

export default function ForgotPasswordScreen() {
  const { sendPasswordReset } = useAuth();
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setErrorMessage('');
    setSubmitting(true);

    const { error } = await sendPasswordReset(email.trim());

    if (
      error &&
      isAuthRetryableFetchError(error) &&
      error.status === 0
    ) {
      setErrorMessage(t('auth.err.resetNetworkFailed'));
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.infoCard}>
          <Text style={styles.title}>{t('auth.checkEmailTitle')}</Text>
          <Text style={styles.infoText}>{t('auth.resetEmailSent')}</Text>
          <Link href="/(auth)/sign-in" style={styles.link}>
            {t('auth.goToSignIn')}
          </Link>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>{t('auth.forgotPasswordTitle')}</Text>

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
          onChangeText={setEmail}
          placeholder={t('auth.email')}
          placeholderTextColor={colors.field.placeholder}
          style={styles.input}
          value={email}
        />

        {errorMessage ? (
          <Text style={styles.error}>{errorMessage}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={() => void handleSubmit()}
          style={({ pressed }) => [
            styles.button,
            (pressed || submitting) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>
            {submitting
              ? t('auth.sendingResetLink')
              : t('auth.sendResetLink')}
          </Text>
        </Pressable>

        <Link href="/(auth)/sign-in" style={styles.link}>
          {t('auth.goToSignIn')}
        </Link>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    button: {
      alignItems: 'center',
      backgroundColor: c.action.primary.fill,
      borderRadius: theme.radii.button,
      justifyContent: 'center',
      minHeight: theme.sizes.buttonHeight,
      paddingHorizontal: theme.spacing.md,
    },
    buttonPressed: {
      opacity: theme.opacity.pressed,
    },
    buttonText: {
      color: c.action.primary.content,
      fontSize: theme.fontSizes.button,
      fontWeight: '600',
    },
    container: {
      alignItems: 'center',
      backgroundColor: c.bg.base,
      flex: 1,
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    error: {
      color: c.status.error.content,
      fontSize: theme.fontSizes.label,
    },
    form: {
      gap: theme.spacing.md,
      maxWidth: theme.sizes.maxContentWidth,
      width: '100%',
    },
    infoCard: {
      alignItems: 'center',
      gap: theme.spacing.md,
      maxWidth: theme.sizes.maxContentWidth,
      width: '100%',
    },
    infoText: {
      color: c.text.primary,
      fontSize: theme.fontSizes.body,
      textAlign: 'center',
    },
    input: {
      borderColor: c.field.border,
      borderRadius: theme.radii.input,
      borderWidth: theme.sizes.border,
      color: c.text.primary,
      fontSize: theme.fontSizes.body,
      minHeight: theme.sizes.buttonHeight,
      paddingHorizontal: theme.spacing.sm,
    },
    link: {
      color: c.action.link.rest,
      fontSize: theme.fontSizes.label,
      textAlign: 'center',
    },
    title: {
      color: c.text.primary,
      fontSize: theme.fontSizes.title,
      fontWeight: '700',
      marginBottom: theme.spacing.xs,
      textAlign: 'center',
    },
  });

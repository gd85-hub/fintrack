import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { LoadingScreen } from '../components/LoadingScreen';
import { useLanguage } from '../contexts/LanguageContext';
import { useColors } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { theme, type Colors } from '../lib/theme';

type ResetStatus = 'checking' | 'ready' | 'invalid' | 'success';

export default function ResetPasswordScreen() {
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const [status, setStatus] = useState<ResetStatus>('checking');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [updateFailed, setUpdateFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    const type = hash.get('type');

    if (type !== 'recovery' || !accessToken || !refreshToken) {
      setStatus('invalid');
      return;
    }

    let active = true;

    void supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      .then(({ error }) => {
        if (active) {
          setStatus(error ? 'invalid' : 'ready');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleUpdatePassword() {
    setErrorMessage('');
    setUpdateFailed(false);

    if (password.length < 6) {
      setErrorMessage(t('auth.err.passwordTooShort'));
      return;
    }

    if (password !== passwordConfirmation) {
      setErrorMessage(t('auth.err.passwordsDoNotMatch'));
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage(t('auth.err.resetFailed'));
      setUpdateFailed(true);
      setSubmitting(false);
      return;
    }

    if (typeof window !== 'undefined') {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`,
      );
    }

    await supabase.auth.signOut({ scope: 'local' });
    setStatus('success');
    setSubmitting(false);
  }

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.infoCard}>
          <Text style={styles.title}>{t('auth.resetPasswordTitle')}</Text>
          <Text style={styles.infoText}>{t('auth.resetOnWebNote')}</Text>
          <Link href="/(auth)/forgot-password" style={styles.link}>
            {t('auth.requestNewResetLink')}
          </Link>
        </View>
      </View>
    );
  }

  if (status === 'checking') {
    return <LoadingScreen />;
  }

  if (status === 'invalid') {
    return (
      <View style={styles.container}>
        <View style={styles.infoCard}>
          <Text style={styles.title}>{t('auth.resetLinkInvalidTitle')}</Text>
          <Text style={styles.error}>{t('auth.resetLinkInvalid')}</Text>
          <Link href="/(auth)/forgot-password" style={styles.link}>
            {t('auth.requestNewResetLink')}
          </Link>
        </View>
      </View>
    );
  }

  if (status === 'success') {
    return (
      <View style={styles.container}>
        <View style={styles.infoCard}>
          <Text style={styles.title}>{t('auth.resetSuccessTitle')}</Text>
          <Text style={styles.infoText}>{t('auth.resetSuccess')}</Text>
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
        <Text style={styles.title}>{t('auth.resetPasswordTitle')}</Text>

        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          onChangeText={setPassword}
          placeholder={t('auth.newPassword')}
          placeholderTextColor={colors.field.placeholder}
          secureTextEntry
          style={styles.input}
          value={password}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          onChangeText={setPasswordConfirmation}
          placeholder={t('auth.confirmPassword')}
          placeholderTextColor={colors.field.placeholder}
          secureTextEntry
          style={styles.input}
          value={passwordConfirmation}
        />

        {errorMessage ? (
          <Text style={styles.error}>{errorMessage}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={() => void handleUpdatePassword()}
          style={({ pressed }) => [
            styles.button,
            (pressed || submitting) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>
            {submitting
              ? t('auth.updatingPassword')
              : t('auth.updatePassword')}
          </Text>
        </Pressable>

        {updateFailed ? (
          <Link href="/(auth)/forgot-password" style={styles.link}>
            {t('auth.requestNewResetLink')}
          </Link>
        ) : null}
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
      textAlign: 'center',
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

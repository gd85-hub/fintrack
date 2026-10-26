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
import { localizedAuthError } from '../../lib/authErrors';
import { theme, type Colors } from '../../lib/theme';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const { t } = useLanguage();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors as Colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSignUp() {
    const normalizedEmail = email.trim();
    setErrorMessage('');
    setSubmitting(true);

    const { error, user, session } = await signUp(
      normalizedEmail,
      password,
    );

    if (error) {
      setErrorMessage(localizedAuthError(error.message, 'sign-up', t));
    } else if (user && !session) {
      setConfirmationEmail(normalizedEmail);
    }

    setSubmitting(false);
  }

  if (confirmationEmail) {
    return (
      <View style={styles.container}>
        <View style={styles.infoCard}>
          <Text style={styles.title}>{t('auth.checkEmailTitle')}</Text>
          <Text style={styles.infoText}>
            {t('auth.confirmSent', { email: confirmationEmail })}
          </Text>
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
        <Text style={styles.title}>{t('auth.signUpTitle')}</Text>

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.field.placeholder}
          style={styles.input}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="new-password"
          onChangeText={setPassword}
          placeholder={t('auth.password')}
          placeholderTextColor={colors.field.placeholder}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        {errorMessage ? (
          <Text style={styles.error}>{errorMessage}</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={() => void handleSignUp()}
          style={({ pressed }) => [
            styles.button,
            (pressed || submitting) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>
            {submitting ? t('auth.signingUp') : t('auth.signUpButton')}
          </Text>
        </Pressable>

        <Link href="/(auth)/sign-in" style={styles.link}>
          {t('auth.haveAccount')}
        </Link>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
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

import { Link } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../../contexts/AuthContext';
import { authErrorInRussian } from '../../lib/authErrors';
import { theme } from '../../lib/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    setErrorMessage('');
    setSubmitting(true);

    const { error } = await signIn(email.trim(), password);

    if (error) {
      setErrorMessage(authErrorInRussian(error.message, 'sign-in'));
    }

    setSubmitting(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>Вход</Text>

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="password"
          onChangeText={setPassword}
          placeholder="Пароль"
          placeholderTextColor={theme.colors.textMuted}
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
          onPress={() => void handleSignIn()}
          style={({ pressed }) => [
            styles.button,
            (pressed || submitting) && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>
            {submitting ? 'Вход…' : 'Войти'}
          </Text>
        </Pressable>

        <Link href="/(auth)/sign-up" style={styles.link}>
          Нет аккаунта? Зарегистрируйтесь
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.button,
    justifyContent: 'center',
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.md,
  },
  buttonPressed: {
    opacity: theme.opacity.pressed,
  },
  buttonText: {
    color: theme.colors.white,
    fontSize: theme.fontSizes.button,
    fontWeight: '600',
  },
  container: {
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.fontSizes.label,
  },
  form: {
    gap: theme.spacing.md,
    maxWidth: theme.sizes.maxContentWidth,
    width: '100%',
  },
  input: {
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    borderWidth: theme.sizes.border,
    color: theme.colors.text,
    fontSize: theme.fontSizes.body,
    minHeight: theme.sizes.buttonHeight,
    paddingHorizontal: theme.spacing.sm,
  },
  link: {
    color: theme.colors.accent,
    fontSize: theme.fontSizes.label,
    textAlign: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSizes.title,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
});

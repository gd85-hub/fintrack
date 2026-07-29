import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../contexts/AuthContext';

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSignOut() {
    setErrorMessage('');
    setSubmitting(true);

    const { error } = await signOut();

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Вы вошли как {session?.user.email}</Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Pressable
        disabled={submitting}
        onPress={() => void handleSignOut()}
        style={({ pressed }) => [
          styles.button,
          (pressed || submitting) && styles.buttonPressed,
        ]}
      >
        <Text style={styles.buttonText}>Выйти</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  buttonPressed: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    flex: 1,
    gap: 20,
    justifyContent: 'center',
    padding: 24,
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
});

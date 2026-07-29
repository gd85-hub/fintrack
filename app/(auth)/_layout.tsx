import { Redirect, Stack } from 'expo-router';

import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (session) {
    return <Redirect href="/(app)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

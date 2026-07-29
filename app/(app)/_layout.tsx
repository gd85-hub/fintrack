import { Redirect, Stack } from 'expo-router';

import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuth } from '../../contexts/AuthContext';
import {
  DisplayCurrencyProvider,
  useDisplayCurrency,
} from '../../contexts/DisplayCurrencyContext';

function AppNavigator() {
  const { loading } = useDisplayCurrency();

  if (loading) {
    return <LoadingScreen />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function AppLayout() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <DisplayCurrencyProvider>
      <AppNavigator />
    </DisplayCurrencyProvider>
  );
}

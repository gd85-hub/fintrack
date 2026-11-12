import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LoadingScreen } from '../../components/LoadingScreen';
import {
  SIDEBAR_WIDTH,
  TabBar,
  useIsDesktopWeb,
} from '../../components/TabBar';
import { useAuth } from '../../contexts/AuthContext';
import {
  DisplayCurrencyProvider,
  useDisplayCurrency,
} from '../../contexts/DisplayCurrencyContext';
import {
  HomeCurrencyProvider,
  useHomeCurrency,
} from '../../contexts/HomeCurrencyContext';
import { ReceiptDraftProvider } from '../../contexts/ReceiptDraftContext';

function AppNavigator() {
  const { loading: displayCurrencyLoading } = useDisplayCurrency();
  const { loading: homeCurrencyLoading } = useHomeCurrency();
  const isDesktopWeb = useIsDesktopWeb();

  if (displayCurrencyLoading || homeCurrencyLoading) {
    return <LoadingScreen />;
  }

  return (
    <View
      style={[
        styles.root,
        isDesktopWeb && styles.webContent,
      ]}
    >
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <TabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="analytics" options={{ title: 'Analytics' }} />
        <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
        <Tabs.Screen name="expense/new" options={{ href: null }} />
        <Tabs.Screen name="expense/[id]" options={{ href: null }} />
        <Tabs.Screen name="receipt/scan" options={{ href: null }} />
        <Tabs.Screen name="receipt/review" options={{ href: null }} />
        <Tabs.Screen name="merchants" options={{ href: null }} />
        <Tabs.Screen name="categories" options={{ href: null }} />
        <Tabs.Screen name="feedback" options={{ href: null }} />
        <Tabs.Screen name="menu" options={{ href: null }} />
      </Tabs>
    </View>
  );
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
      <HomeCurrencyProvider>
        <ReceiptDraftProvider>
          <AppNavigator />
        </ReceiptDraftProvider>
      </HomeCurrencyProvider>
    </DisplayCurrencyProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  webContent: {
    paddingLeft: SIDEBAR_WIDTH,
  },
});

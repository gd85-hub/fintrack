import { Platform } from 'react-native';

export function resetSiteUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

import * as Application from 'expo-application';
import Constants from 'expo-constants';

function resolveAppVersion(): string {
  try {
    const nativeVersion = Application.nativeApplicationVersion;
    const nativeBuild = Application.nativeBuildVersion;

    if (nativeVersion && nativeBuild) {
      return `${nativeVersion} (${nativeBuild})`;
    }

    return Constants.expoConfig?.version ?? nativeVersion ?? 'unknown';
  } catch {
    try {
      return Constants.expoConfig?.version ?? 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

export function appVersionLabel(): string {
  return resolveAppVersion();
}

export function appVersionString(): string {
  return resolveAppVersion();
}

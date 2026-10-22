import type { Translate } from './i18n';

export function localizedAuthError(
  message: string,
  action: 'sign-in' | 'sign-up',
  t: Translate,
): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('already registered') ||
    normalized.includes('already been registered') ||
    normalized.includes('user already exists')
  ) {
    return t('auth.err.alreadyRegistered');
  }

  if (normalized.includes('invalid login credentials')) {
    return t('auth.err.invalidCredentials');
  }

  if (normalized.includes('email not confirmed')) {
    return t('auth.err.emailNotConfirmed');
  }

  if (normalized.includes('password')) {
    return t('auth.err.passwordTooShort');
  }

  if (normalized.includes('email')) {
    return t('auth.err.invalidEmail');
  }

  return action === 'sign-in'
    ? t('auth.err.signInFailed')
    : t('auth.err.signUpFailed');
}

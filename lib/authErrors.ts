export function authErrorInRussian(
  message: string,
  action: 'sign-in' | 'sign-up',
): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('already registered') ||
    normalized.includes('already been registered') ||
    normalized.includes('user already exists')
  ) {
    return 'Пользователь с таким email уже зарегистрирован.';
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Неверный email или пароль.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Подтвердите email по ссылке из письма.';
  }

  if (normalized.includes('password')) {
    return 'Пароль должен содержать не менее 6 символов.';
  }

  if (normalized.includes('email')) {
    return 'Введите корректный email.';
  }

  return action === 'sign-in'
    ? 'Не удалось войти. Попробуйте ещё раз.'
    : 'Не удалось зарегистрироваться. Попробуйте ещё раз.';
}

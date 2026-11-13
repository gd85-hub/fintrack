// Feature flags. Flip to re-enable once the dependency is in place.
//
// PASSWORD_RESET_UI: self-service password reset (the "Забыли пароль?" link and
// the forgot-password / reset-password screens). Set to true ONLY after a
// sending domain + custom SMTP (Resend) are configured in Supabase
// (Site URL + redirect allowlist for /reset-password, EXPO_PUBLIC_SITE_URL in the
// build). Until then the reset email won't deliver reliably, so the entry point
// is hidden; beta password resets are done manually by the owner via an admin
// recovery link. The reset code stays in place and dormant.
export const PASSWORD_RESET_UI = false;

// ANCHOR_DISPLAY: display amounts computed from the frozen EUR anchor
// (amount_eur) + historical EUR-base rates, instead of the stored
// amount_rsd/usd/eur triple. Home and analytics are wired behind the flag;
// keep it false until FX-16c device verification. While false, nothing in
// production reads EUR-base fx_rates rows.
export const ANCHOR_DISPLAY = false;

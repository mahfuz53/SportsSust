export const ADMIN_EMAILS = [
  'mahfuz53@gmail.com',
  'ceo@autoconengineering.com',
  'sakibtalha1208@gmail.com',
] as const;

/** @deprecated Use ADMIN_EMAILS */
export const ADMIN_EMAIL = ADMIN_EMAILS[0];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase();
  return ADMIN_EMAILS.some((admin) => admin.toLowerCase() === normalized);
}

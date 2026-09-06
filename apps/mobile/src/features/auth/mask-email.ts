/** "jisu@example.com" → "ji***@example.com". WP-AUTH-008이 화면에 보여줄 때만 쓴다. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');

  if (at <= 0) return email;

  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

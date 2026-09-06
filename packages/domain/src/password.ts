/**
 * 비밀번호 규칙. 앱의 체크리스트(WP-AUTH-004)와 서버 검증이 같은 표를 본다 —
 * 두 곳에 따로 적으면 앱이 통과시킨 비밀번호를 서버가 거절하는 날이 온다.
 */
export const PASSWORD_RULES = [
  { key: 'length', label: '8자 이상', test: (password: string) => password.length >= 8 },
  {
    key: 'alphanumeric',
    label: '영문과 숫자 함께',
    test: (password: string) => /[A-Za-z]/.test(password) && /[0-9]/.test(password),
  },
  { key: 'special', label: '특수문자 하나 이상', test: (password: string) => /[^A-Za-z0-9]/.test(password) },
] as const;

export type PasswordRuleKey = (typeof PASSWORD_RULES)[number]['key'];

/** 규칙별로 통과 여부. 화면이 이걸 그대로 체크리스트로 그린다. */
export function checkPassword(password: string): { key: PasswordRuleKey; label: string; ok: boolean }[] {
  return PASSWORD_RULES.map((rule) => ({ key: rule.key, label: rule.label, ok: rule.test(password) }));
}

export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

/** 이메일은 대소문자를 구분하지 않는다. 저장·조회 전에 항상 이걸 거친다. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

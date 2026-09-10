type LegalDateKey = 'LEGAL_TERMS_EFFECTIVE_ON' | 'LEGAL_PRIVACY_EFFECTIVE_ON';

/** 날짜를 정하지 않는다. API와 같은 이름의 배포 설정을 읽는다. */
export function legalEffectiveDate(key: LegalDateKey, env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env[key]?.trim();
  if (!value) {
    if (env.RENDER === 'true' || env.NODE_ENV === 'production') {
      throw new Error(`${key}에 확정된 시행일(YYYY-MM-DD)을 설정해야 웹을 배포할 수 있습니다.`);
    }
    return null;
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${key}는 실제 존재하는 날짜(YYYY-MM-DD)여야 합니다.`);
  }
  const [year, month, day] = value.split('-');
  return `시행일 ${year}년 ${Number(month)}월 ${Number(day)}일`;
}

export function validateLegalDates(): void {
  legalEffectiveDate('LEGAL_TERMS_EFFECTIVE_ON');
  legalEffectiveDate('LEGAL_PRIVACY_EFFECTIVE_ON');
}

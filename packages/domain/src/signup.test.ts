import { findPaymentWords } from './pick-verification';
import {
  AGE_BLOCKED_NOTICE,
  CONSENT_INTRO,
  CONSENT_ITEMS,
  MINIMUM_AGE,
  NOT_ACTIVATED_NOTICE,
  OPTIONAL_CONSENTS,
  REQUIRED_CONSENTS,
  REQUIRED_CONSENT_NOTICE,
  ageOn,
  canActivate,
  consentVersion,
  isDraftVersion,
  isOldEnough,
  missingRequiredConsents,
} from './signup';

const TODAY = new Date(Date.UTC(2026, 8, 1));

const granted = (...items: string[]) =>
  items.map((item) => ({ item, version: 'draft-2026-09-01' }));

describe('가입 연령', () => {
  it('만 나이를 센다', () => {
    expect(ageOn('2000-09-01', TODAY)).toBe(26);
    /* 생일 하루 전이면 아직 한 살 적다. */
    expect(ageOn('2000-09-02', TODAY)).toBe(25);
  });

  it('만 14세부터 가입할 수 있다', () => {
    expect(MINIMUM_AGE).toBe(14);
    expect(isOldEnough('2012-09-01', TODAY)).toBe(true);
    expect(isOldEnough('2012-09-02', TODAY)).toBe(false);
  });

  it('읽을 수 없는 날짜는 통과시키지 않는다', () => {
    /* 모르는 것을 통과시키면 연령 제한은 잘못 적기만 하면 넘어가는 문이 된다. */
    for (const bad of ['', '20000901', '2000-13-01', '2026-02-30', '언젠가']) {
      expect(ageOn(bad, TODAY)).toBeNull();
      expect(isOldEnough(bad, TODAY)).toBe(false);
    }
  });

  it('미래에 태어날 수는 없다', () => {
    expect(ageOn('2030-01-01', TODAY)).toBeNull();
  });
});

describe('약관 동의', () => {
  it('필수와 선택이 갈라져 있다', () => {
    expect(REQUIRED_CONSENTS).toEqual(['terms', 'privacy']);
    expect(OPTIONAL_CONSENTS).toEqual(['marketing']);
    expect(REQUIRED_CONSENTS.filter((item) => OPTIONAL_CONSENTS.includes(item))).toEqual([]);
  });

  it('필수 항목을 다 받아야 빈 목록이 된다', () => {
    expect(missingRequiredConsents([])).toEqual(['terms', 'privacy']);
    expect(missingRequiredConsents(granted('terms'))).toEqual(['privacy']);
    expect(missingRequiredConsents(granted('terms', 'privacy'))).toEqual([]);
  });

  it('선택 항목만 받아도 가입은 끝나지 않는다', () => {
    expect(missingRequiredConsents(granted('marketing'))).toEqual(['terms', 'privacy']);
  });

  it('판이 다른 동의는 받지 않은 것으로 본다', () => {
    /* 약관이 개정되면 이전 동의는 다른 글에 대한 동의다(§N-3). */
    expect(missingRequiredConsents([{ item: 'terms', version: 'v1' }])).toContain('terms');
  });

  it('아직 확정되지 않은 판인 것이 표시된다', () => {
    for (const item of CONSENT_ITEMS) {
      expect(isDraftVersion(consentVersion(item.key))).toBe(true);
    }
  });
});

describe('계정 활성화', () => {
  it('연령을 확인하기 전에는 살릴 수 없다', () => {
    expect(canActivate({ ageGate: 'pending', granted: granted('terms', 'privacy') })).toEqual({
      ok: false,
      reason: expect.any(String),
    });
  });

  it('만 14세 미만은 살릴 수 없다', () => {
    const result = canActivate({ ageGate: 'blocked', granted: granted('terms', 'privacy') });

    expect(result).toEqual({ ok: false, reason: AGE_BLOCKED_NOTICE });
  });

  it('필수 동의가 빠지면 살릴 수 없다', () => {
    const result = canActivate({ ageGate: 'passed', granted: granted('terms') });

    expect(result).toEqual({ ok: false, reason: REQUIRED_CONSENT_NOTICE });
  });

  it('연령과 필수 동의가 모두 끝나야 살아난다', () => {
    expect(canActivate({ ageGate: 'passed', granted: granted('terms', 'privacy') })).toEqual({
      ok: true,
    });
  });
});

describe('가입 문구', () => {
  const copy = [
    AGE_BLOCKED_NOTICE,
    REQUIRED_CONSENT_NOTICE,
    CONSENT_INTRO,
    NOT_ACTIVATED_NOTICE,
    ...CONSENT_ITEMS.map((item) => item.label),
  ];

  it('금지어가 없다', () => {
    for (const text of copy) {
      expect(findPaymentWords(text)).toEqual([]);
      expect(text).not.toMatch(/견적|계약서/);
    }
  });

  it('느낌표와 이모지를 쓰지 않는다', () => {
    for (const text of copy) {
      expect(text).not.toContain('!');
    }
  });
});

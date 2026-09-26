import { findPaymentWords } from './pick-verification';
import {
  CONSENT_AGREEMENT_ITEMS,
  OPTIONAL_AGREEMENT_ITEMS,
  REQUIRED_AGREEMENT_ITEMS,
  acceptedSignupItems,
  signupConsentKey,
  signupConsentsFor,
} from './consent-terms';
import {
  ACTIVATION_CONSENTS,
  AGE_BLOCKED_NOTICE,
  CONSENT_INTRO,
  CONSENT_ITEMS,
  MINIMUM_AGE,
  NOT_ACTIVATED_NOTICE,
  OPTIONAL_CONSENTS,
  REQUIRED_CONSENTS,
  REQUIRED_CONSENT_NOTICE,
  canActivate,
  consentDocKind,
  consentVersion,
  isDraftVersion,
  missingRequiredConsents,
} from './signup';

const granted = (...items: string[]) =>
  items.map((item) => ({ item, version: 'draft-2026-09-01' }));

describe('가입 연령', () => {
  it('만 14세부터 가입할 수 있다', () => {
    expect(MINIMUM_AGE).toBe(14);
  });
});

describe('약관 동의', () => {
  it('필수와 선택이 갈라져 있다', () => {
    expect(REQUIRED_CONSENTS).toEqual(['terms', 'privacy', 'age', 'pick_certification', 'consultation_recording']);
    expect(OPTIONAL_CONSENTS).toEqual(['marketing', 'contact_share', 'night_alerts']);
    expect(REQUIRED_CONSENTS.filter((item) => OPTIONAL_CONSENTS.includes(item))).toEqual([]);
  });

  it('계정을 살리는 관문은 필수 다섯 전부다(2026-09-26 대표 결정 「강제한다」)', () => {
    expect(ACTIVATION_CONSENTS).toEqual(['terms', 'privacy', 'age', 'pick_certification', 'consultation_recording']);
    expect(ACTIVATION_CONSENTS).toEqual(REQUIRED_CONSENTS);
  });

  it('약관 동의 화면(WP-AUTH-010)의 여덟 칸이 전부 서버 항목으로 옮겨진다', () => {
    expect(CONSENT_AGREEMENT_ITEMS).toHaveLength(8);
    const serverKeys = CONSENT_ITEMS.map((item) => item.key as string);
    for (const item of CONSENT_AGREEMENT_ITEMS) {
      const key = signupConsentKey(item.key);
      expect(serverKeys).toContain(key);
      /* 필수 · 선택이 화면과 서버에서 같다 — 행의 is_required가 화면이 받은 성격을 남긴다. */
      expect(CONSENT_ITEMS.find((candidate) => candidate.key === key)?.required).toBe(item.required);
    }
    expect(signupConsentKey('benefit_alerts')).toBe('marketing');
    expect(new Set(CONSENT_AGREEMENT_ITEMS.map((item) => signupConsentKey(item.key))).size).toBe(8);
  });

  it('체크한 칸만 화면 순서대로 보낸다', () => {
    const all = new Set(CONSENT_AGREEMENT_ITEMS.map((item) => item.key));
    expect(signupConsentsFor(all)).toEqual([
      'age', 'terms', 'privacy', 'pick_certification', 'consultation_recording',
      'contact_share', 'marketing', 'night_alerts',
    ]);
    const requiredOnly = new Set(REQUIRED_AGREEMENT_ITEMS.map((item) => item.key));
    expect(signupConsentsFor(requiredOnly)).toEqual(['age', 'terms', 'privacy', 'pick_certification', 'consultation_recording']);
    expect(signupConsentsFor(requiredOnly).some((key) => OPTIONAL_AGREEMENT_ITEMS.some((item) => signupConsentKey(item.key) === key))).toBe(false);
  });

  it('서버가 아는 항목만 보낸다 — 옛 서버는 셋, 새 서버는 여덟', () => {
    const all = new Set(CONSENT_AGREEMENT_ITEMS.map((item) => item.key));
    const legacy = acceptedSignupItems({ items: [{ item: 'terms' }, { item: 'privacy' }, { item: 'marketing' }] });
    expect(signupConsentsFor(all, legacy)).toEqual(['terms', 'privacy', 'marketing']);

    const current = acceptedSignupItems({
      items: [{ item: 'terms' }, { item: 'privacy' }, { item: 'marketing' }],
      agreements: CONSENT_ITEMS.map((item) => ({ item: item.key })),
    });
    expect(signupConsentsFor(all, current)).toHaveLength(8);
    /* 모르면(null) 전부 — 서버가 판정한다. */
    expect(signupConsentsFor(all, null)).toHaveLength(8);
  });

  it('동의 항목이 가리키는 문서 종류는 terms_doc_kind 이름이다', () => {
    expect(consentDocKind('pick_certification')).toBe('pick_verification');
    expect(consentDocKind('contact_share')).toBe('contact_sharing');
    expect(consentDocKind('consultation_recording')).toBe('consultation_recording');
    expect(consentDocKind('age')).toBeNull();
    expect(consentDocKind('night_alerts')).toBeNull();
  });

  it('필수 항목을 다 받아야 빈 목록이 된다', () => {
    expect(missingRequiredConsents([])).toEqual(REQUIRED_CONSENTS);
    expect(missingRequiredConsents(granted('terms'))).toEqual(['privacy', 'age', 'pick_certification', 'consultation_recording']);
    /* 옛 앱이 보내던 둘만으로는 이제 모자란다. */
    expect(missingRequiredConsents(granted('terms', 'privacy'))).toEqual(['age', 'pick_certification', 'consultation_recording']);
    expect(missingRequiredConsents(granted(...REQUIRED_CONSENTS))).toEqual([]);
  });

  it('선택 항목만 받아도 가입은 끝나지 않는다', () => {
    expect(missingRequiredConsents(granted('marketing', 'contact_share', 'night_alerts'))).toEqual(REQUIRED_CONSENTS);
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
  it('만 14세 이상이라고 체크하지 않으면 살릴 수 없다', () => {
    const result = canActivate({ ageVerified: false, granted: granted('terms', 'privacy') });

    expect(result).toEqual({ ok: false, reason: AGE_BLOCKED_NOTICE });
  });

  it('필수 동의가 빠지면 살릴 수 없다', () => {
    const result = canActivate({ ageVerified: true, granted: granted('terms') });

    expect(result).toEqual({ ok: false, reason: REQUIRED_CONSENT_NOTICE });
  });

  it('연령 확인과 필수 동의가 모두 끝나야 살아난다', () => {
    expect(canActivate({ ageVerified: true, granted: granted(...REQUIRED_CONSENTS) })).toEqual({
      ok: true,
    });
    /* 필수 하나라도 빠지면 막는다 — 옛 앱의 terms · privacy만으로는 살아나지 않는다. */
    expect(canActivate({ ageVerified: true, granted: granted('terms', 'privacy') })).toEqual({
      ok: false,
      reason: REQUIRED_CONSENT_NOTICE,
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

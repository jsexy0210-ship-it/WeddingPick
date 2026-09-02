import type { MaskedIdentifierKind, PaymentMethod } from './payment-proof';

/**
 * 결제문자·영수증 글에서 값을 읽는다. **규칙으로 읽는다.**
 *
 * 화면데이터구조 스펙 7.3이 순서를 정해뒀다 — DB 재사용 → 캐시 → 함수 → 규칙 엔진
 * → ... → 저비용 AI → 고성능 AI. 결제문자는 카드사가 기계로 찍어 보내는 글이라
 * 형태가 거의 고정돼 있다. 이걸 AI에 보내는 것은 곱셈을 시키려고 사람을 부르는 것과
 * 같다.
 *
 * **여기서 읽지 못한 것만 다음 단계로 간다**(`needsVisionFallback`). 그리고 다음
 * 단계에서도 못 읽으면 사용자가 직접 적는다 — 스펙 7.3의 "버튼 선택이 AI 재호출보다
 * 저렴하면 사용자 확인 우선"이 그 말이다.
 *
 * 이 파일에 **카드번호를 담을 자리가 없다.** 반환 타입에 그런 필드를 만들지
 * 않았으므로, 읽더라도 밖으로 나가지 못한다. 종류만 나간다.
 */

/** 읽어낸 값 하나. 못 읽었으면 null이다 — 지어내지 않는다(추출규칙 1번). */
export type ParsedField<T> = { value: T; confidence: number } | null;

export const PAYMENT_PROOF_FIELDS = ['merchantName', 'paidAmount', 'paidAt', 'method'] as const;

export type PaymentProofField = (typeof PAYMENT_PROOF_FIELDS)[number];

export const PAYMENT_PROOF_FIELD_LABEL: Record<PaymentProofField, string> = {
  merchantName: '가맹점 이름',
  /* 사용자 화면에 그대로 나가는 이름이라 `결제`를 쓰지 않는다(v3.13 §O-1). */
  paidAmount: '금액',
  paidAt: '낸 날',
  method: '지불 수단',
};

export type ParsedPaymentProof = {
  merchantName: ParsedField<string>;
  paidAmount: ParsedField<number>;
  paidAt: ParsedField<string>;
  method: ParsedField<PaymentMethod>;
  /** 글에 있었던 식별정보의 **종류**. 값은 담기지 않는다 — 담을 필드가 없다. */
  maskedIdentifiers: MaskedIdentifierKind[];
  /** 규칙으로 못 읽은 항목. 화면이 무엇을 물어야 할지 안다. */
  missing: PaymentProofField[];
  /**
   * 결제가 아닌 글로 보이는 이유. 있으면 등록하지 않는다.
   *
   * 취소·환불 문자를 결제로 등록하면 분포가 위로 끌린다 — 낸 적 없는 돈이 낸 돈이
   * 된다. 읽기 실패보다 나쁘다: 읽기 실패는 눈에 보이지만 이건 안 보인다.
   */
  rejection: string | null;
};

/* -------------------------------------------------------------------------- */
/* 이 글이 결제 기록인가                                                       */
/* -------------------------------------------------------------------------- */

const CANCELLED = /취소|환불|반품|승인취소|매입취소/;
const PAYMENT_SIGNAL = /승인|결제|이체|출금|입금|송금|일시불|할부|영수증/;

/* -------------------------------------------------------------------------- */
/* 금액                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 결제 금액이 **아닌** 금액.
 *
 * 결제문자에는 금액이 여럿 있다 — 누적, 잔액, 한도, 적립. 가장 큰 수를 고르면
 * 대개 누적이나 잔액을 집는다. 그래서 고르는 규칙이 아니라 **빼는 규칙**을 쓴다:
 * 이 말들 뒤에 붙은 금액은 결제 금액이 아니다.
 */
const NOT_A_PAYMENT_AMOUNT = /(누적|잔액|한도|합계|총액|사용가능|적립|포인트|할인|잔여)\s*$/;

const AMOUNT = /([\d][\d,]*)\s*원/g;

function readAmount(text: string): ParsedField<number> {
  const candidates: number[] = [];

  for (const match of text.matchAll(AMOUNT)) {
    const before = text.slice(Math.max(0, match.index - 12), match.index);

    if (NOT_A_PAYMENT_AMOUNT.test(before)) {
      continue;
    }

    const value = Number(match[1]!.replace(/,/g, ''));

    if (Number.isFinite(value) && value > 0) {
      candidates.push(value);
    }
  }

  if (candidates.length === 0) return null;

  /*
   * 남은 것이 하나면 그것이다. 여럿이면 첫 번째를 쓰되 확신을 낮춘다 —
   * 카드 승인 문자는 결제 금액을 맨 앞에 적는다. 확신이 낮으면 화면이 사용자에게
   * 확인을 받는다(needsAttention과 같은 규칙).
   */
  return candidates.length === 1
    ? { value: candidates[0]!, confidence: 0.95 }
    : { value: candidates[0]!, confidence: 0.6 };
}

/* -------------------------------------------------------------------------- */
/* 날짜와 시각                                                                 */
/* -------------------------------------------------------------------------- */

const FULL_DATE = /(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/;
const SHORT_DATE = /(?:^|[^\d])(\d{1,2})[./](\d{1,2})(?:[^\d]|$)/;
const TIME = /(\d{1,2}):(\d{2})/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * 연도 없는 `05/20`을 언제로 읽을 것인가.
 *
 * 카드사 문자는 연도를 적지 않는다. **앞으로의 결제는 없으므로**, 오늘보다 뒤가
 * 되지 않는 가장 가까운 해를 고른다 — 1월에 받은 `12/28`은 작년 12월이다.
 *
 * 이 추정이 틀릴 수 있는 자리라 확신을 낮게 준다. 결제 시점은 가격 분포의 기간을
 * 가르는 값이라, 한 해가 어긋나면 "최근 12개월"이 통째로 달라진다.
 */
function resolveYear(month: number, day: number, now: Date): number {
  const thisYear = now.getFullYear();
  const candidate = new Date(thisYear, month - 1, day, 12);

  return candidate.getTime() > now.getTime() ? thisYear - 1 : thisYear;
}

function readPaidAt(text: string, now: Date): ParsedField<string> {
  const time = TIME.exec(text);
  const hours = time ? Number(time[1]) : 12;
  const minutes = time ? Number(time[2]) : 0;

  const build = (year: number, month: number, day: number, confidence: number) => {
    if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59) {
      return null;
    }

    const value = new Date(
      `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`
    );

    if (Number.isNaN(value.getTime()) || value.getDate() !== day) {
      return null;
    }

    return { value: value.toISOString(), confidence };
  };

  const full = FULL_DATE.exec(text);

  if (full) {
    return build(Number(full[1]), Number(full[2]), Number(full[3]), 0.95);
  }

  const short = SHORT_DATE.exec(text);

  if (short) {
    const month = Number(short[1]);
    const day = Number(short[2]);

    /*
     * 연도를 추정한 값이다. 한 해가 어긋나면 기간이 통째로 달라지므로 **사람이
     * 확인해야 하는 쪽으로** 확신을 준다 — LOW_CONFIDENCE_THRESHOLD보다 낮다.
     * 처음에 기준값과 똑같이 0.7로 뒀더니 경계에 걸려 아무것도 표시되지 않았다.
     */
    return build(resolveYear(month, day, now), month, day, 0.6);
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* 결제 수단                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 카드사 이름이 아니라 **행위**로 정한다.
 *
 * "카카오뱅크"는 체크카드 승인일 수도 이체일 수도 있다. 이름으로 정하면 둘 중
 * 하나는 늘 틀린다. 승인·일시불·할부는 카드고, 이체·출금·송금은 계좌다.
 */
function readMethod(text: string): ParsedField<PaymentMethod> {
  if (/일시불|할부|승인/.test(text)) return { value: 'card', confidence: 0.9 };
  if (/이체|출금|송금|입금/.test(text)) return { value: 'transfer', confidence: 0.85 };
  if (/현금영수증|현금/.test(text)) return { value: 'cash', confidence: 0.8 };

  return null;
}

/* -------------------------------------------------------------------------- */
/* 식별정보 — 종류만                                                           */
/* -------------------------------------------------------------------------- */

/**
 * 마스킹된 이름과 **마스킹되지 않은 이름**.
 *
 * 처음에는 `홍*동`만 찾았는데, 실제 문자에는 `승인 홍길동님`처럼 이름이 그대로
 * 찍혀 나오는 것이 있었다. 그게 스펙 8.4가 말한 가족카드 명의자다 — 마스킹된
 * 쪽보다 마스킹 안 된 쪽이 더 위험한데 그쪽을 못 보고 있었다.
 *
 * 자유 글에서 한국 이름을 형태로 잡을 수는 없다(후기 쪽에서 이미 겪었다). 다만
 * 결제문자는 자유 글이 아니라서 `님`이라는 강한 신호가 있다. 그 신호가 있는
 * 것만 잡고, 없는 것은 잡지 못한다고 둔다 — 짐작으로 지우면 가맹점 이름이 지워진다.
 */
const PERSON_NAME = /[가-힣]\*+[가-힣]?\s*(님|귀하)?|[가-힣]{2,4}\s*(님|귀하)/;

const IDENTIFIER_PATTERNS: { kind: MaskedIdentifierKind; pattern: RegExp }[] = [
  // 신한카드(1234) · 1234-****-****-5678
  { kind: 'card_number', pattern: /카드\s*\(\d{4}\)|\d{4}-?\*{2,}|\*{3,}\d{4}/ },
  { kind: 'approval_number', pattern: /승인\s*번호|승인번호\s*[:\s]*\d{5,}/ },
  { kind: 'person_name', pattern: PERSON_NAME },
  { kind: 'phone', pattern: /01[016-9][-.\s]?\d{3,4}[-.\s]?\d{4}/ },
  // 12*******34 · 계좌번호. 날짜를 지운 글에서 찾는다 — 2026-07-03이 계좌처럼 생겼다.
  { kind: 'account_number', pattern: /\d{2,}\*{2,}\d*|\d{2,6}-\d{2,6}-\d{2,8}|계좌\s*번호/ },
];

/** 날짜를 지운 글. 날짜가 계좌번호처럼 생겨서 그대로 두면 없는 계좌를 찾아낸다. */
const DATE_SHAPES = /\d{4}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2}\s*일?/g;

function readIdentifiers(text: string): MaskedIdentifierKind[] {
  const withoutDates = text.replace(DATE_SHAPES, ' ');

  return IDENTIFIER_PATTERNS.filter(({ pattern }) => pattern.test(withoutDates)).map(
    ({ kind }) => kind
  );
}

/* -------------------------------------------------------------------------- */
/* 가맹점 이름                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 알아본 토큰을 지우고 남는 것이 가맹점 이름이다.
 *
 * 줄 단위로 버리지 않는 이유는, 형태가 카드사마다 다르기 때문이다 —
 * `05/20 14:23 가온예식홀`처럼 날짜와 이름이 한 줄에 있기도 하다. 줄을 버리면
 * 이름까지 같이 버린다.
 */
const NOISE_TOKENS: RegExp[] = [
  /\[[^\]]*\]/g, // [Web발신], [카카오뱅크]
  /(신한|국민|KB국민|KB|삼성|현대|롯데|하나|우리|BC|비씨|NH농협|NH|농협|씨티|전북|광주|제주|수협|새마을|카카오|토스|케이)\s*(체크카드|카드|은행|뱅크|페이|체크)/g,
  /\d{4}[.\-/년]\s*\d{1,2}[.\-/월]\s*\d{1,2}\s*일?/g,
  /\d{1,2}[./]\d{1,2}/g,
  /\d{1,2}:\d{2}(:\d{2})?/g,
  /[\d][\d,]*\s*원/g,
  /(누적|잔액|한도|합계|총액|사용가능|적립|포인트|할인|잔여)/g,
  /(승인|결제|이체|출금|입금|송금|일시불|할부|영수증|취소|환불|매입|사용|현금|발급)/g,
  /\d+\s*개월/g,
  /[가-힣]\*+[가-힣]?\s*(님|귀하)?/g,
  // 마스킹되지 않은 이름. 이게 남으면 가맹점 이름 자리에 사람 이름이 들어간다.
  /[가-힣]{2,4}\s*(님|귀하)/g,
  /(체크카드|신용카드|가맹점|승인처)/g,
  // 홀로 남은 '카드·은행·뱅크'. 앞뒤에 한글이 붙어 있으면 상호의 일부라 두고 간다
  // — '하나웨딩컨벤션'의 하나를 지우면 안 되는 것과 같은 이유다.
  /(?<![가-힣])(카드|은행|뱅크)(?![가-힣])/g,
  /\(\d{4}\)/g,
  /\d{2,}[-*]{2,}[\d*]*/g,
  /\*{2,}/g,
  /01[016-9][-.\s]?\d{3,4}[-.\s]?\d{4}/g,
  /\d{2,6}-\d{2,6}-\d{2,8}/g,
];

/** 가맹점 이름으로 볼 만한가. 숫자와 기호만 남은 찌꺼기를 거른다. */
function looksLikeName(candidate: string): boolean {
  if (candidate.length < 2 || candidate.length > 40) return false;

  // 한글이나 영문이 있어야 이름이다. 남은 숫자 조각은 이름이 아니다.
  return /[가-힣A-Za-z]{2,}/.test(candidate);
}

function readMerchantName(text: string): ParsedField<string> {
  const candidates: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    let remaining = line;

    for (const token of NOISE_TOKENS) {
      remaining = remaining.replace(token, ' ');
    }

    const cleaned = remaining.replace(/[\s,·|/\\]+/g, ' ').trim();

    if (looksLikeName(cleaned)) {
      candidates.push(cleaned);
    }
  }

  if (candidates.length === 0) return null;

  /*
   * 여럿이 남으면 고르지 않는다 — 확신을 낮춰 사용자에게 확인을 받는다.
   *
   * 가맹점 이름을 잘못 읽으면 **남의 업체 분포에 내 결제가 들어간다.** 등록 쪽에서
   * 이름이 여러 업체에 걸리면 매칭하지 않는 것과 같은 이유다.
   */
  return candidates.length === 1
    ? { value: candidates[0]!, confidence: 0.85 }
    : { value: candidates[candidates.length - 1]!, confidence: 0.5 };
}

/* -------------------------------------------------------------------------- */
/* 읽기                                                                        */
/* -------------------------------------------------------------------------- */

export function parsePaymentText(text: string, now: Date = new Date()): ParsedPaymentProof {
  const empty: ParsedPaymentProof = {
    merchantName: null,
    paidAmount: null,
    paidAt: null,
    method: null,
    maskedIdentifiers: [],
    missing: [...PAYMENT_PROOF_FIELDS],
    rejection: null,
  };

  if (text.trim().length === 0) {
    return { ...empty, rejection: '읽을 글이 없어요.' };
  }

  /*
   * 취소·환불 문자를 먼저 거른다.
   *
   * 이걸 결제로 등록하면 분포가 위로 끌린다 — 낸 적 없는 돈이 낸 돈이 된다.
   * 읽기 실패보다 나쁘다: 읽기 실패는 눈에 보이지만 이건 안 보인다.
   */
  if (CANCELLED.test(text)) {
    return {
      ...empty,
      maskedIdentifiers: readIdentifiers(text),
      rejection: '취소·환불 안내로 보여요. Pick 인증에는 실제로 낸 내역이 필요해요.',
    };
  }

  if (!PAYMENT_SIGNAL.test(text)) {
    return {
      ...empty,
      rejection: '금액이 적힌 안내문으로 보이지 않아요. 안내 문자나 영수증을 올려주세요.',
    };
  }

  const parsed = {
    merchantName: readMerchantName(text),
    paidAmount: readAmount(text),
    paidAt: readPaidAt(text, now),
    method: readMethod(text),
    maskedIdentifiers: readIdentifiers(text),
    rejection: null,
  };

  return {
    ...parsed,
    missing: PAYMENT_PROOF_FIELDS.filter((field) => parsed[field] === null),
  };
}

/**
 * 규칙으로 못 읽어 다음 단계가 필요한가. 스펙 7.3의 escalation.
 *
 * **결제 수단은 세지 않는다.** 못 읽으면 '확인 안 됨'으로 두면 되고, 그것 하나
 * 때문에 AI를 부르는 것은 스펙 7.3이 막으려던 바로 그 일이다.
 */
export function needsVisionFallback(parsed: ParsedPaymentProof): boolean {
  if (parsed.rejection !== null) return false;

  return (['merchantName', 'paidAmount', 'paidAt'] as const).some(
    (field) => parsed[field] === null
  );
}

/**
 * 확신이 낮아 사람이 봐야 하는 항목.
 *
 * 문서 쪽의 `needsAttention`과 같은 규칙이고 같은 기준값을 쓴다 — 두 화면이 다른
 * 기준으로 "확인해 주세요"를 띄우면 사용자는 그 표시를 못 믿게 된다.
 */
export function fieldsNeedingConfirmation(
  parsed: ParsedPaymentProof,
  threshold: number
): PaymentProofField[] {
  return PAYMENT_PROOF_FIELDS.filter((field) => {
    const value = parsed[field];

    return value !== null && value.confidence < threshold;
  });
}

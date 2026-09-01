/**
 * 업체 관계자 인증. 최종통합정책 v2.0 26·27번.
 *
 * 반론 심사 도구에 "소속을 어떻게 확인하는지는 아직 정하지 않았다"고 적어뒀던
 * 자리다. 이제 정해졌다 — 우선순위가 있고, 회사 이메일이 없는 곳을 위한 대체
 * 수단이 있다.
 *
 * 두 가지를 구조로 지킨다.
 *
 * 1. **자동 승인은 없다.** 이메일 도메인이 맞아떨어져도 그건 확인의 재료지
 *    결론이 아니다 — 도메인이 같다는 것은 그 회사의 주소라는 뜻이지, 신청한
 *    사람이 그 주소를 쓴다는 뜻이 아니다. 결론은 사람이 낸다.
 * 2. **증빙 원본은 일반 사용자에게 보이지 않는다**(원문 27번). 사업자등록증에는
 *    대표자 이름과 주소가 적혀 있다. 그래서 증빙은 가리키기만 하고, 사용자에게
 *    나가는 뷰에는 그 열이 아예 없다.
 */

/**
 * 인증 수단. **배열 순서가 곧 우선순위다**(원문 26번).
 *
 * 위쪽이 강하다. 같은 사람이 여러 수단을 낼 수 있고, 그중 가장 강한 것으로
 * 심사한다.
 */
export const CLAIM_METHODS = ['official_domain_email', 'listed_email', 'business_document'] as const;

export type ClaimMethod = (typeof CLAIM_METHODS)[number];

export type ClaimMethodRule = {
  label: string;
  /** 무엇을 확인하는 수단인지. 신청 화면에 그대로 쓴다. */
  description: string;
};

export const CLAIM_METHOD_RULES: Record<ClaimMethod, ClaimMethodRule> = {
  official_domain_email: {
    label: '업체 공식 도메인 이메일',
    description: '업체 홈페이지 주소와 같은 도메인의 이메일이면 가장 빠르게 확인돼요',
  },
  listed_email: {
    label: '공개된 이메일',
    description: '공식 홈페이지나 공식 채널에 적혀 있는 이메일이면 어디에 적혀 있는지 함께 알려주세요',
  },
  business_document: {
    label: '사업자 관련 증빙',
    description: '회사 이메일이 없어도 괜찮아요. 사업자 관련 증빙으로도 확인할 수 있어요',
  },
};

export function methodRank(method: ClaimMethod): number {
  return CLAIM_METHODS.indexOf(method);
}

/** 낸 수단 중 가장 강한 것. 우선순위가 배열 순서이므로 가장 앞선 것이 답이다. */
export function strongestMethod(methods: readonly ClaimMethod[]): ClaimMethod | null {
  let best: ClaimMethod | null = null;

  for (const method of methods) {
    if (best === null || methodRank(method) < methodRank(best)) best = method;
  }

  return best;
}

/*
 * 수단마다 필요한 것이 다르다. **없는 채로 접수될 수 없게 타입으로 묶는다** —
 * 공개된 이메일이라면서 어디에 공개돼 있는지 없으면 심사하는 사람이 확인할
 * 방법이 없고, 그런 신청은 접수해봐야 되돌아온다.
 */
export type ClaimEvidence =
  | { method: 'official_domain_email'; email: string }
  | { method: 'listed_email'; email: string; listedAt: string }
  | { method: 'business_document'; documentId: string };

export const CLAIM_STATUSES = ['pending', 'approved', 'rejected'] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/** 사용자에게 나가는 말. 표시 정책(`report-state.ts`)을 따른다. */
export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  pending: '확인 중',
  approved: '확인 완료',
  rejected: '반영되지 않았어요',
};

/** 낸 사람에게 보이는 상태 설명. */
export const CLAIM_STATUS_NOTE: Record<ClaimStatus, string> = {
  pending: '보내주신 내용을 확인하고 있어요. 확인이 끝나면 알림으로 알려드려요',
  approved: '업체 관계자로 확인됐어요. 이제 이 업체의 후기에 반론을 낼 수 있어요',
  rejected: '확인하지 못했어요. 사유를 함께 보내드렸어요',
};

/**
 * 넣자마자 되는 줄 알고 기다리지 않게 먼저 말한다.
 *
 * 연락은 사람이 한다. 앱이 메일을 보내는 것이 아니므로 "인증 메일을
 * 보내드렸어요"라고 적지 않는다 — 오지 않는 메일을 기다리게 만든다.
 */
export const CLAIM_REVIEW_NOTICE =
  '담당자가 알려주신 주소로 연락해 확인해요. 확인 전에는 관계자로 표시되지 않아요';

export const CLAIM_EVIDENCE_NOTICE =
  '보내주신 증빙은 확인에만 써요. 다른 사용자에게는 보이지 않아요';

export const MIN_CLAIM_ROLE_LENGTH = 2;

export type ClaimCheck = { ok: true } | { ok: false; message: string };

/** 이메일에서 도메인만. 형태가 아니면 null이다. */
export function domainOf(email: string): string | null {
  const at = email.trim().toLowerCase();
  const parts = at.split('@');

  if (parts.length !== 2) return null;

  const [local, domain] = parts as [string, string];

  if (local.length === 0 || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return null;
  }

  return domain;
}

/**
 * 업체 공식 도메인과 같은지.
 *
 * 하위 도메인도 같은 곳으로 본다(`mail.gaon.co.kr` ↔ `gaon.co.kr`). 다만
 * **꼬리만 같은 남의 도메인은 아니다** — `notgaon.co.kr`은 `gaon.co.kr`로 끝나지만
 * 다른 곳이다. 점을 붙여 견주는 이유다.
 */
export function matchesOfficialDomain(email: string, officialDomain: string | null): boolean {
  if (officialDomain === null) return false;

  const domain = domainOf(email);
  if (domain === null) return false;

  const official = officialDomain.trim().toLowerCase();
  if (official.length === 0) return false;

  return domain === official || domain.endsWith(`.${official}`);
}

/** 접수해도 되는 신청인지. 결론이 아니라 형식만 본다. */
export function checkClaim(input: { claimedRole: string; evidence: ClaimEvidence }): ClaimCheck {
  if (input.claimedRole.trim().length < MIN_CLAIM_ROLE_LENGTH) {
    return { ok: false, message: '업체에서 어떤 일을 하시는지 적어주세요' };
  }

  const { evidence } = input;

  if (evidence.method === 'business_document') {
    if (evidence.documentId.trim().length === 0) {
      return { ok: false, message: '사업자 관련 증빙을 첨부해주세요' };
    }

    return { ok: true };
  }

  if (domainOf(evidence.email) === null) {
    return { ok: false, message: '이메일 주소를 다시 확인해주세요' };
  }

  if (evidence.method === 'listed_email' && evidence.listedAt.trim().length === 0) {
    return { ok: false, message: '그 이메일이 어디에 공개돼 있는지 알려주세요' };
  }

  return { ok: true };
}

/**
 * 심사하는 사람이 먼저 보는 한 줄.
 *
 * **결론이 아니다.** 규칙이 볼 수 있는 것은 "도메인이 같은가"까지이고, 그
 * 주소를 신청한 사람이 실제로 쓰는지는 규칙이 알 수 없다. 그래서 이 함수는
 * 승인/거절을 돌려주지 않고 사람이 읽을 재료만 돌려준다.
 */
export type ClaimSignal = {
  /** 자동 판정이 아니라 확인 재료라는 것을 이름이 말한다. */
  domainMatches: boolean;
  reasonCode: string;
  note: string;
};

export function claimSignal(input: {
  evidence: ClaimEvidence;
  officialDomain: string | null;
}): ClaimSignal {
  const { evidence, officialDomain } = input;

  if (evidence.method === 'business_document') {
    return {
      domainMatches: false,
      reasonCode: 'document_submitted',
      note: '사업자 관련 증빙이 왔다. 원본을 사람이 본다.',
    };
  }

  if (officialDomain === null) {
    return {
      domainMatches: false,
      reasonCode: 'official_domain_unknown',
      note: '이 업체의 공식 도메인을 아직 모른다. 견줄 것이 없으므로 사람이 확인한다.',
    };
  }

  if (matchesOfficialDomain(evidence.email, officialDomain)) {
    return {
      domainMatches: true,
      reasonCode: 'domain_matches',
      note: `공식 도메인(${officialDomain})과 같다. 다만 그 주소를 신청인이 쓰는지는 확인해야 한다.`,
    };
  }

  return {
    domainMatches: false,
    reasonCode: 'domain_differs',
    note: `공식 도메인(${officialDomain})과 다르다.`,
  };
}

export const CLAIM_RULE_VERSION = 'vendor-claim-1';

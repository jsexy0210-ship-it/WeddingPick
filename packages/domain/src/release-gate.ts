import { POLICY_DOCUMENTS } from './policies';
import { withdrawalReady } from './withdrawal';

/**
 * 출시 전 법적 고지 차단 조건.
 *
 * 사업자명·대표자·등록번호·주소·문의처·시행일이 비어 있는 채로 서비스가 열리면
 * 그건 준비가 덜 된 것이 아니라 **법을 어긴 상태**다. 그런데 이 값들은 화면 구석에
 * 있어서 아무도 안 보고, 다들 "출시 전에 채우겠지"라고 생각한다.
 *
 * 그래서 사람이 기억하는 대신 배포가 막는다. 개발·테스트에서는 placeholder를
 * 허용하고, Production에서는 하나라도 비면 뜨지 않는다.
 */

/** 채워져야 하는 값들. 정책이 정한 목록이다. */
export const REQUIRED_LEGAL_FIELDS = [
  'businessName',
  'representative',
  'registrationNumber',
  'address',
  'supportContact',
  'privacyOfficer',
  'termsEffectiveOn',
  'privacyEffectiveOn',
] as const;

export type LegalField = (typeof REQUIRED_LEGAL_FIELDS)[number];

export const LEGAL_FIELD_LABEL: Record<LegalField, string> = {
  businessName: '사업자명',
  representative: '대표자',
  registrationNumber: '사업자등록번호',
  address: '주소',
  supportContact: '고객문의 정보',
  privacyOfficer: '개인정보 보호 담당정보',
  termsEffectiveOn: '약관 시행일',
  privacyEffectiveOn: '개인정보처리방침 시행일',
};

/** 값이 없거나 이 글자들로 채워져 있으면 아직 안 정해진 것이다. */
export const PLACEHOLDER_MARKERS = ['TBD', 'TODO', '미정', '확인 필요', 'placeholder', 'XXX'];

export type LegalNotice = Partial<Record<LegalField, string | null | undefined>>;

/** 이 값이 아직 안 정해졌는가. */
export function isPlaceholder(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;

  const trimmed = value.trim();

  if (trimmed === '') return true;

  return PLACEHOLDER_MARKERS.some((marker) =>
    trimmed.toLowerCase().includes(marker.toLowerCase())
  );
}

export type ReleaseCheck = {
  /** 아직 안 정해진 값들. */
  missing: LegalField[];
  /**
   * 값 말고 문서가 막는 것들.
   *
   * 사업자 정보를 다 채워도 약관과 개인정보처리방침이 확정 전이면 문을 열 수 없다.
   * 탈퇴 안내가 없으면 사용자는 자기가 낸 자료가 어떻게 되는지 모르는 채로 가입한다.
   */
  blockingDocuments: string[];
  /** Production으로 나가도 되는가. */
  releasable: boolean;
  /** 사람이 읽을 한 줄. 나가도 되면 null. */
  note: string | null;
};

/**
 * 이 값들로 Production을 열어도 되는가.
 *
 * **비어 있는 것을 기본값으로 채워주지 않는다.** 여기서 `주식회사 웨딩픽` 같은
 * 그럴듯한 값을 넣어주면, 진짜 사업자명이 뭔지 아무도 안 묻게 된다.
 */
export function checkRelease(notice: LegalNotice): ReleaseCheck {
  const missing = REQUIRED_LEGAL_FIELDS.filter((field) => isPlaceholder(notice[field]));

  /*
   * 확정본이 게시되지 않은 문서. `url`이 없으면 아직 게시하지 않은 것이다 —
   * 상태 글자(`자문 대기`)를 믿지 않고 실제 게시 여부를 본다.
   */
  const blockingDocuments = POLICY_DOCUMENTS.filter(
    (policy) => policy.id !== 'analysis-notice' && policy.url === undefined
  ).map((policy) => policy.title);

  if (!withdrawalReady()) blockingDocuments.push('탈퇴 안내');

  const parts: string[] = [];

  if (missing.length > 0) {
    parts.push(`아직 정해지지 않은 값: ${missing.map((field) => LEGAL_FIELD_LABEL[field]).join(', ')}`);
  }

  if (blockingDocuments.length > 0) {
    parts.push(`아직 확정되지 않은 문서: ${blockingDocuments.join(', ')}`);
  }

  return {
    missing,
    blockingDocuments,
    releasable: missing.length === 0 && blockingDocuments.length === 0,
    note: parts.length === 0 ? null : parts.join(' / '),
  };
}

/** 이 환경이 Production인가. 그 밖에서는 placeholder를 허용한다. */
export function isProduction(env: string | undefined): boolean {
  return env === 'production';
}

/**
 * 배포 직전 한 번. Production이면 던지고, 그 밖에서는 경고만 돌려준다.
 *
 * 던지는 쪽을 고른 이유: 경고는 로그에 한 줄 남고 지나간다. 사업자 정보가 빈
 * 서비스는 지나가면 안 되는 상태다.
 */
export function assertReleasable(env: string | undefined, notice: LegalNotice): string | null {
  const check = checkRelease(notice);

  if (check.releasable) return null;

  if (isProduction(env)) {
    throw new Error(`법적 고지가 준비되지 않아 배포할 수 없다. ${check.note}`);
  }

  return check.note;
}

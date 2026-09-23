/**
 * 약관 동의 · 권한 안내(WP-AUTH-010) · 약관 상세 풀팝업(WP-AUTH-011) 콘텐츠.
 *
 * v3.29 정본 `docs/design/html/대메뉴_홈(로그인, 온보딩).dc.html`의 `agreeReq` ·
 * `agreeOpt` · `perms` · `TERM_DOCS`를 그대로 옮긴다. 문구는 임의로 바꾸지 않는다
 * (CLAUDE.md 「.dc.html은 디자인 레퍼런스다 … 문구는 그대로 쓰고 임의로 바꾸지
 * 않는다」).
 *
 * **6탭 조문은 아직 목업이다.** v3.29 정본 — 「약관 조문은 법무 확정 전 임시
 * 문구」(README.md 「미확정」) — 이고, 실제 조문 데이터는 관리자 그룹이 별도로
 * DB · 관리자 편집 도구로 잇는다(CLAUDE.md 「웨딩노트 [open]」이 아니라 이 파일
 * 자체의 경계다). 이 화면은 그 데이터가 붙기 전까지 이 목업으로 UI를 완성해 둔다.
 *
 * **동의 제출(백엔드)과 이 목록은 다르다.** `packages/domain/src/signup.ts`의
 * `CONSENT_ITEMS`(현재 `terms` · `privacy` · `marketing` 셋)만 서버가 실제로
 * 받는다 — DB의 `terms_doc_kind` enum(마이그레이션 0130, admin-ops 소유라 이
 * 세션은 건드리지 않는다)이 그 셋만 알기 때문이다. 아래 `CONSENT_AGREEMENT_ITEMS`는
 * **화면에 보여줄 항목 전부**(필수 5 · 선택 3)를 담지만, 실제로 서버에 보내는
 * 값은 화면 쪽(`app/login/consent.tsx`)이 이 중 서버가 아는 항목만 추려 보낸다.
 * 나머지는 화면 검증(필수 전부 체크해야 CTA가 켜짐)에만 쓰고 서버 계약이 넓어지면
 * 그때 다시 잇는다.
 */

export type ConsentAgreementKey =
  | 'age'
  | 'terms'
  | 'privacy'
  | 'pick_certification'
  | 'consultation_recording'
  | 'contact_share'
  | 'benefit_alerts'
  | 'night_alerts';

export type ConsentAgreementItem = {
  key: ConsentAgreementKey;
  /** 필수 · 선택. */
  required: boolean;
  /** WP-AUTH-010 `agItem`의 label 그대로. */
  label: string;
  /** `>` 표시 — 눌러서 WP-AUTH-011(약관 상세)을 여는 항목인가. */
  hasDoc: boolean;
};

/** 필수 5 — dc.html `agreeReq` 순서 그대로. */
export const REQUIRED_AGREEMENT_ITEMS: readonly ConsentAgreementItem[] = [
  { key: 'age', required: true, label: '만 14세 이상이에요', hasDoc: false },
  { key: 'terms', required: true, label: '서비스 이용약관', hasDoc: true },
  { key: 'privacy', required: true, label: '개인정보 수집 · 이용', hasDoc: true },
  { key: 'pick_certification', required: true, label: 'Pick 인증 자료 수집 · 이용', hasDoc: true },
  { key: 'consultation_recording', required: true, label: '상담 녹음 수집 · 이용', hasDoc: true },
];

/** 선택 3 — dc.html `agreeOpt` 순서 그대로. */
export const OPTIONAL_AGREEMENT_ITEMS: readonly ConsentAgreementItem[] = [
  { key: 'contact_share', required: false, label: '상담 예약 시 업체에 연락처 제공', hasDoc: true },
  { key: 'benefit_alerts', required: false, label: '혜택 · 이벤트 알림 받기', hasDoc: true },
  { key: 'night_alerts', required: false, label: '밤 9시 ~ 아침 8시에도 알림 받기', hasDoc: false },
];

export const CONSENT_AGREEMENT_ITEMS: readonly ConsentAgreementItem[] = [
  ...REQUIRED_AGREEMENT_ITEMS,
  ...OPTIONAL_AGREEMENT_ITEMS,
];

/** 앱 접근 권한 4칸 — dc.html `perms`. 아이콘 이름은 화면(RN) 쪽 아이콘 이름으로 옮긴다. */
export type AppPermissionItem = { key: 'notification' | 'camera' | 'photo' | 'mic'; name: string; desc: string };

export const APP_PERMISSION_ITEMS: readonly AppPermissionItem[] = [
  { key: 'notification', name: '알림', desc: '웨딩 일정 · Pick 인증 결과 · 상담 소식을 알려드려요' },
  { key: 'camera', name: '카메라', desc: '계약서 · 영수증을 촬영해 Pick 인증할 때 사용해요' },
  { key: 'photo', name: '사진', desc: '리얼후기 · Pick 인증에 사진을 첨부할 때 사용해요' },
  { key: 'mic', name: '마이크', desc: '상담 내용을 녹음해 상담기록으로 남길 때 사용해요' },
];

/** 앱 접근 권한 안내문 — dc.html `permNoteT`. */
export const APP_PERMISSION_NOTE = '기능을 처음 쓸 때 물어봐요. 설정 > 웨딩픽에서 바꿀 수 있어요.';

export type TermArticle = { title: string; body: string };

export type TermDocument = {
  key: ConsentAgreementKey;
  /** 탭 라벨 — WP-AUTH-011 `termTabs`. */
  tab: string;
  /** 문서 제목 — `tdDocTitle`. */
  title: string;
  /** 문서 메타(판 · 시행일 · 필수/선택) — `tdDocMeta`. */
  meta: string;
  articles: readonly TermArticle[];
};

/** 약관 상세 풀팝업(WP-AUTH-011) 6탭 — dc.html `TERM_DOCS` 그대로. */
export const TERM_DOCUMENTS: readonly TermDocument[] = [
  {
    key: 'terms',
    tab: '이용약관',
    title: '서비스 이용약관',
    meta: 'v1.0 · 2026년 9월 1일 시행 · 필수',
    articles: [
      {
        title: '제1조 목적',
        body: '이 약관은 웨딩픽(이하 «회사»)이 제공하는 웨딩 준비 서비스의 이용 조건과 절차, 회사와 회원의 권리 · 의무를 정합니다.',
      },
      {
        title: '제2조 서비스 내용',
        body: '회사는 업체 검색, Pick(후보 저장 · 비교), 상담 예약 연결, 웨딩노트(일정 · 예산 · 상담기록), 실 제보 기반 금액 안내, 리얼후기를 제공합니다. 회사는 업체를 대신 골라주거나 계약을 대행하지 않습니다.',
      },
      {
        title: '제3조 회원가입',
        body: '만 14세 이상이면 카카오 계정으로 가입할 수 있습니다. 필수 항목에 모두 동의해야 가입이 완료됩니다.',
      },
      {
        title: '제4조 실 제보와 Pick 인증',
        body: '회원이 올린 Pick 인증 자료의 금액은 개인을 알아볼 수 없게 구간과 건수로 집계됩니다. 실 제보가 3건 미만이면 금액을 표시하지 않습니다.',
      },
      {
        title: '제5조 상담 예약',
        body: '회원이 상담 예약을 신청하면 회사는 선택한 업체에 연락처와 희망 일시를 전달합니다. 상담 · 계약 내용과 대금 지급은 회원과 업체가 직접 정합니다.',
      },
      {
        title: '제6조 리얼후기',
        body: 'Pick 인증을 마친 회원만 후기를 쓸 수 있습니다. 사실과 다르거나 타인의 권리를 침해하는 후기는 게시가 중단될 수 있고, 업체는 반론을 요청할 수 있습니다.',
      },
      {
        title: '제7조 광고와 검색 순위',
        body: '광고 · 스폰서 영역은 일반 검색 결과와 구분해 표시합니다. 광고비는 검색 자연순위, 실 제보, 후기 순서에 영향을 주지 않습니다.',
      },
      {
        title: '제8조 금지 행위',
        body: '허위 제보, 타인 계정 사용, 자동화 수단으로 정보를 수집하는 행위, 업체 · 회원을 비방하는 행위를 금지합니다.',
      },
      {
        title: '제9조 회원 탈퇴',
        body: '회원은 MY > 계정에서 언제든 탈퇴할 수 있습니다. 탈퇴 후 개인정보는 개인정보처리방침에 따라 삭제되며, 익명 집계된 실 제보는 남을 수 있습니다.',
      },
      {
        title: '제10조 책임의 한계',
        body: '회사는 업체와 회원 사이의 계약 이행에 관여하지 않습니다. 다만 회사의 고의 또는 중대한 과실로 생긴 손해는 배상합니다.',
      },
    ],
  },
  {
    key: 'privacy',
    tab: '개인정보',
    title: '개인정보 수집 · 이용',
    meta: 'v1.0 · 2026년 9월 1일 시행 · 필수',
    articles: [
      {
        title: '수집 항목',
        body: '카카오 닉네임 · 이메일 · 출생연도(만 14세 확인 후 삭제), 예식일 · 지역 · 예산 · 스타일, 서비스 이용 기록, 기기 정보.',
      },
      {
        title: '이용 목적',
        body: '회원 식별, 조건에 맞는 업체 검색 결과 제공, 웨딩노트 저장, 배우자 연결, 고객 문의 응대, 부정 이용 방지.',
      },
      {
        title: '보유 기간',
        body: '회원 탈퇴 시 바로 삭제합니다. 관계 법령이 보존을 요구하는 기록은 정해진 기간 동안만 분리 보관합니다.',
      },
      {
        title: '동의 거부 권리',
        body: '필수 항목에 동의하지 않으면 가입할 수 없습니다. 선택 항목은 동의하지 않아도 서비스를 이용할 수 있습니다.',
      },
    ],
  },
  {
    key: 'pick_certification',
    tab: 'Pick 인증',
    title: 'Pick 인증 자료 수집 · 이용',
    meta: 'v1.0 · 2026년 9월 1일 시행 · 필수',
    articles: [
      {
        title: '수집 항목',
        body: '회원이 올린 계약서 · 영수증 · 결제 화면 사진, 업체명, 계약 금액, 계약일, 포함 항목.',
      },
      {
        title: '이용 목적',
        body: '제보 금액 확인, 실 제보 구간 · 건수 집계, 예산현황 자동 입력, 리얼후기 작성 자격 확인.',
      },
      {
        title: '처리 방식',
        body: '사진 속 이름 · 연락처 · 주소 등 개인 식별 정보는 가린 뒤 금액과 조건만 추출합니다. 원본 사진은 확인이 끝나면 30일 안에 삭제합니다.',
      },
      {
        title: '공개 범위',
        body: '다른 회원에게는 개별 금액이 아니라 구간과 건수로만 보입니다. 제보자가 누구인지는 표시하지 않습니다.',
      },
      {
        title: '보유 기간',
        body: '추출한 금액 정보는 탈퇴 전까지 보관하고, 탈퇴 후에는 개인과 연결되지 않는 집계값만 남습니다.',
      },
    ],
  },
  {
    key: 'consultation_recording',
    tab: '상담 녹음',
    title: '상담 녹음 수집 · 이용',
    meta: 'v1.0 · 2026년 9월 1일 시행 · 필수',
    articles: [
      { title: '수집 항목', body: '회원이 녹음하거나 올린 상담 음성 파일, 상담 업체명, 상담 일시.' },
      {
        title: '이용 목적',
        body: '상담 내용을 포함 항목 · 별도 비용 · 조건 · 확인 필요로 정리해 상담기록에 저장합니다.',
      },
      {
        title: '녹음 전 안내',
        body: '녹음에는 업체 직원의 목소리도 담깁니다. 녹음을 시작하기 전에 업체에 녹음한다고 알려주세요.',
      },
      {
        title: '보유 기간',
        body: '음성 원본은 정리가 끝나면 7일 안에 삭제합니다. 정리된 상담기록은 회원이 지우거나 탈퇴할 때까지 보관합니다.',
      },
      {
        title: '공개 범위',
        body: '상담기록은 본인과 연결된 배우자만 볼 수 있습니다. 다른 회원이나 업체에 공개하지 않습니다.',
      },
    ],
  },
  {
    key: 'contact_share',
    tab: '제3자 제공',
    title: '상담 예약 시 연락처 제공',
    meta: 'v1.0 · 2026년 9월 1일 시행 · 선택',
    articles: [
      { title: '제공받는 자', body: '회원이 상담 예약을 신청한 업체.' },
      { title: '제공 항목', body: '닉네임, 연락처, 희망 상담 일시, 예식일, 예산 구간.' },
      { title: '제공 목적', body: '상담 일정 확정과 연락.' },
      { title: '보유 기간', body: '업체는 상담 종료 후 6개월 안에 파기해야 합니다.' },
      {
        title: '동의 거부 권리',
        body: '동의하지 않아도 가입할 수 있습니다. 다만 상담 예약을 신청할 때 다시 동의를 요청합니다.',
      },
    ],
  },
  {
    key: 'benefit_alerts',
    tab: '혜택 알림',
    title: '혜택 · 이벤트 알림 수신',
    meta: 'v1.0 · 2026년 9월 1일 시행 · 선택',
    articles: [
      { title: '보내는 내용', body: '웨딩지원금, 박람회, 업체 할인 등 혜택과 이벤트 소식.' },
      { title: '보내는 방법', body: '앱 푸시 알림. 하루 최대 2건입니다.' },
      { title: '야간 알림', body: '밤 9시부터 아침 8시 사이에는 별도로 동의한 경우에만 보냅니다.' },
      { title: '수신 확인', body: '동의한 날부터 2년마다 수신 동의 여부를 다시 확인합니다.' },
      { title: '동의 철회', body: 'MY > 알림 설정에서 언제든 끌 수 있습니다.' },
    ],
  },
];

export function termDocumentFor(key: ConsentAgreementKey): TermDocument | null {
  return TERM_DOCUMENTS.find((doc) => doc.key === key) ?? null;
}

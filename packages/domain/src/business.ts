/**
 * 사업자 정보 — 2026-09-08 발급 사업자등록증(고양세무서, 일반과세자) 그대로.
 *
 * **한 곳에만 적는다.** 웹 푸터·이용약관·개인정보처리방침·앱 MY 하단이 전부
 * 여기서 읽는다. 전자상거래법·정보통신망법이 이용자에게 보이라고 정한 항목이라,
 * 화면마다 따로 적으면 한 곳만 고쳐지는 날이 온다.
 *
 * 대표자의 생년월일은 등록증에 있지만 공시 항목이 아니다 — 적지 않는다.
 * 사업장 소재지는 운영자 자택이라 게시하지 않는다(2026-09-08 결정) — 필드 자체를
 * 두지 않는다. 사업장을 따로 두게 되면 그때 더한다.
 * 통신판매업 신고번호는 아직 없다 — 지어 적지 않고, 신고하면 여기에 더한다.
 */
export const BUSINESS = {
  /** 상호. 서비스명(웨딩픽)과 다르다 — 법적 표시는 상호로 한다. */
  name: '픽랩',
  /** 서비스명. */
  serviceName: '웨딩픽',
  representative: '안재호',
  registrationNumber: '727-06-03536',
  /** 개업연월일. */
  openedOn: '2026-09-08',
  businessType: '정보통신업',
  businessItem: '응용 소프트웨어 개발 및 공급업',
} as const;

/** 푸터·MY 하단에 나가는 표시 줄. 법정 항목을 이 순서로 적는다. */
export const BUSINESS_NOTICE_LINES: readonly string[] = [
  `상호 ${BUSINESS.name} · 대표 ${BUSINESS.representative}`,
  `사업자등록번호 ${BUSINESS.registrationNumber}`,
  `업태 ${BUSINESS.businessType} · 종목 ${BUSINESS.businessItem}`,
];

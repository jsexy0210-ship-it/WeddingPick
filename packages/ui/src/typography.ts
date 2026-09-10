/**
 * 글자 크기 토큰. **화면이 쓸 수 있는 크기는 이 표에 있는 것뿐이다.**
 *
 * spec/tokens.json `typography.scale` 8단 — display 32 · title 26 · heading 24 · section 20 · body 18 ·
 * sub 16 · caption 14 · micro 13 — 을 핸드오프 이름(t1~t7)으로 든다. 15 · 17 · 19 · 22px은 금지다.
 *
 * 여기 없는 값을 화면에 직접 적으면(`fontSize: 19`) 그 화면 하나만 다른 글자를
 * 쓰게 되고, 나중에 크기를 손볼 때 그 하나가 남는다. 남은 하나는 고장으로 보이지
 * 않아서 아무도 안 고친다.
 *
 * `typography.test.ts`가 저장소를 훑어 이 표 밖의 크기를 막는다.
 */
export const FontSize = {
  /** display 32/43 — 홈 Hero · 큰 금액. */
  t1: 32,
  /** title 26/35 — 화면 제목 · 업체 상세 업체명. */
  t2: 26,
  /** heading 24/32 — 바텀시트 제목. */
  t3: 24,
  /** section 20/27 — 섹션 제목 · 카드 업체명. */
  t4: 20,
  /** body 18/24 — 리스트 행 제목 · 강조 값. */
  t5: 18,
  /** sub 16/22 — 본문 · 금액 · 버튼 라벨. 입력 칸의 글자도 본문이다. */
  t6: 16,
  /** caption 14/19 — 메타 · 건수 · 섹션 라벨 · 상태 배지. */
  t7: 14,
  /**
   * 날짜 선택의 칸 글자. component.datePicker.cellFontSize — 20-onboarding-v2의
   * `optCell` · `dayCell`이 15다. t 스케일에는 없는 값이고 이 시트에서만 쓴다.
   */
  dateCell: 15,
  /** micro 13/18 — 정보 단계 배지 · 스타일 칩(28) · 이미지 위 순위 pill. */
  micro: 13,
  /** Npay 로고 — 원 안의 N 12 · «pay» 14. spec/tokens.json typography npay. 다른 곳에 쓰지 않는다. */
  npayN: 12,
  npayPay: 14,
  /** 탭 바 라벨. tabBar.labelSize 12/16. */
  tab: 12,
  /** 상태 배지(Pick 완료 · 인증완료 · 결정 완료). component.badge 14/19/700 · minHeight 22. */
  badge: 14,
  /** 금액 한 덩어리. display와 같다. */
  amount: 32,
  /**
   * 관리자 요약 대시보드의 대표 수치(자동 처리율). spec/tokens.json typography.scale
   * adminHero — 21-admin.dc.html dash가 «font-size:40px;letter-spacing:-1.4px»다.
   * display(32)와 그 위가 비어 있어서 t 스케일에 자리가 없다.
   */
  adminHero: 40,
  /** 코드·식별자(관리자 · 내부). */
  code: 12,
  /** 관리자 KPI 숫자 30/38. 웹 전용 `/admin`만 쓴다 — spec typography.scale adminKpi. */
  adminKpi: 30,
  /** 관리자 상단 상태 배너 제목 15/21. adminBanner. */
  adminBanner: 15,
  /** 관리자 사이드바 그룹 제목 11/15. adminNavGroup. */
  adminNavGroup: 11,
} as const;

/**
 * 줄 높이. 크기마다 하나씩 짝지어 둔다 — spec/tokens.json `typography.scale` lineHeight 그대로.
 *
 * 크기만 토큰으로 두고 줄 높이를 화면이 정하면, 같은 16px 글이 화면마다 다른
 * 간격으로 앉는다 — 크기가 같아도 다른 글씨처럼 보인다.
 */
export const LineHeight = {
  t1: 43,
  t2: 35,
  t3: 32,
  t4: 27,
  t5: 24,
  t6: 22,
  /** sub 16의 여러 줄 변형(150%) — `ThemedText type="body"`. */
  t6Body: 24,
  t7: 19,
  /** caption 14의 여러 줄 변형 — 안내문 2줄. */
  t7Loose: 21,
  micro: 18,
  /** Npay 로고 — N은 원 높이(20)와 같고 «pay»는 글자 높이와 같다. */
  npayN: 20,
  npayPay: 14,
  /** letter-spacing -1.4는 화면이 따로 준다 — LineHeight는 높이만 든다. */
  adminHero: 40,
  tab: 16,
  badge: 19,
  amount: 43,
  link: 19,
  adminKpi: 38,
  adminBanner: 21,
  adminNavGroup: 15,
  /*
   * 관리자 콘솔 전용 줄 높이. v3.27 `html/22-admin-ops.dc.html`이 앱 스케일과 다른 짝을
   * 쓴다 — 같은 12px이라도 앱은 16, 관리자 표는 17이다. **가까운 값으로 대신하지 않는다.**
   * 표 한 줄이 1px씩 어긋나면 여덟 줄에서 8px이 밀리고, 1920 기준으로 맞춰 둔 카드 높이가
   * 따라 어긋난다. 글자 크기는 t 스케일에 이미 있어 새로 만들지 않았고 줄 높이만 더한다.
   */
  /** 12px 메타 — cardSub · kpiNote · rowMeta · 표 머리 · 막대 라벨(`12/17`). */
  adminMeta: 17,
  /** 12px 각주 — 카드 맨 아래 회색 한 줄(noteLine `12/18`). */
  adminNote: 18,
  /** 13px 본문 — 표 셀 · 배너 풀이 · 빈 상태 설명(`13/19`). */
  adminCell: 19,
  /** 14px 행 — 행 이름과 오른쪽 숫자(`14/20`). 확인 카드 항목(13)도 이 높이다. */
  adminRow: 20,
  /** 18px 확인 카드 제목(`18/25`). */
  adminConfirmTitle: 25,
} as const;

export type FontSizeToken = keyof typeof FontSize;

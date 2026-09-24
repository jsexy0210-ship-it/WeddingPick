/**
 * 글자 크기 토큰. **화면이 쓸 수 있는 크기는 이 표에 있는 것뿐이다.**
 *
 * spec/tokens.json `typography.scale` 8단 — display 32 · title 26 · heading 24 · section 20 · body 18 ·
 * sub 16 · caption 14 · micro 13 — 을 핸드오프 이름(t1~t7)으로 든다. 예외 값은 아래에 용도를 명시한다.
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
   * 날짜 휠 아래 결과 줄의 D-day. component.dateWheel.pickedDday — 루트 시안
   * `WP-APP-020` `pickedDday`가 15/22/700이다. t 사다리에 없는 값이고 이 시트에서만 쓴다.
   *
   * 예전 이름은 `dateCell`이었다(연월 셀렉트 + 달력 시절의 `optCell` · `dayCell` 15).
   * 값은 같지만 그 칸들은 휠로 바뀌면서 없어졌고, 없어진 것의 이름을 남겨 두면 다음
   * 사람이 달력이 아직 있는 줄 안다.
   */
  dateWheelDday: 15,
  /**
   * 날짜 휠에서 중앙으로부터 두 칸 떨어진 글자. component.dateWheel.two —
   * 루트 시안 `WP-APP-020` `wheelItem`이 거리마다 20 · 18 · **17** · 16으로 줄인다.
   * 17은 t 사다리에 없는 값이고 이 휠에서만 쓴다 — 18이나 16으로 대신하면 네 단계가
   * 세 단계로 뭉개져 「멀어질수록 흐려진다」가 눈에 덜 든다.
   */
  dateWheel: 17,
  /** 검색 Root 제목. RN 정본 `docs/design/React_Native/search.js:533` headTitleRoot 22px. */
  searchRootTitle: 22,
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
  /*
   * 피그마 규격서(`docs/design/figma-export/*.txt` · 2026-09-15 대표 지시 「규격서의 수를 그대로」)의
   * 글자 크기. 이름이 곧 값이다 — 규격서 줄의 «14/700 · lh 19»를 f14 + fontWeight 700 +
   * LineHeight.lh19로 옮긴다. 8단계 스케일(t1~t7)과 겹치는 값도 따로 두는 이유는 줄높이가
   * 다르기 때문이다(피그마는 Tailwind 기본 줄높이). 출처는 spec/tokens.json `typography.figma`.
   */
  f7: 7,
  f9: 9,
  f10: 10,
  f11: 11,
  f12: 12,
  f13: 13,
  f14: 14,
  f15: 15,
  f16: 16,
  /** 로그인 카카오 CTA. 06-onboarding-login.dc.html `17/700 · lh 23`. */
  f17: 17,
  f18: 18,
  /** 웨딩노트 D-day 날짜와 숫자. React_Native/note.js `ddayDate` · `ddayNum` 19px. */
  noteDday: 19,
  f20: 20,
  f24: 24,
  f26: 26,
  f28: 28,
  f30: 30,
  f32: 32,
  f38: 38,
  f42: 42,
  f46: 46,
  f52: 52,
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
  /** 날짜 휠 두 칸 밖 글자의 줄 높이. component.dateWheel.two 17/23. */
  dateWheel: 23,
  /** 날짜 휠 결과 줄 D-day. component.dateWheel.pickedDday 15/22. */
  dateWheelDday: 22,
  /** 로그인 제목. RN 정본 `docs/design/React_Native/home.js:650` loginTitle 32/44. */
  loginTitle: 44,
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
  /* 피그마 규격서의 줄높이. 이름이 곧 값이다 — 규격서 «lh 19»는 lh19. */
  lh11: 11,
  lh14: 14,
  lh15: 15,
  lh16: 16,
  lh17: 17,
  lh19: 19,
  lh20: 20,
  lh22: 22,
  lh23: 23,
  lh24: 24,
  lh28: 28,
  lh32: 32,
  lh36: 36,
  lh38: 38,
  lh39: 39,
  lh40: 40,
  lh42: 42,
  lh45: 45,
  lh46: 46,
  lh52: 52,
} as const;

/**
 * 피그마 규격서의 자간(px). 이름은 값이다 — «ls -0.4px»는 n04, «ls 0.5px»는 p05.
 * 출처 spec/tokens.json `typography.figma.letterSpacings`.
 */
export const LetterSpacing = {
  n138: -1.38,
  n105: -1.05,
  n095: -0.95,
  n072: -0.72,
  n065: -0.65,
  n064: -0.64,
  n06: -0.6,
  n052: -0.52,
  n04: -0.4,
  p025: 0.25,
  p03: 0.3,
  p05: 0.5,
  p11: 1.1,
  p15: 1.5,
  p16: 1.6,
  p17: 1.7,
  p18: 1.8,
  p12: 1.2,
  /*
   * 2.2 · 2.4는 영문 eyebrow(`JUST FOR YOU` · `WEDDING, LESS OVERWHELMING`) 전용이었다.
   * 2026-09-15 대표 지시로 그 줄들을 지우면서 쓰는 곳이 없어졌다 — 같이 뺀다.
   * 다시 필요해지면 규격서(`docs/design/figma-export/06-onboarding-login.dc.html` · `onboarding.txt`)에서 재서 넣는다.
   */
} as const;

export type FontSizeToken = keyof typeof FontSize;

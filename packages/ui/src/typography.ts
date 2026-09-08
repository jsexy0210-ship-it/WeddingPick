/**
 * 글자 크기 토큰. **화면이 쓸 수 있는 크기는 이 표에 있는 것뿐이다.**
 *
 * 여기 없는 값을 화면에 직접 적으면(`fontSize: 19`) 그 화면 하나만 다른 글자를
 * 쓰게 되고, 나중에 크기를 손볼 때 그 하나가 남는다. 남은 하나는 고장으로 보이지
 * 않아서 아무도 안 고친다.
 *
 * `typography.test.ts`가 저장소를 훑어 이 표 밖의 크기를 막는다.
 */
export const FontSize = {
  /** 대표 숫자. SEED h3. */
  t1: 32,
  /** 화면 헤드라인. SEED h4. */
  t2: 26,
  /** 바텀시트 제목. spec/tokens.json heading 24/32. */
  t3: 24,
  /** 섹션 제목. SEED title2. */
  t4: 20,
  /** 목록 항목명, 강조 값. SEED title3. */
  t5: 18,
  /** 본문, 설명. 입력 칸의 글자도 본문이다. SEED subtitle1. */
  t6: 16,
  /** 캡션, 라벨, 출처. SEED subtitle2. */
  t7: 14,
  /** Npay 로고 — 원 안의 N 12 · «pay» 14. spec/tokens.json typography npay. 다른 곳에 쓰지 않는다. */
  npayN: 12,
  npayPay: 14,
  /** 탭 바. */
  tab: 12,
  /** 배지. */
  badge: 12,
  /** 금액 한 덩어리. */
  amount: 32,
  /** 코드·식별자. */
  code: 12,
} as const;

/**
 * 줄 높이. 크기마다 하나씩 짝지어 둔다. SEED 행간 비율(135%/150%)을 px로 옮겼다.
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
  t7: 19,
  micro: 18,
  /** Npay 로고 — N은 원 높이(20)와 같고 «pay»는 글자 높이와 같다. */
  npayN: 20,
  npayPay: 14,
  tab: 16,
  badge: 16,
  amount: 43,
  link: 19,
} as const;

export type FontSizeToken = keyof typeof FontSize;

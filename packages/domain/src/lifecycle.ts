import { daysUntil } from './profile';

/**
 * Wedding Lifecycle. 통합정책 v3.5 · v3.4.
 *
 * 기존 2단계(준비 중/예식 완료)를 감싼다. v3.5가 **서비스를 결혼 준비만 하는
 * 앱에 고정하지 말라고** 정했다 — 예식이 끝나면 앱이 할 말을 잃는 구조였다.
 *
 * 여전히 **저장하지 않고 계산한다.** 아무 일도 일어나지 않아도 시간이 지나면
 * 저절로 바뀌는 값이고, 저장하면 그 값을 바꿔줄 배치가 필요해진다. 그게 멈추면
 * 예식이 끝난 사람이 영영 준비 중으로 남는다.
 */

export const LIFECYCLE_STAGES = [
  'early',
  'preparing',
  'imminent',
  'wedding_day',
  'newlywed',
  'married_life',
  'beyond',
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

/** 내부에서 부르는 이름. 화면에는 아래 감정형 문구가 나간다. */
export const LIFECYCLE_STAGE_LABEL: Record<LifecycleStage, string> = {
  early: '결혼 준비 초기',
  preparing: '결혼 준비 중',
  imminent: '예식 임박',
  wedding_day: 'D-Day',
  newlywed: '신혼 초기',
  married_life: '신혼 생활',
  beyond: '이후',
};

/**
 * 남은 날짜별 감정형 상태 문구. v3.4.
 *
 * **`두근두근`으로 고정하지 않는다.** 300일 남은 사람에게 두근두근이라고 하면
 * 그 말은 아무 뜻도 없다 — 남은 기간에 따라 실제로 느끼는 것이 다르다.
 *
 * 경계값은 운영 자료를 보고 조정할 수 있다고 정책이 적었다. 지금 값은 **확정**
 * 이지만 바뀔 수 있는 종류의 확정이다.
 */
const MOOD_BANDS = [
  { minDays: 300, mood: '설렘설렘', stage: 'early' },
  { minDays: 210, mood: '하나씩 하나씩', stage: 'preparing' },
  { minDays: 120, mood: '차근차근', stage: 'preparing' },
  { minDays: 60, mood: '어느새 가까이', stage: 'imminent' },
  { minDays: 31, mood: '진짜 코앞', stage: 'imminent' },
  { minDays: 1, mood: '두근두근', stage: 'imminent' },
] as const satisfies readonly { minDays: number; mood: string; stage: LifecycleStage }[];

export const WEDDING_DAY_MOOD = '드디어 오늘';
export const WEDDING_DAY_NOTE = '우리의 결혼식이에요';

/** 예식 뒤. v3.5 §2가 예시로 적은 말들. */
export const NEWLYWED_MOOD = '우리, 결혼했어요';
export const MARRIED_LIFE_MOOD = '알콩달콩';
export const BEYOND_MOOD = '함께하는 중';

/**
 * 신혼 초기가 이어지는 기간.
 *
 * 이 뒤로는 후기·정산 권유를 앞세우지 않는다 — 두 달이 지나도 "후기를
 * 남겨주세요"가 첫 줄이면 그건 안내가 아니라 재촉이다.
 */
export const NEWLYWED_DAYS = 60;

/** 신혼 생활로 보는 기간. 그 뒤는 열어둔다. */
export const MARRIED_LIFE_DAYS = 365;

export type LifecycleView = {
  stage: LifecycleStage;
  /** 화면 Hero 위에 적는 짧은 상태 문구. */
  mood: string;
  /** 그 아래 한 줄. `312일 남았어요` 또는 예식 뒤의 말. */
  note: string;
  /** 예식일까지 남은 날. 지났으면 음수다. 예식일을 모르면 null. */
  daysLeft: number | null;
};

/**
 * 지금 어느 단계인가.
 *
 * **예식일만 본다.** v3.5 §3은 행동·준비 상태까지 함께 보라고 적었지만, 그건
 * 개인화된 상태를 만들어내라는 뜻이 아니다 — 같은 절이 "정보가 부족한 경우
 * 날짜 기반 기본 Stage를 사용하되 개인화된 상태를 임의로 만들어내지 않는다"고
 * 못박았다. 행동 신호를 섞는 것은 그 신호를 실제로 재기 시작한 뒤의 일이다.
 *
 * 예식일을 모르면 `early`다. 모르는 것을 끝났다고 하지 않는다.
 */
export function lifecycle(weddingDate: string | null, now: Date = new Date()): LifecycleView {
  if (weddingDate === null) {
    return { stage: 'early', mood: MOOD_BANDS[0].mood, note: '예식일을 등록해보세요', daysLeft: null };
  }

  const daysLeft = daysUntil(weddingDate, now);

  if (daysLeft === 0) {
    return { stage: 'wedding_day', mood: WEDDING_DAY_MOOD, note: WEDDING_DAY_NOTE, daysLeft };
  }

  if (daysLeft > 0) {
    /*
     * 마지막 칸의 minDays가 1이라 1일 이상이면 반드시 하나가 잡힌다. 그래도
     * 기본값을 두는 이유는 경계값이 조정될 수 있어서다 — 정책이 그렇게 적었다.
     */
    const band = MOOD_BANDS.find((row) => daysLeft >= row.minDays) ?? MOOD_BANDS[5];

    return { stage: band.stage, mood: band.mood, note: `${daysLeft}일 남았어요`, daysLeft };
  }

  /*
   * 예식 뒤. **D+ 일수를 메인으로 세우지 않는다**(v3.5 §4) — 지난 날을 세는
   * 카운터가 홈의 첫 줄로 오래 남으면 앱이 할 말을 잃었다는 뜻이다.
   */
  const passed = -daysLeft;

  if (passed <= NEWLYWED_DAYS) {
    return { stage: 'newlywed', mood: NEWLYWED_MOOD, note: '결혼을 축하해요', daysLeft };
  }

  if (passed <= MARRIED_LIFE_DAYS) {
    return { stage: 'married_life', mood: MARRIED_LIFE_MOOD, note: '신혼 생활 중이에요', daysLeft };
  }

  return { stage: 'beyond', mood: BEYOND_MOOD, note: '함께한 시간을 기록해요', daysLeft };
}

/** 예식 전인가. 준비 알림은 여기서만 나간다. */
export function isBeforeWedding(stage: LifecycleStage): boolean {
  return stage === 'early' || stage === 'preparing' || stage === 'imminent';
}

/**
 * 결혼 준비 콘텐츠를 앞세울 때인가. v3.5 §4.
 *
 * 예식 당일까지는 준비가 첫째다. 그 뒤로는 우선순위를 낮추되 **없애지는
 * 않는다** — 기록으로는 계속 볼 수 있어야 한다.
 */
export function showsPreparationFirst(stage: LifecycleStage): boolean {
  return isBeforeWedding(stage) || stage === 'wedding_day';
}

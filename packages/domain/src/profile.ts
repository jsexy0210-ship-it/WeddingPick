import { withSubject } from './korean';

/**
 * 부를 이름과 예식일.
 *
 * 디자인 핸드오프 2번 — **스킵할 수 없는 화면**이다. 뒤로가기도 건너뛰기도 없다.
 * 이 둘이 없으면 홈의 D-Day도, 웨딩 스케줄의 상태 판정도 만들 수 없다.
 */

/**
 * 이름 길이 상한. 핸드오프가 정한 값이다.
 *
 * 5자는 본명을 받기에는 짧고 부르는 이름으로는 넉넉하다. **그게 의도다** —
 * 우리가 원하는 것은 "지선님"이라고 부를 말이지 신원이 아니다.
 */
export const MAX_DISPLAY_NAME_LENGTH = 5;

export const DISPLAY_NAME_HINT = '최대 5자까지 입력할 수 있어요';

/** 한글 자모만 있는 글자인지. 'ㅈㅅ'이나 'ㅏㅓ'처럼. */
const JAMO_ONLY = /^[ㄱ-ㆎ\s]+$/;

export type NameCheck = { ok: true } | { ok: false; reason: string };

export function checkDisplayName(raw: string): NameCheck {
  const name = raw.trim();

  if (name.length === 0) {
    return { ok: false, reason: '이름을 적어주세요.' };
  }

  if (name.length > MAX_DISPLAY_NAME_LENGTH) {
    return { ok: false, reason: DISPLAY_NAME_HINT };
  }

  /*
   * 핸드오프가 이 규칙을 따로 적었다. 'ㅈㅅ'으로 등록하면 홈이 "ㅈㅅ님,"이라고
   * 부르게 되고, 그건 부르는 것이 아니다.
   */
  if (JAMO_ONLY.test(name)) {
    return { ok: false, reason: '초성이나 모음만으로는 등록할 수 없어요' };
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* 예식일                                                                      */
/* -------------------------------------------------------------------------- */

/** 하루의 시작으로 맞춘다. 시각이 섞이면 같은 날이 하루 차이로 세어진다. */
function atMidnight(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(weddingDate: string, now: Date = new Date()): number {
  const [year, month, day] = weddingDate.split('-').map(Number);
  const target = new Date(year!, month! - 1, day!);

  return Math.round((atMidnight(target) - atMidnight(now)) / DAY_MS);
}

/**
 * 오늘과 과거는 고를 수 없다. 핸드오프 3번.
 *
 * **결혼식은 미래이기 때문이다.** 오늘을 열어두면 오늘 결혼하는 사람이 앱을 켜서
 * 준비 일정을 짜는 상황을 가정하는 셈인데, 그런 일은 없다.
 */
export function isSelectableWeddingDate(date: string, now: Date = new Date()): boolean {
  return daysUntil(date, now) > 0;
}

export const WEDDING_DATE_HINT = '오늘 이후 날짜만 고를 수 있어요';

export type DDay =
  | { kind: 'upcoming'; days: number; text: string }
  | { kind: 'today'; text: string }
  | { kind: 'past'; days: number; text: string };

/**
 * 홈과 캘린더가 함께 쓰는 문구.
 *
 * 핸드오프는 앞으로 남은 경우만 문구를 정했다(`예식까지 231일 남았어요`). 지난
 * 경우는 **우리가 만든 말이다** — 고를 수는 없지만 시간이 지나면 반드시 생기는
 * 상태라 비워둘 수 없다.
 */
export function dDay(weddingDate: string, now: Date = new Date()): DDay {
  const days = daysUntil(weddingDate, now);

  if (days > 0) {
    return { kind: 'upcoming', days, text: `예식까지 ${withSubject(`${days}일`)} 남았어요` };
  }

  if (days === 0) {
    return { kind: 'today', text: '오늘이 예식일이에요' };
  }

  return { kind: 'past', days: -days, text: `예식일이 ${-days}일 지났어요` };
}

/** 홈 첫 줄. 이름이 없으면 부르지 않는다. */
export function greeting(name: string | null): string {
  return name === null ? '웨딩픽에 오신 것을 환영해요' : `${name}님,`;
}

/** "2027. 4. 17" — 핸드오프가 쓴 표기. */
export function formatWeddingDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);

  return `${year}. ${month}. ${day}`;
}

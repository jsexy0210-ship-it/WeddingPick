import type { RegionWeather } from '@weddingpick/api-contract';

/**
 * 날씨 반응형 홈 히어로 — 팔레트와 낮 · 밤 판정(2026-09-26 대표 명세 「날씨 반응형 홈 히어로」).
 *
 * 정본(`docs/design/React_Native/home.js` `hero`)에는 날씨가 없다 — 코랄 면(`hP`) 하나다.
 * 날씨 값이 있을 때만 아래 팔레트로 바꾸고, 없거나 조회에 실패하면 정본 코랄 히어로를 그대로 둔다.
 *
 * 배경 · 글자색은 대표님 명세 표 그대로다. **작은 글자색(`sub`)만 이 파일이 정했다** — 명세가
 * 「작은 글자의 명암비는 최소 4.5:1」을 요구해서, 두 끝 색 모두에 4.5:1을 넘는 단색을 골랐다
 * (`hero-weather.test.ts`가 잰다). 판단 필요(DESIGN_UNRESOLVED)로 보고한다.
 */

export type HeroWeatherTone = 'clearDay' | 'clearNight' | 'cloudy' | 'rain' | 'snow';

export type HeroWeatherPalette = {
  /** 그라데이션 위(시작) · 아래(끝). */
  from: string;
  to: string;
  /** D-day · 기온 같은 큰 글자. */
  text: string;
  /** 예식일 · 지역 · 연결 현황 · 문구 같은 작은 글자. 두 끝 색 모두에 4.5:1 이상. */
  sub: string;
  /** 「…」 단추 면. */
  chip: string;
  /** 모션(빗방울 · 햇빛) 색. */
  motion: string;
};

export const HERO_WEATHER_PALETTE: Record<HeroWeatherTone, HeroWeatherPalette> = {
  clearDay: { from: '#FFF3DD', to: '#FFE3CF', text: '#212124', sub: '#55555D', chip: 'rgba(33,33,36,0.06)', motion: 'rgba(255,190,110,0.55)' },
  clearNight: { from: '#243450', to: '#18263E', text: '#FFFFFF', sub: '#C9D3E3', chip: 'rgba(255,255,255,0.15)', motion: 'rgba(255,255,255,0.10)' },
  cloudy: { from: '#E8EDF1', to: '#D9E1E7', text: '#212124', sub: '#4A4F57', chip: 'rgba(33,33,36,0.06)', motion: 'rgba(255,255,255,0.35)' },
  rain: { from: '#344F63', to: '#253E50', text: '#FFFFFF', sub: '#D3DEE6', chip: 'rgba(255,255,255,0.15)', motion: 'rgba(255,255,255,0.32)' },
  snow: { from: '#F5F9FC', to: '#E4EEF4', text: '#212124', sub: '#4E5763', chip: 'rgba(33,33,36,0.06)', motion: 'rgba(255,255,255,0.8)' },
};

/**
 * 서울 기준 해 뜨는 시 · 지는 시(시 단위, 한국 시각). `[rise, set]` — rise시 00분부터 set시
 * 00분 전까지가 낮이다. 한 시간 단위로 내려 적은 값이라 해 질 녘 한 시간 안쪽은 어긋날 수 있다.
 */
const DAYLIGHT_HOURS: readonly (readonly [number, number])[] = [
  [8, 18], [7, 18], [7, 19], [6, 19], [6, 20], [5, 20],
  [6, 20], [6, 19], [6, 19], [7, 18], [7, 17], [8, 17],
];

/** 관측 시각(한국 시각)의 월 · 시. */
export function kstHour(iso: string): { month: number; hour: number } | null {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  const kst = new Date(time + 9 * 3_600_000);
  return { month: kst.getUTCMonth(), hour: kst.getUTCHours() };
}

/** 낮인가 — 관측 시각 기준이다. 화면이 말하는 「14시 기준」과 같은 시각으로 판정한다. */
export function isDaytime(iso: string): boolean {
  const at = kstHour(iso);
  if (at === null) return true;
  const [rise, set] = DAYLIGHT_HOURS[at.month]!;
  return at.hour >= rise && at.hour < set;
}

/** 날씨 → 히어로 색 단계. 구름많음은 흐림 팔레트를 쓴다(명세 표가 넷뿐이라 — 판단 필요). */
export function heroWeatherTone(weather: RegionWeather | null): HeroWeatherTone | null {
  if (weather === null) return null;
  switch (weather.condition) {
    case 'clear':
      return isDaytime(weather.observedAt) ? 'clearDay' : 'clearNight';
    case 'partly_cloudy':
    case 'cloudy':
      return 'cloudy';
    case 'rain':
      return 'rain';
    case 'snow':
      return 'snow';
  }
}

/** 관측 시 「14」 — 화면 「14시 기준」. */
export function observedHourLabel(iso: string): string | null {
  const at = kstHour(iso);
  return at === null ? null : String(at.hour);
}

/* ---- 명암비(WCAG 2.2) — 시험과 보고에 쓴다 ---- */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`단색 #RRGGBB만 잰다: ${hex}`);
  const n = parseInt(match[1]!, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

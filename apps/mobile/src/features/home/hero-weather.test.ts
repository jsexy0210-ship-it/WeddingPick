import {
  HERO_WEATHER_PALETTE,
  contrastRatio,
  heroWeatherTone,
  isDaytime,
  observedHourLabel,
} from './hero-weather';

describe('날씨 반응형 히어로 팔레트', () => {
  it('배경 · 큰 글자색은 대표님 명세 표 그대로다', () => {
    expect(HERO_WEATHER_PALETTE.clearDay).toMatchObject({ from: '#FFF3DD', to: '#FFE3CF', text: '#212124' });
    expect(HERO_WEATHER_PALETTE.clearNight).toMatchObject({ from: '#243450', to: '#18263E', text: '#FFFFFF' });
    expect(HERO_WEATHER_PALETTE.cloudy).toMatchObject({ from: '#E8EDF1', to: '#D9E1E7', text: '#212124' });
    expect(HERO_WEATHER_PALETTE.rain).toMatchObject({ from: '#344F63', to: '#253E50', text: '#FFFFFF' });
    expect(HERO_WEATHER_PALETTE.snow).toMatchObject({ from: '#F5F9FC', to: '#E4EEF4', text: '#212124' });
  });

  it.each(Object.entries(HERO_WEATHER_PALETTE))('%s — 큰 글자 · 작은 글자 모두 두 끝 색에 4.5:1 이상', (_tone, palette) => {
    for (const background of [palette.from, palette.to]) {
      expect(contrastRatio(palette.text, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.sub, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('맑음은 관측 시각으로 낮 · 밤을 가른다', () => {
    const clear = (observedAt: string) => heroWeatherTone({ region: '서울', temperature: 20, condition: 'clear', observedAt });
    // 14:00 KST
    expect(clear('2026-09-26T05:00:00.000Z')).toBe('clearDay');
    // 21:00 KST
    expect(clear('2026-09-26T12:00:00.000Z')).toBe('clearNight');
    // 05:00 KST(9월 해 뜨기 전)
    expect(isDaytime('2026-09-25T20:00:00.000Z')).toBe(false);
  });

  it('비 · 눈 · 흐림 · 구름많음 · 값 없음', () => {
    const tone = (condition: 'rain' | 'snow' | 'cloudy' | 'partly_cloudy') =>
      heroWeatherTone({ region: '부산', temperature: 12, condition, observedAt: '2026-09-26T05:00:00.000Z' });
    expect(tone('rain')).toBe('rain');
    expect(tone('snow')).toBe('snow');
    expect(tone('cloudy')).toBe('cloudy');
    expect(tone('partly_cloudy')).toBe('cloudy');
    expect(heroWeatherTone(null)).toBeNull();
  });

  it('화면의 「14시 기준」은 관측 시각의 한국 시다', () => {
    expect(observedHourLabel('2026-09-26T05:00:00.000Z')).toBe('14');
    expect(observedHourLabel('2026-09-26T15:00:00.000Z')).toBe('0');
    expect(observedHourLabel('nope')).toBeNull();
  });
});

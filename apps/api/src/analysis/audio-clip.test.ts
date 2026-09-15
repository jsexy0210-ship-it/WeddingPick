import { AUDIO_TOKENS_PER_SECOND } from '@weddingpick/domain';

import {
  CLIP_HEAD_SECONDS,
  CLIP_SKIP_UNDER_SECONDS,
  CLIP_TAIL_SECONDS,
  clipBilledSeconds,
  clipPlan,
} from './audio-clip';

/**
 * 자르는 계획만 본다. **ffmpeg를 부르지 않는다** — 값을 정하는 것은 이 함수고,
 * 실제로 자르는 일은 그 계획을 따를 뿐이다.
 */
describe('1차 판정 조각', () => {
  it('짧은 녹음은 자르지 않는다', () => {
    // 앞 180 + 뒤 120이 이미 전체다. 잘라도 같은 값을 두 번 세게 될 뿐이다.
    expect(clipPlan(60).kind).toBe('whole');
    expect(clipPlan(CLIP_SKIP_UNDER_SECONDS).kind).toBe('whole');
  });

  it('긴 녹음은 앞뒤만 가져온다', () => {
    const plan = clipPlan(3600);

    expect(plan.kind).toBe('headTail');
    expect(clipBilledSeconds(plan)).toBe(CLIP_HEAD_SECONDS + CLIP_TAIL_SECONDS);
  });

  it('뒤쪽을 버리지 않는다', () => {
    /*
     * 앞만 자르면 상담 중반에 처음 금액이 나오는 녹음을 「가격 얘기 없음」으로
     * 읽는다. 실제 상담은 인사 → 설명 → 금액 → 정리 순이고 금액과 조건은 뒤에 몰린다.
     */
    expect(CLIP_TAIL_SECONDS).toBeGreaterThan(0);
  });

  it('자른 것이 원본보다 길어지지 않는다', () => {
    for (const seconds of [1, 60, 299, 300, 301, 7200]) {
      expect(clipBilledSeconds(clipPlan(seconds))).toBeLessThanOrEqual(seconds);
    }
  });

  it('한 시간짜리 1차 판정이 백분의 일로 줄어든다', () => {
    /*
     * **이 비율이 2단계를 하는 유일한 이유다.** 여기가 1에 가까워지면 두 번 부르는
     * 것이 그냥 두 배다 — 그때는 설계를 되돌려야 한다.
     */
    const hour = 3600;
    const clipped = clipBilledSeconds(clipPlan(hour)) * AUDIO_TOKENS_PER_SECOND;
    const whole = hour * AUDIO_TOKENS_PER_SECOND;

    expect(clipped / whole).toBeLessThan(0.1);
  });
});

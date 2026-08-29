import {
  COMPLETED_ACTIONS,
  WEDDING_PHASE_LABEL,
  shouldSendPreparationNudges,
  weddingPhase,
} from './wedding-phase';

const NOW = new Date('2026-08-29T09:00:00+09:00');

describe('예식 단계', () => {
  it('예식일 전에는 준비 중이다', () => {
    expect(weddingPhase('2027-04-17', NOW)).toBe('preparing');
  });

  it('예식 당일은 아직 준비 중이다', () => {
    /*
     * 그날 아침에 앱을 열면 오늘이 예식일이라고 말해야지, 끝났다고 말하면 안 된다.
     */
    expect(weddingPhase('2026-08-29', NOW)).toBe('preparing');
  });

  it('예식일이 지나면 완료다', () => {
    expect(weddingPhase('2026-08-28', NOW)).toBe('completed');
  });

  it('예식일을 모르면 준비 중이다', () => {
    // 모르는 것을 끝났다고 하지 않는다.
    expect(weddingPhase(null, NOW)).toBe('preparing');
  });

  it('시간만 지나도 값이 바뀐다', () => {
    /*
     * 저장하지 않고 계산하는 이유가 이것이다. 아무 일도 일어나지 않아도 값이
     * 바뀌므로, 저장하면 그 값을 바꿔줄 사람이나 배치가 필요해지고, 그게 멈추면
     * 예식이 끝난 사람이 영영 준비 중으로 남는다.
     *
     * 자정을 걸치는 시각으로 쓰지 않는다 — 경계는 **기기의 자정**이라 테스트를
     * 돌리는 곳의 시간대에 따라 답이 달라진다. 그건 이 테스트가 볼 것이 아니다.
     */
    const date = '2026-08-29';
    const noon = (day: string) => new Date(`${day}T12:00:00`);

    expect(weddingPhase(date, noon('2026-08-29'))).toBe('preparing');
    expect(weddingPhase(date, noon('2026-08-30'))).toBe('completed');
  });
});

describe('예식 완료 뒤', () => {
  it('준비 단계 알림을 멈춘다', () => {
    // "드레스 투어를 예약해보세요"는 안내가 아니라 실례가 된다.
    expect(shouldSendPreparationNudges('preparing')).toBe(true);
    expect(shouldSendPreparationNudges('completed')).toBe(false);
  });

  it('권할 것이 셋 있다', () => {
    // 막는 목록이 아니라 권하는 목록이다. 계정은 제한하지 않는다.
    expect(COMPLETED_ACTIONS).toHaveLength(3);
    expect(COMPLETED_ACTIONS.every((action) => action.title.length > 0)).toBe(true);
  });

  it('두 단계에 이름이 있다', () => {
    expect(WEDDING_PHASE_LABEL.preparing).toBe('결혼 준비 중');
    expect(WEDDING_PHASE_LABEL.completed).toBe('예식 완료');
  });
});

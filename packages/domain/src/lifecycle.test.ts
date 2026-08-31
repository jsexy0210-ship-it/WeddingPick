import {
  LIFECYCLE_STAGES,
  MARRIED_LIFE_DAYS,
  NEWLYWED_DAYS,
  WEDDING_DAY_MOOD,
  isBeforeWedding,
  lifecycle,
  showsPreparationFirst,
} from './lifecycle';

/** 오늘 정오. 자정을 넘나드는 계산에 걸리지 않게 한다. */
const NOW = new Date(2026, 5, 1, 12, 0, 0);

/** NOW로부터 며칠 뒤의 날짜 문자열. */
function inDays(days: number): string {
  const date = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');

  return `${date.getFullYear()}-${month}-${`${date.getDate()}`.padStart(2, '0')}`;
}

describe('Wedding Lifecycle', () => {
  describe('감정형 상태 문구', () => {
    it('두근두근으로 고정하지 않는다', () => {
      /*
       * 300일 남은 사람에게 두근두근이라고 하면 그 말은 아무 뜻도 없다. 남은
       * 기간에 따라 실제로 느끼는 것이 다르다.
       */
      const moods = [400, 250, 150, 90, 45, 10].map((days) => lifecycle(inDays(days), NOW).mood);

      expect(moods).toEqual([
        '설렘설렘',
        '하나씩 하나씩',
        '차근차근',
        '어느새 가까이',
        '진짜 코앞',
        '두근두근',
      ]);
    });

    it('경계값이 정책 그대로다', () => {
      expect(lifecycle(inDays(300), NOW).mood).toBe('설렘설렘');
      expect(lifecycle(inDays(299), NOW).mood).toBe('하나씩 하나씩');
      expect(lifecycle(inDays(210), NOW).mood).toBe('하나씩 하나씩');
      expect(lifecycle(inDays(209), NOW).mood).toBe('차근차근');
      expect(lifecycle(inDays(60), NOW).mood).toBe('어느새 가까이');
      expect(lifecycle(inDays(59), NOW).mood).toBe('진짜 코앞');
      expect(lifecycle(inDays(31), NOW).mood).toBe('진짜 코앞');
      expect(lifecycle(inDays(30), NOW).mood).toBe('두근두근');
    });

    it('남은 날짜를 한 줄로 적는다', () => {
      expect(lifecycle(inDays(312), NOW).note).toBe('312일 남았어요');
    });
  });

  describe('예식 당일', () => {
    it('그날은 드디어 오늘이다', () => {
      const today = lifecycle(inDays(0), NOW);

      expect(today.stage).toBe('wedding_day');
      expect(today.mood).toBe(WEDDING_DAY_MOOD);
      expect(today.note).toBe('우리의 결혼식이에요');
    });

    it('당일은 아직 끝난 것이 아니다', () => {
      // 그날 아침에 앱을 열면 오늘이 예식일이라고 말해야지, 끝났다고 하면 안 된다.
      expect(showsPreparationFirst(lifecycle(inDays(0), NOW).stage)).toBe(true);
    });
  });

  describe('예식 뒤', () => {
    it('앱이 할 말을 잃지 않는다', () => {
      /*
       * v3.5 §4: 예식일이 지났다는 이유로 홈 Hero를 제거하지 않는다. 어느
       * 단계에도 상태 문구와 한 줄이 있다.
       */
      for (const days of [-1, -30, -100, -400, -3000]) {
        const view = lifecycle(inDays(days), NOW);

        expect(view.mood.length).toBeGreaterThan(0);
        expect(view.note.length).toBeGreaterThan(0);
      }
    });

    it('신혼 초기를 지나면 다른 단계로 넘어간다', () => {
      expect(lifecycle(inDays(-NEWLYWED_DAYS), NOW).stage).toBe('newlywed');
      expect(lifecycle(inDays(-(NEWLYWED_DAYS + 1)), NOW).stage).toBe('married_life');
      expect(lifecycle(inDays(-(MARRIED_LIFE_DAYS + 1)), NOW).stage).toBe('beyond');
    });

    it('지난 날을 세는 카운터를 첫 줄로 두지 않는다', () => {
      /*
       * D+ 일수가 홈의 첫 줄로 오래 남으면 앱이 할 말을 잃었다는 뜻이다.
       * 상태 문구에도 한 줄에도 경과일 숫자가 없다.
       */
      const view = lifecycle(inDays(-100), NOW);

      expect(view.mood).not.toMatch(/\d/);
      expect(view.note).not.toMatch(/\d/);
    });

    it('준비 콘텐츠를 앞세우지 않는다', () => {
      expect(showsPreparationFirst(lifecycle(inDays(-1), NOW).stage)).toBe(false);
      expect(isBeforeWedding(lifecycle(inDays(-1), NOW).stage)).toBe(false);
    });
  });

  describe('예식일을 모를 때', () => {
    it('끝났다고 하지 않는다', () => {
      const view = lifecycle(null, NOW);

      expect(view.stage).toBe('early');
      expect(view.daysLeft).toBeNull();
      expect(isBeforeWedding(view.stage)).toBe(true);
    });

    it('지어낸 날짜를 말하지 않는다', () => {
      expect(lifecycle(null, NOW).note).not.toMatch(/\d/);
    });
  });

  it('일곱 단계가 모두 쓰인다', () => {
    const seen = new Set(
      [null, 400, 250, 90, 0, -10, -100, -400, -3000].map((days) =>
        lifecycle(days === null ? null : inDays(days), NOW).stage
      )
    );

    for (const stage of LIFECYCLE_STAGES) {
      expect(seen.has(stage)).toBe(true);
    }
  });
});

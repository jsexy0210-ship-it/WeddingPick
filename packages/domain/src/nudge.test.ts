import {
  MEANINGFUL_SHIFT,
  NUDGE_OFFSETS,
  isMeaningfulPriceChange,
  nudgeFor,
  priceChangeNudge,
} from './nudge';

const NOW = new Date('2026-08-29T09:00:00');

const task = (over: Partial<Parameters<typeof nudgeFor>[0]> = {}) => ({
  id: 't1',
  label: '드레스 투어',
  dueDate: '2026-09-05',
  state: 'upcoming',
  ...over,
});

describe('일정 알림', () => {
  it('7일 전 · 1일 전 · 당일에만 보낸다', () => {
    /*
     * "7일 이하"로 두면 7·6·5·4·3·2·1일에 매일 가고, 그건 세 번 알리기로 한
     * 것과 다르다.
     */
    expect(nudgeFor(task({ dueDate: '2026-09-05' }), NOW)?.offset).toBe(7);
    expect(nudgeFor(task({ dueDate: '2026-08-30' }), NOW)?.offset).toBe(1);
    expect(nudgeFor(task({ dueDate: '2026-08-29' }), NOW)?.offset).toBe(0);

    expect(nudgeFor(task({ dueDate: '2026-09-04' }), NOW)).toBeNull();
    expect(nudgeFor(task({ dueDate: '2026-08-31' }), NOW)).toBeNull();
  });

  it('지난 일정에는 보내지 않는다', () => {
    // 이미 지난 것을 알려주는 알림은 알림이 아니라 잔소리다.
    expect(nudgeFor(task({ dueDate: '2026-08-28' }), NOW)).toBeNull();
  });

  it('끝낸 일에는 보내지 않는다', () => {
    // 다 했다고 표시한 것을 두고 알리면, 그 표시를 우리가 안 본다는 뜻이 된다.
    expect(nudgeFor(task({ dueDate: '2026-08-29', state: 'done' }), NOW)).toBeNull();
  });

  it('날짜가 없으면 보낼 것도 없다', () => {
    expect(nudgeFor(task({ dueDate: null }), NOW)).toBeNull();
  });

  it('같은 일정·같은 시점에는 같은 열쇠가 나온다', () => {
    const key = nudgeFor(task(), NOW)?.dedupeKey;

    expect(key).toBe('task_due:t1:7');
    expect(nudgeFor(task(), new Date('2026-08-29T23:00:00'))?.dedupeKey).toBe(key);
  });

  it('시점마다 열쇠가 다르다', () => {
    // 같은 일정이라도 7일 전과 당일은 다른 알림이다.
    const seven = nudgeFor(task({ dueDate: '2026-09-05' }), NOW)?.dedupeKey;
    const today = nudgeFor(task({ dueDate: '2026-08-29' }), NOW)?.dedupeKey;

    expect(seven).not.toBe(today);
  });

  it('세 시점이 정책이 정한 값이다', () => {
    expect([...NUDGE_OFFSETS]).toEqual([7, 1, 0]);
  });

  it('말이 시점에 맞는다', () => {
    expect(nudgeFor(task({ dueDate: '2026-08-29' }), NOW)?.title).toContain('오늘');
    expect(nudgeFor(task({ dueDate: '2026-08-30' }), NOW)?.title).toContain('내일');
    expect(nudgeFor(task({ dueDate: '2026-09-05' }), NOW)?.title).toContain('7일');
  });
});

describe('가격 변동 알림', () => {
  const collecting = { stage: 'collecting', low: null, high: null };
  const range = (low: number, high: number) => ({ stage: 'normal', low, high });

  it('수집 중이던 업체에 구간이 생기면 알린다', () => {
    // 못 보던 것을 보게 된 것이라 그 자체가 소식이다.
    expect(isMeaningfulPriceChange(collecting, range(2_600_000, 3_000_000))).toBe(true);
  });

  it('구간이 사라지는 것은 알리지 않는다', () => {
    /*
     * 12개월 창 밖으로 밀려나는 일이다. 사용자가 할 수 있는 일이 없고,
     * "가격을 볼 수 없게 됐어요"는 나쁜 소식이기만 하다.
     */
    expect(isMeaningfulPriceChange(range(2_600_000, 3_000_000), collecting)).toBe(false);
  });

  it('신규 인증 한 건 정도의 흔들림에는 보내지 않는다', () => {
    // v2.0 37번이 못박은 것이다.
    expect(isMeaningfulPriceChange(range(2_600_000, 3_000_000), range(2_610_000, 3_010_000))).toBe(
      false
    );
  });

  it('허리가 기준만큼 움직이면 보낸다', () => {
    const before = range(2_000_000, 4_000_000);
    const middle = 3_000_000;
    const shifted = middle * (1 + MEANINGFUL_SHIFT);

    expect(isMeaningfulPriceChange(before, range(shifted - 1_000_000, shifted + 1_000_000))).toBe(
      true
    );
  });

  it('내려가도 보낸다', () => {
    // 오른 것만 알리면 그건 알림이 아니라 광고다.
    expect(isMeaningfulPriceChange(range(3_000_000, 3_000_000), range(2_500_000, 2_500_000))).toBe(
      true
    );
  });

  it('같은 업체에 하루 한 번만 갈 열쇠를 만든다', () => {
    const key = (today: string) =>
      priceChangeNudge({
        vendorId: 'v1',
        vendorName: '가온예식홀',
        caption: '결제인증 8건 · 최근 12개월',
        today,
        appeared: false,
      }).dedupeKey;

    expect(key('2026-08-29')).toBe(key('2026-08-29'));
    expect(key('2026-08-29')).not.toBe(key('2026-08-30'));
  });

  it('처음 보이게 됐을 때와 바뀌었을 때 말이 다르다', () => {
    const make = (appeared: boolean) =>
      priceChangeNudge({
        vendorId: 'v1',
        vendorName: '가온예식홀',
        caption: '결제인증 3건 · 아직 정보가 적어요',
        today: '2026-08-29',
        appeared,
      }).title;

    expect(make(true)).toContain('볼 수 있어요');
    expect(make(false)).toContain('바뀌었어요');
  });
});

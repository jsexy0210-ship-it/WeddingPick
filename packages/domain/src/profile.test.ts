import {
  DISPLAY_NAME_HINT,
  MAX_DISPLAY_NAME_LENGTH,
  WEDDING_DATE_HINT,
  checkDisplayName,
  dDay,
  daysUntil,
  formatDateDot,
  formatWeddingDate,
  greeting,
  isSelectableWeddingDate,
} from './profile';

const NOW = new Date('2026-08-29T09:00:00+09:00');

describe('부를 이름', () => {
  it('받는다', () => {
    expect(checkDisplayName('지선')).toEqual({ ok: true });
    expect(checkDisplayName('  지선  ')).toEqual({ ok: true });
  });

  it('다섯 자를 넘기면 막는다', () => {
    expect(checkDisplayName('일이삼사오')).toEqual({ ok: true });
    expect(checkDisplayName('일이삼사오육').ok).toBe(false);
  });

  it('초성이나 모음만으로는 등록할 수 없다', () => {
    /*
     * 'ㅈㅅ'으로 등록하면 홈이 "ㅈㅅ님,"이라고 부르게 되고, 그건 부르는 것이 아니다.
     */
    const jamo = checkDisplayName('ㅈㅅ');

    expect(jamo.ok).toBe(false);
    expect(jamo.ok === false && jamo.reason).toBe('초성이나 모음만으로는 등록할 수 없어요');
    expect(checkDisplayName('ㅏㅓ').ok).toBe(false);
  });

  it('자모가 섞인 이름은 받는다', () => {
    // 'ㅋ지선'을 막을 이유는 없다. 자모만인 것을 막는 규칙이다.
    expect(checkDisplayName('ㅋ지선')).toEqual({ ok: true });
  });

  it('빈 이름은 막는다', () => {
    expect(checkDisplayName('   ').ok).toBe(false);
  });

  it('안내 문구가 상한과 맞는다', () => {
    // 문구와 값이 갈라지면 "5자까지"라고 적어두고 3자에서 막는 일이 생긴다.
    expect(DISPLAY_NAME_HINT).toContain(String(MAX_DISPLAY_NAME_LENGTH));
  });
});

describe('예식일', () => {
  it('남은 날을 센다', () => {
    expect(daysUntil('2026-08-30', NOW)).toBe(1);
    expect(daysUntil('2027-04-17', NOW)).toBe(231);
  });

  it('시각이 섞여도 같은 날은 0이다', () => {
    // 하루의 시작으로 맞추지 않으면 같은 날이 하루 차이로 세어진다.
    expect(daysUntil('2026-08-29', new Date('2026-08-29T23:59:00+09:00'))).toBe(0);
  });

  it('오늘과 과거는 고를 수 없다', () => {
    // 결혼식은 미래다.
    expect(isSelectableWeddingDate('2026-08-30', NOW)).toBe(true);
    expect(isSelectableWeddingDate('2026-08-29', NOW)).toBe(false);
    expect(isSelectableWeddingDate('2026-08-28', NOW)).toBe(false);
  });

  it('안내 문구가 규칙과 맞는다', () => {
    expect(WEDDING_DATE_HINT).toContain('오늘 이후');
  });

  it('D-Day 문구를 만든다', () => {
    expect(dDay('2027-04-17', NOW)).toEqual({
      kind: 'upcoming',
      days: 231,
      text: '예식까지 231일이 남았어요',
    });
  });

  it('오늘과 지난 날도 말할 줄 안다', () => {
    // 고를 수는 없지만 시간이 지나면 반드시 생기는 상태다. 비워둘 수 없다.
    expect(dDay('2026-08-29', NOW).kind).toBe('today');
    expect(dDay('2026-08-27', NOW)).toEqual({
      kind: 'past',
      days: 2,
      text: '예식일이 2일 지났어요',
    });
  });

  it('핸드오프가 쓴 날짜 표기를 쓴다', () => {
    expect(formatWeddingDate('2027-04-17')).toBe('2027.04.17(토)');
    expect(formatDateDot('2027-05-16')).toBe('2027.05.16(일)');
    expect(formatDateDot('2026-09-08')).toBe('2026.09.08(화)');
  });
});

describe('부르는 말', () => {
  it('이름이 있으면 부른다', () => {
    expect(greeting('지선')).toBe('지선님,');
  });

  it('이름이 없으면 부르지 않는다', () => {
    // 없는 이름을 지어내 부르지 않는다.
    expect(greeting(null)).toBe('웨딩픽에 오신 것을 환영해요');
  });
});

import {
  MIN_REBUTTAL_BODY_LENGTH,
  REBUTTAL_STATUSES,
  REBUTTAL_STATUS_LABEL,
  REBUTTAL_STATUS_NOTE,
  checkRebuttal,
  isEditable,
} from './rebuttal';

const BODY = '해당 날짜에는 주차 안내 인원을 두 명 더 배치했습니다. 확인해보겠습니다.';

describe('반론 확인', () => {
  it('소속과 내용이 있으면 받는다', () => {
    expect(checkRebuttal({ claimedRole: '가온예식홀 예약팀장', body: BODY })).toEqual({ ok: true });
  });

  it('소속을 밝히지 않으면 막는다', () => {
    // 누가 하는 말인지 모르는 반론은 또 하나의 익명 글일 뿐이다.
    const result = checkRebuttal({ claimedRole: '   ', body: BODY });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('관계');
  });

  it('한 줄짜리 반박은 막는다', () => {
    const result = checkRebuttal({ claimedRole: '가온예식홀 예약팀장', body: '사실이 아닙니다' });

    expect(result.ok).toBe(false);
  });

  it('경계에서 갈린다', () => {
    const role = '가온예식홀 예약팀장';

    expect(checkRebuttal({ claimedRole: role, body: '가'.repeat(MIN_REBUTTAL_BODY_LENGTH) })).toEqual({
      ok: true,
    });
    expect(
      checkRebuttal({ claimedRole: role, body: '가'.repeat(MIN_REBUTTAL_BODY_LENGTH - 1) }).ok
    ).toBe(false);
  });

  it('앞뒤 공백은 길이에 세지 않는다', () => {
    const result = checkRebuttal({
      claimedRole: '가온예식홀 예약팀장',
      body: `   ${'가'.repeat(MIN_REBUTTAL_BODY_LENGTH - 1)}   `,
    });

    expect(result.ok).toBe(false);
  });
});

describe('반론 상태', () => {
  it('확인 중일 때만 고칠 수 있다', () => {
    /*
     * 게시된 글을 고칠 수 있게 두면, 확인받은 글과 실제로 붙어 있는 글이 달라진다.
     */
    expect(isEditable('pending')).toBe(true);
    expect(isEditable('published')).toBe(false);
    expect(isEditable('rejected')).toBe(false);
  });

  it('모든 상태에 이름과 설명이 있다', () => {
    for (const status of REBUTTAL_STATUSES) {
      expect(REBUTTAL_STATUS_LABEL[status].length).toBeGreaterThan(0);
      expect(REBUTTAL_STATUS_NOTE[status].length).toBeGreaterThan(0);
    }
  });
});

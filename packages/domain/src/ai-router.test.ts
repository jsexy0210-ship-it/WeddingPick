import { CALL_BLOCKED_NOTICE, blockedReason, dailyCallState } from './ai-router';
import { findBannedPhrases, findVaguePhrases } from './copy-rules';

describe('AI 호출 관문', () => {
  it('한도를 정한 적이 없으면 막지 않는다', () => {
    // 정해지기 전에는 숫자를 지어내지 않는다. 예산과 같은 규칙이다.
    expect(dailyCallState({ used: 999 })).toEqual({ kind: 'unlimited' });
    expect(dailyCallState({ used: 999, limit: null })).toEqual({ kind: 'unlimited' });
  });

  it('한도 0은 한도 없음과 다르다', () => {
    // 0은 "한 번도 부르지 못하게 한다"는 결정이고, 누군가 그렇게 정했을 때만 나온다.
    expect(dailyCallState({ used: 0, limit: 0 })).toEqual({ kind: 'exceeded', used: 0, limit: 0 });
  });

  it('남은 횟수를 센다', () => {
    expect(dailyCallState({ used: 3, limit: 10 })).toEqual({
      kind: 'within',
      used: 3,
      limit: 10,
      remaining: 7,
    });
  });

  it('한도에 닿으면 넘긴 것으로 본다', () => {
    expect(dailyCallState({ used: 10, limit: 10 }).kind).toBe('exceeded');
  });

  it('막은 이유를 뭉뚱그리지 않는다', () => {
    /*
     * 예산이 바닥난 것과 그 사람이 오늘 많이 부른 것은 다른 일이고, 운영이 해야
     * 할 일도 다르다.
     */
    expect(
      blockedReason({ budgetExceeded: true, daily: dailyCallState({ used: 0, limit: 10 }) })
    ).toBe('budget');

    expect(
      blockedReason({ budgetExceeded: false, daily: dailyCallState({ used: 10, limit: 10 }) })
    ).toBe('daily_limit');

    expect(
      blockedReason({ budgetExceeded: false, daily: dailyCallState({ used: 1, limit: 10 }) })
    ).toBeNull();
  });

  it('돈이 없으면 누가 부르든 못 부른다', () => {
    expect(
      blockedReason({ budgetExceeded: true, daily: dailyCallState({ used: 10, limit: 10 }) })
    ).toBe('budget');
  });

  it('안내 문구가 고장났다고 말하지 않고 AI를 입에 올리지 않는다', () => {
    expect(CALL_BLOCKED_NOTICE).not.toContain('AI');
    expect(CALL_BLOCKED_NOTICE).not.toContain('실패');
    expect(findBannedPhrases(CALL_BLOCKED_NOTICE)).toEqual([]);
    expect(findVaguePhrases(CALL_BLOCKED_NOTICE)).toEqual([]);
  });
});

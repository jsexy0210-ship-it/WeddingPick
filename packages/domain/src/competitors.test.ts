import {
  COMPETITOR_RESPONSES,
  COMPETITOR_RESPONSE_RULE,
  COMPETITOR_WATCHLIST,
  PRIMARY_COMPETITOR,
  isOutOfDirection,
} from './competitors';

describe('경쟁 서비스 모니터링', () => {
  it('우선 대상과 비교군을 담는다', () => {
    expect(PRIMARY_COMPETITOR).toBe('WEDDiC');
    expect(COMPETITOR_WATCHLIST).toContain('웨딩북');
    expect(COMPETITOR_WATCHLIST).toContain('결준노트');
  });

  it('복제라는 갈래가 없다', () => {
    /*
     * 경쟁 서비스가 무엇을 하는지 아는 것과 그것을 베끼는 것은 다르다.
     * 갈래에 `복제`를 두지 않으면 코드가 그 선택을 표현할 수 없다.
     */
    expect(COMPETITOR_RESPONSES).toEqual(['redesign', 'already_covered', 'not_our_direction']);
    expect(Object.values(COMPETITOR_RESPONSE_RULE).join(' ')).not.toContain('복제');
  });

  it('이미 있는 기능은 더하지 않는다고 적혀 있다', () => {
    expect(COMPETITOR_RESPONSE_RULE.already_covered).toContain('더하지 않는다');
  });

  it('상담·예약·판매·중개는 우리 방향이 아니다', () => {
    // v3.13 §O-7. 웨딩픽은 사용자가 직접 고르도록 돕는 서비스다.
    expect(isOutOfDirection('업체 상담 예약 대행')).toBe(true);
    expect(isOutOfDirection('패키지 중개 수수료')).toBe(true);
    expect(isOutOfDirection('가격 비교')).toBe(false);
  });
});

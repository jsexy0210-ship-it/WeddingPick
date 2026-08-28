import {
  comparePenalty,
  matchEssentialOption,
  standardPenaltyRate,
} from './consumer-standards';

describe('예식 취소 위약금 기준', () => {
  it('90일 이상 남았으면 계약금을 돌려받는 것이 기준이다', () => {
    expect(standardPenaltyRate(120)).toBe(0);
    expect(standardPenaltyRate(90)).toBe(0);
  });

  it('남은 날짜가 줄수록 기준 배상률이 오른다', () => {
    expect(standardPenaltyRate(89)).toBe(0.1);
    expect(standardPenaltyRate(60)).toBe(0.1);
    expect(standardPenaltyRate(59)).toBe(0.2);
    expect(standardPenaltyRate(30)).toBe(0.2);
    expect(standardPenaltyRate(29)).toBe(0.35);
    expect(standardPenaltyRate(0)).toBe(0.35);
  });

  it('기준 이하 조항은 그대로 둔다', () => {
    expect(comparePenalty({ daysBeforeWedding: 45, contractRate: 0.2 })).toEqual({
      verdict: 'within_standard',
      standardRate: 0.2,
    });
  });

  it('기준보다 무거운 조항을 짚어낸다', () => {
    // 샘플 견적서의 "30일 이내 취소 시 50%" 같은 조항.
    expect(comparePenalty({ daysBeforeWedding: 29, contractRate: 0.5 })).toEqual({
      verdict: 'harsher_than_standard',
      standardRate: 0.35,
      contractRate: 0.5,
    });
  });

  it('90일 이상 남았는데 위약금을 받는 조항도 짚어낸다', () => {
    expect(comparePenalty({ daysBeforeWedding: 100, contractRate: 0.1 }).verdict).toBe(
      'harsher_than_standard'
    );
  });
});

describe('기본 제공이어야 하는 항목', () => {
  it('표기가 달라도 찾아낸다', () => {
    expect(matchEssentialOption('드레스 헬퍼비')).toBeNull();
    expect(matchEssentialOption('드레스 피팅비')?.key).toBe('dress_fitting');
    expect(matchEssentialOption('메이크업 얼리스타트(오전 6시 이전)')?.key).toBe(
      'makeup_early_start'
    );
    expect(matchEssentialOption('원본 구입비')?.key).toBe('photo_file');
  });

  it('보통의 추가 항목은 짚지 않는다', () => {
    expect(matchEssentialOption('생화 장식 업그레이드')).toBeNull();
    expect(matchEssentialOption('지방 예식 출장비')).toBeNull();
  });
});

describe('구간 조항은 위쪽 끝으로 본다', () => {
  /*
   * 실제 계약서에서 나온 조항이다 — "예식일 149~60일 전 해제 시 총 비용의 10%".
   * 기준은 90일 이상이면 계약금 환급이므로, 이 조항은 149~90일 구간에서 더 무겁다.
   */
  it('구간의 위쪽 끝에서 차이를 잡는다', () => {
    expect(comparePenalty({ daysBeforeWedding: 149, contractRate: 0.1 })).toEqual({
      verdict: 'harsher_than_standard',
      standardRate: 0,
      contractRate: 0.1,
    });
  });

  it('아래쪽 끝만 보면 같은 조항을 놓친다', () => {
    // 60일 지점에서는 기준도 10%라 같아 보인다. 그래서 아래쪽 끝을 넣으면 안 된다.
    expect(comparePenalty({ daysBeforeWedding: 60, contractRate: 0.1 }).verdict).toBe(
      'within_standard'
    );
  });

  it('기준과 같은 구간은 조용히 둔다', () => {
    // 같은 계약서의 나머지 두 구간은 기준과 정확히 같았다.
    expect(comparePenalty({ daysBeforeWedding: 59, contractRate: 0.2 }).verdict).toBe(
      'within_standard'
    );
    expect(comparePenalty({ daysBeforeWedding: 29, contractRate: 0.35 }).verdict).toBe(
      'within_standard'
    );
  });
});

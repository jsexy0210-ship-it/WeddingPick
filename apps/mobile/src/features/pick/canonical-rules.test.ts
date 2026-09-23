import {
  PICK_COMPARE_ADD_LABEL,
  PICK_COMPARE_MAX,
  PICK_COMPARE_MIN,
  PICK_COMPARE_REMOVE_LABEL,
  compareBasketLabel,
} from './canonical-rules';

describe('Pick 정본 규칙', () => {
  it('비교는 2~3곳으로 고정한다', () => {
    expect(PICK_COMPARE_MIN).toBe(2);
    expect(PICK_COMPARE_MAX).toBe(3);
  });

  it('저장 용어 없이 정본 문구를 쓴다', () => {
    expect(PICK_COMPARE_ADD_LABEL).toBe('비교에 담기');
    expect(PICK_COMPARE_REMOVE_LABEL).toBe('비교에서 빼기');
    expect(compareBasketLabel(2)).toBe('2곳 담았어요');
  });
});

import {
  PICK_COMPARE_ADD_LABEL,
  PICK_COMPARE_MAX,
  PICK_COMPARE_MIN,
  PICK_COMPARE_REMOVE_LABEL,
  PICK_SUBTITLE,
  PICK_VERIFY_LABEL,
  compareBasketLabel,
  pickCountLabel,
} from './canonical-rules';

describe('Pick 정본 규칙', () => {
  it('비교는 2~3곳으로 고정한다', () => {
    expect(PICK_COMPARE_MIN).toBe(2);
    expect(PICK_COMPARE_MAX).toBe(3);
  });

  it('저장 용어 없이 정본 문구를 쓴다', () => {
    expect(PICK_SUBTITLE).toBe('담아둔 곳을 비교하고 정해요');
    expect(PICK_VERIFY_LABEL).toBe('Pick 인증');
    expect(PICK_COMPARE_ADD_LABEL).toBe('비교에 담기');
    expect(PICK_COMPARE_REMOVE_LABEL).toBe('비교에서 빼기');
    expect(pickCountLabel(4)).toBe('4곳');
    expect(compareBasketLabel(2)).toBe('2곳 담았어요');
  });
});

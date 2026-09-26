import {
  PICK_COMPARE_ADD_LABEL,
  PICK_COMPARE_MAX,
  PICK_COMPARE_MIN,
  PICK_COMPARE_REMOVE_LABEL,
  compareBasketLabel,
  groupMetaLabel,
  showGroupMeta,
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

  it('«내 조건에 맞는 곳»만 있는 묶음에는 «0개 · 최신순»을 그리지 않는다(2026-09-26 대표 지시)', () => {
    // 담은 곳 0 · 추천 5 — 추천 줄의 머리로 읽히던 자리.
    expect(showGroupMeta(0, 5)).toBe(false);
    // 담은 곳이 있으면 정본 catGroupMeta 그대로.
    expect(showGroupMeta(2, 5)).toBe(true);
    expect(showGroupMeta(2, 0)).toBe(true);
    // 추천도 담은 곳도 없는 묶음 — 정본 catGroups «예물 · 신혼» count 0 자리.
    expect(showGroupMeta(0, 0)).toBe(true);
    expect(groupMetaLabel(3)).toBe('3개 · 최신순');
  });
});

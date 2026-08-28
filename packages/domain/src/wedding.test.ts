import { combineOpinions } from './wedding';

describe('부부 공동 의사결정', () => {
  it('둘 다 선호하면 둘 다 선호', () => {
    expect(combineOpinions('preferred', 'preferred')).toBe('both_preferred');
  });

  it('둘 다 제외하면 둘 다 제외', () => {
    expect(combineOpinions('excluded', 'excluded')).toBe('both_excluded');
  });

  it('의견이 갈리면 의견 다름', () => {
    expect(combineOpinions('preferred', 'excluded')).toBe('disagreed');
    expect(combineOpinions('hold', 'preferred')).toBe('disagreed');
  });

  it('한쪽이 아직 의견을 내지 않았으면 결론이 아니다', () => {
    expect(combineOpinions('preferred', null)).toBe('undecided');
    expect(combineOpinions(null, null)).toBe('undecided');
  });
});

import { STYLE_PICK_MAX, styleMatchReason, styleOverlap, toggleStyle, WEDDING_STYLES } from './style';

describe('스타일 4종', () => {
  it('넷뿐이다 — 업종별 세부 속성은 여기 없다', () => {
    expect([...WEDDING_STYLES]).toEqual(['URBAN', 'NATURAL', 'ROMANTIC', 'GLAMOROUS']);
  });

  it('재클릭은 해제하고 네 가지를 모두 고를 수 있다', () => {
    expect(toggleStyle([], 'URBAN').next).toEqual(['URBAN']);
    expect(toggleStyle(['URBAN'], 'URBAN').next).toEqual([]);
    const two = toggleStyle(['URBAN'], 'ROMANTIC');
    const three = toggleStyle(two.next, 'NATURAL');
    const four = toggleStyle(three.next, 'GLAMOROUS');
    expect(four.next).toEqual(['URBAN', 'ROMANTIC', 'NATURAL', 'GLAMOROUS']);
    expect(four.limited).toBe(false);
    expect(STYLE_PICK_MAX).toBe(4);
  });

  it('교집합은 순서 가중치일 뿐 업체를 빼지 않는다', () => {
    expect(styleOverlap(['URBAN', 'ROMANTIC'], ['ROMANTIC', 'NATURAL'])).toEqual(['ROMANTIC']);
    expect(styleOverlap(['GLAMOROUS'], ['NATURAL'])).toEqual([]);
  });

  it('추천 이유 첫 불릿 — 다 맞으면 개수를, 일부면 «맞아요», 아니면 없음', () => {
    expect(styleMatchReason(['URBAN', 'ROMANTIC'], ['URBAN', 'ROMANTIC', 'NATURAL'])).toBe(
      '고른 스타일 2개가 다 맞아요'
    );
    expect(styleMatchReason(['URBAN', 'ROMANTIC'], ['ROMANTIC'])).toBe('고른 스타일이랑 맞아요');
    expect(styleMatchReason(['URBAN'], ['URBAN'])).toBe('고른 스타일이랑 맞아요');
    expect(styleMatchReason(['URBAN'], ['NATURAL'])).toBeNull();
    expect(styleMatchReason([], ['NATURAL'])).toBeNull();
  });
});

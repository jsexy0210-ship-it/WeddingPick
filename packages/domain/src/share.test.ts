import { compareShareLink, compareShareMessage, vendorShareLink, vendorShareMessage } from './share';

describe('업체 공유', () => {
  it('앱 스킴 링크를 만든다', () => {
    expect(vendorShareLink('v-1')).toBe('weddingpick://search/v-1');
  });

  it('링크에 위험한 글자가 있어도 안전하게 담는다', () => {
    expect(vendorShareLink('v/1')).toBe('weddingpick://search/v%2F1');
  });

  it('공유 문구에 이름·분류·지역과 링크를 함께 담는다', () => {
    const message = vendorShareMessage({
      id: 'v-1',
      name: '가온예식홀',
      categoryLabel: '웨딩홀',
      region: '서울',
    });

    expect(message).toContain('가온예식홀 · 웨딩홀 · 서울');
    expect(message).toContain('weddingpick://search/v-1');
  });
});

describe('비교 공유', () => {
  it('여러 업체 id를 콤마로 이어 링크를 만든다', () => {
    expect(compareShareLink(['v-1', 'v-2'])).toBe('weddingpick://search/compare?ids=v-1,v-2');
  });

  it('공유 문구에 업체 이름들과 링크를 함께 담는다', () => {
    const message = compareShareMessage(['가온예식홀', '나래스튜디오'], ['v-1', 'v-2']);

    expect(message).toContain('가온예식홀 · 나래스튜디오');
    expect(message).toContain('weddingpick://search/compare?ids=v-1,v-2');
  });
});

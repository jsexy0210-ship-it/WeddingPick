import { formatCount } from './format-number';

describe('formatCount', () => {
  it('천단위 쉼표를 붙인다', () => {
    expect(formatCount(1234)).toBe('1,234');
    expect(formatCount(1234567)).toBe('1,234,567');
  });

  it('네 자리 미만은 쉼표가 없다', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
  });

  it('로케일을 ko-KR로 고정한다 — 기기 로케일을 따라가지 않는다', () => {
    const original = Number.prototype.toLocaleString;
    const spy = jest.spyOn(Number.prototype, 'toLocaleString');

    formatCount(1234);

    expect(spy).toHaveBeenCalledWith('ko-KR');

    spy.mockRestore();
    expect(Number.prototype.toLocaleString).toBe(original);
  });
});

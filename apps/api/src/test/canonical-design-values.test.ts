import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../../../..');
const read = (name: string) => readFileSync(join(root, name), 'utf8');
const canon = JSON.parse(read('docs/design/handoff/tokens.json')) as {
  spacing: { gutter: number; grid2Gap: number; grid3Gap: number };
  radius: { control: number };
};
const tokens = JSON.parse(read('spec/tokens.json')) as {
  spacing: { gutter: { value: number }; pageX: { value: number } };
  grid: { gutter: number };
  radius: { control: number };
};
const theme = read('packages/ui/src/theme.ts');

function numericConstant(source: string, exportName: string, name: string): number {
  const block = source.split(`export const ${exportName} = {`)[1]?.split('} as const;')[0];
  const match = block && new RegExp(`^\\s+${name}: (\\d+(?:\\.\\d+)?),`, 'm').exec(block);
  if (!match) throw new Error(`${exportName}.${name} is missing`);
  return Number(match[1]);
}

describe('2026-09-17 최신 디자인 수치 정합성', () => {
  it('모든 페이지/그리드 여백 별칭이 정본과 같다', () => {
    const gutter = canon.spacing.gutter;
    expect(tokens.spacing.gutter.value).toBe(gutter);
    expect(tokens.spacing.pageX.value).toBe(gutter);
    expect(tokens.grid.gutter).toBe(gutter);
    expect(numericConstant(theme, 'Layout', 'gutter')).toBe(gutter);
    expect(numericConstant(theme, 'Layout', 'pageX')).toBe(gutter);
  });
  it('버튼/입력 필드 곡률이 폐기된 16이 아닌 정본 값이다', () => {
    expect(tokens.radius.control).toBe(canon.radius.control);
    expect(numericConstant(theme, 'Radius', 'control')).toBe(canon.radius.control);
  });
  it('카드 열 사이 여백은 화면 바깥 여백과 다른 토큰이다', () => {
    expect(numericConstant(theme, 'Layout', 'gap2col')).toBe(canon.spacing.grid2Gap);
    expect(numericConstant(theme, 'Layout', 'gap3col')).toBe(canon.spacing.grid3Gap);
  });
  it('이전 20px 별칭으로 되돌아가면 검사가 탐지한다', () => {
    const old = theme.replace(/(pageX: )24,/, '$120,');
    expect(old).not.toBe(theme);
    expect(numericConstant(old, 'Layout', 'pageX')).not.toBe(canon.spacing.gutter);
  });
});

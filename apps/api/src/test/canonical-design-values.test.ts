import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../../../..');
const read = (name: string) => readFileSync(join(root, name), 'utf8');

/*
 * **더 이상 `docs/design/handoff/tokens.json`을 읽지 않는다.** 2026-09-22 대표 지시로
 * 옛 정본(`handoff/`·`figma-export/`)을 전부 지웠다 — 이 시험이 그 파일에서 읽던
 * 「좌우 여백 24 · 카드 사이 11/10 · 버튼 곡률 6」은 2026-09-17에 확정된 값이고, 지우기
 * 직전 마지막 커밋(`e418caa5`)에서도 여전히 그 값이었다. 지어낸 숫자가 아니라 확정 당시
 * 그대로 얼린 값이다.
 *
 * `spec/tokens.json`도 같은 값을 **독립적으로** 들고 있다 — CLAUDE.md의 「값은
 * spec/tokens.json에서만 가져온다」대로, 화면 코드는 애초에 handoff를 직접 읽지 않았다.
 * 이 시험이 하던 일은 spec과 handoff가 갈라지지 않았는지 대조하는 것이었는데, 대조할
 * handoff가 없어졌으니 이제는 **spec ↔ theme.ts**가 확정값에서 갈라지지 않았는지를 본다.
 */
const CANON_2026_09_17 = { gutter: 24, grid2Gap: 11, grid3Gap: 10, radiusControl: 6 } as const;

const tokens = JSON.parse(read('spec/tokens.json')) as {
  spacing: { gutter: { value: number }; pageX: { value: number }; gap2col: { value: number }; gap3col: { value: number } };
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

describe('2026-09-17 최신 디자인 수치 정합성 (2026-09-22: 정본 대조를 spec/tokens.json ↔ theme.ts로 좁힘)', () => {
  it('모든 페이지/그리드 여백 별칭이 확정값과 같다', () => {
    const gutter = CANON_2026_09_17.gutter;
    expect(tokens.spacing.gutter.value).toBe(gutter);
    expect(tokens.spacing.pageX.value).toBe(gutter);
    expect(tokens.grid.gutter).toBe(gutter);
    expect(numericConstant(theme, 'Layout', 'gutter')).toBe(gutter);
    expect(numericConstant(theme, 'Layout', 'pageX')).toBe(gutter);
  });
  it('버튼/입력 필드 곡률이 폐기된 16이 아닌 확정값이다', () => {
    expect(tokens.radius.control).toBe(CANON_2026_09_17.radiusControl);
    expect(numericConstant(theme, 'Radius', 'control')).toBe(CANON_2026_09_17.radiusControl);
  });
  it('카드 열 사이 여백은 화면 바깥 여백과 다른 토큰이다', () => {
    expect(tokens.spacing.gap2col.value).toBe(CANON_2026_09_17.grid2Gap);
    expect(tokens.spacing.gap3col.value).toBe(CANON_2026_09_17.grid3Gap);
    expect(numericConstant(theme, 'Layout', 'gap2col')).toBe(CANON_2026_09_17.grid2Gap);
    expect(numericConstant(theme, 'Layout', 'gap3col')).toBe(CANON_2026_09_17.grid3Gap);
  });
  it('이전 20px 별칭으로 되돌아가면 검사가 탐지한다', () => {
    const old = theme.replace(/(pageX: )24,/, '$120,');
    expect(old).not.toBe(theme);
    expect(numericConstant(old, 'Layout', 'pageX')).not.toBe(CANON_2026_09_17.gutter);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * 핸드오프 토큰이 코드 토큰에 다 들어 있는지 지킨다.
 *
 * 값의 원본은 `docs/design-handoff/current/tokens.json`이고, 코드가 읽는 원본은 `spec/tokens.json`이다
 * (CLAUDE.md: 값은 spec/tokens.json에서만 가져온다). 두 파일의 모양은 다르지만 — spec은 값마다 `use`를
 * 붙인다 — **핸드오프가 정한 색과 수는 전부 spec에 있어야 한다.** 핸드오프가 바뀌고 spec이 그대로면
 * 화면은 옛 값을 그린다. 그 어긋남을 여기서 잡는다.
 *
 * 그리고 `packages/ui/src/theme.ts`의 팔레트는 spec에 있는 색만 쓴다 — 코드가 새 색을 만들지 않는다.
 *
 * 이 시험이 서버 패키지에 있는 이유는 typography.test.ts와 같다 — 파일을 읽으려면 node가 필요하다.
 */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function leaves(value: Json, path = '', out: [string, Json][] = []): [string, Json][] {
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) leaves(child, path ? `${path}.${key}` : key, out);
  } else {
    out.push([path, value]);
  }

  return out;
}

const handoff = JSON.parse(
  readFileSync(join(ROOT, 'docs/design-handoff/current/tokens.json'), 'utf8')
) as Json;
const specText = readFileSync(join(ROOT, 'spec/tokens.json'), 'utf8');
const spec = JSON.parse(specText) as Json;

const HEX = /^#[0-9a-f]{6}$/i;

describe('디자인 토큰 — 핸드오프 ↔ spec/tokens.json', () => {
  it('핸드오프의 색은 전부 spec에 있다', () => {
    const specLower = specText.toLowerCase();
    const missing = leaves(handoff)
      .filter(([, v]) => typeof v === 'string' && (HEX.test(v) || v.startsWith('rgba')))
      .filter(([, v]) => !specLower.includes((v as string).toLowerCase()))
      .map(([k, v]) => `${k} = ${String(v)}`);

    expect(missing).toEqual([]);
  });

  it('핸드오프의 수치는 전부 spec에 있다', () => {
    /*
     * spec은 lineHeight 변형을 «19|21»처럼 문자열로 적는다 — 그 안의 수도 값으로 친다.
     */
    const specNumbers = new Set<number>();

    for (const [, v] of leaves(spec)) {
      if (typeof v === 'number') specNumbers.add(v);
      if (typeof v === 'string') for (const n of v.match(/\d+(\.\d+)?/g) ?? []) specNumbers.add(Number(n));
    }

    const missing = leaves(handoff)
      .filter(([, v]) => typeof v === 'number' && !specNumbers.has(v))
      .map(([k, v]) => `${k} = ${String(v)}`);

    expect(missing).toEqual([]);
  });

  it('theme.ts 팔레트는 spec에 있는 색만 쓴다', () => {
    const theme = readFileSync(join(ROOT, 'packages/ui/src/theme.ts'), 'utf8');
    const specLower = specText.toLowerCase();
    const known = new Set(
      Array.from(specLower.matchAll(/#[0-9a-f]{6}\b/g)).map((m) => m[0])
    );
    /*
     * 어두운 모드 값은 SEED gray 램프의 어두운 벌이고 spec은 라이트만 적는다 — 앱은 항상 라이트라
     * 그 벌은 검사 밖이다(use-color-scheme.ts). `dark: {` 블록 앞까지만 본다.
     */
    const lightPart = theme
      .slice(0, theme.indexOf('  dark: {'))
      .split('\n')
      /* 팔레트 안의 어두운 벌(darkGray 램프 · red-400 · 어두운 구분선)도 같은 이유로 뺀다. */
      .filter((line) => !/darkGray|darkLineAlpha|red400/.test(line))
      .join('\n');
    const unknown = Array.from(lightPart.matchAll(/'(#[0-9a-f]{6})'/gi))
      .map((m) => m[1]!.toLowerCase())
      .filter((hex) => !known.has(hex));

    /*
     * 옛 지출 차트 계열색(teal · violet). 핸드오프에 없지만 아직 쓰는 화면이 있어 @deprecated로 남겼다 —
     * 화면이 chartSeries1~3으로 옮기면 여기서 지운다.
     */
    const grandfathered = new Set(['#00c2b3', '#00a99d', '#8b5cf6', '#7c3aed']);

    expect(unknown.filter((hex) => !grandfathered.has(hex))).toEqual([]);
  });

  it('Pick Mark 경로는 절대 바뀌지 않는다', () => {
    const symbol = (spec as { symbol: { paths: string[] } }).symbol;
    const mark = readFileSync(join(ROOT, 'packages/ui/src/wedding-mark.tsx'), 'utf8');

    expect(symbol.paths).toEqual([
      'M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z',
      'M9.4 11.9l1.7 1.7 3.4-3.4',
    ]);
    for (const path of symbol.paths) expect(mark).toContain(path);
  });
});

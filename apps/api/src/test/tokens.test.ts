import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * `docs/design/handoff/tokens.json`과 `spec/tokens.json`을 대조하던 시험 둘을
 * **2026-09-22에 뺐다.** 대표 지시로 옛 정본(`handoff/`·`figma-export/`)을 전부
 * 지웠고 — 「모든 작업은 v3.28 기준이다」 — 이 시험의 일 자체가 「handoff가 정한
 * 값이 spec에 빠짐없이 있는가」였다. 비교할 handoff가 없어졌다.
 *
 * **스냅샷을 얼려 대신 쓰지 않았다.** `apps/mobile/src/components/confirm-alert.web.ts`처럼
 * 코드가 실제로 그 값을 써야 돌아가는 자리라면 얼린 값을 남기는 것이 맞지만, 이 시험은
 * 그 반대다 — **얼린 handoff를 다시 근거로 세우는 것**이 되어, 「기존 파일은 다 파기한다」는
 * 지시를 시험 안에서 뒤집는 꼴이 된다. 새 정본(v3.28)이 같은 수치·색 표를 내놓으면
 * 그때 그 표와 spec을 대조하는 시험을 다시 만든다.
 *
 * 아래 둘은 handoff와 무관하게 `spec/tokens.json`·코드만 보므로 그대로 남긴다.
 */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const specText = readFileSync(join(ROOT, 'spec/tokens.json'), 'utf8');
const seedLight = (
  JSON.parse(readFileSync(join(ROOT, 'spec/seed-tokens.json'), 'utf8')) as {
    light: Record<string, string>;
  }
).light;
const spec = JSON.parse(specText) as Json;

describe('디자인 토큰 — spec/tokens.json 자체 정합성', () => {
  it('theme.ts 팔레트는 spec에 있는 색만 쓴다', () => {
    const theme = readFileSync(join(ROOT, 'packages/ui/src/theme.ts'), 'utf8');
    const specLower = specText.toLowerCase();
    const known = new Set(
      Array.from(specLower.matchAll(/#[0-9a-f]{6}\b/g)).map((m) => m[0])
    );

    /*
     * **SEED에서 뽑은 값도 「아는 색」이다.** 2026-09-15에 색의 출처가 SEED로 옮겨가면서
     * `theme.ts`의 gray 램프는 SEED 램프 열한 단계를 전부 들고 있는데, spec은 그중 쓰는
     * 것만 적는다 — 피그마가 글자에 두 색만 써서 `#555d6d`(SEED gray-800)가 spec에서
     * 빠지자 이 시험이 그것을 「모르는 색」으로 잡았다.
     *
     * 램프에서 그 단계를 빼면 `seed-parity.test.ts`가 빨개진다(SEED 램프 그대로여야 한다).
     * 검사를 무르는 것이 아니라 **출처를 하나 더 인정하는 것**이다 — SEED에 있는 값은
     * 근거 있는 값이고, 근거 없이 만든 값은 여전히 여기서 걸린다.
     */
    for (const value of Object.values(seedLight)) known.add(value.toLowerCase());
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

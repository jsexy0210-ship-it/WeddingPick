import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * 우리 색이 SEED 디자인 시스템에서 벗어나지 않게 지킨다.
 *
 * **왜 있는가.** 색 토큰은 원래 SEED를 손으로 베낀 것이었다. 베낀 뒤 SEED가 움직이는
 * 동안 우리만 그대로여서 2026-09-15에 재어 보니 본문 먹색이 `#212124`(우리)와
 * `#1A1C20`(SEED 현행)으로 갈라져 있었다 — **모든 화면에 걸리는 차이인데 아무도
 * 몰랐다.** 대표님이 앱을 열어 보시고 「피그마랑 아예 다르다」고 하셔서 드러났다.
 *
 * 손으로 베끼면 반드시 다시 갈라진다. 그래서 값은 `scripts/sync-seed-tokens.mjs`가
 * `@seed-design/css`에서 뽑고(`spec/seed-tokens.json`), 어느 토큰이 SEED의 무엇인지는
 * `spec/seed-map.json`이 적고, **어긋나면 여기서 빨개진다.**
 *
 * 이 시험이 서버 패키지에 있는 이유는 tokens.test.ts와 같다 — 파일을 읽으려면 node가
 * 필요하다.
 */
const read = (path: string) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));

const seed = read('spec/seed-tokens.json') as { light: Record<string, string> };
const mapping = read('spec/seed-map.json') as { map: Record<string, string> };
const tokens = read('spec/tokens.json') as {
  color: Record<string, Record<string, { value: string }>>;
};

describe('색은 SEED에서 온다', () => {
  it('spec/tokens.json의 색이 SEED 값과 같다', () => {
    const drifted = Object.entries(mapping.map)
      .map(([path, seedName]) => {
        const [group = '', key = ''] = path.split('.');
        const ours = tokens.color[group]?.[key]?.value;
        const theirs = seed.light[seedName];

        return { path, seedName, ours, theirs };
      })
      .filter((row) => row.ours?.toUpperCase() !== row.theirs?.toUpperCase())
      .map((row) => `${row.path} = ${row.ours} ≠ ${row.seedName} = ${row.theirs}`);

    expect(drifted).toEqual([]);
  });

  it('표가 가리키는 SEED 이름이 실제로 있다', () => {
    // 오타 난 이름은 위 시험에서 「둘 다 undefined」로 조용히 통과할 수 있다.
    const missing = Object.entries(mapping.map)
      .filter(([, seedName]) => seed.light[seedName] === undefined)
      .map(([path, seedName]) => `${path} → ${seedName}`);

    expect(missing).toEqual([]);
  });

  it('theme.ts의 gray 램프가 SEED 램프 그대로다', () => {
    const theme = readFileSync(join(ROOT, 'packages/ui/src/theme.ts'), 'utf8');

    /** 우리 이름은 SEED보다 한 칸씩 작다 — gray900이 SEED gray-1000이다. */
    const steps: [string, string][] = [
      ['gray900', '1000'],
      ['gray800', '900'],
      ['gray700', '800'],
      ['gray600', '700'],
      ['gray500', '600'],
      ['gray400', '500'],
      ['gray300', '400'],
      ['gray200', '300'],
      ['gray100', '200'],
      ['gray50', '100'],
      ['gray00', '00'],
    ];

    const wrong = steps
      .map(([name, step]) => {
        const found = new RegExp(`^  ${name}: '(#[0-9a-f]{6})',$`, 'm').exec(theme)?.[1];
        const want = seed.light[`color-palette-gray-${step}`]?.toLowerCase();

        return { name, step, found, want };
      })
      .filter((row) => row.found !== row.want)
      .map((row) => `${row.name} = ${row.found} ≠ SEED gray-${row.step} = ${row.want}`);

    expect(wrong).toEqual([]);
  });

  it('뽑은 값이 지금 깔린 SEED와 같다', () => {
    // `npm install`로 SEED가 올라갔는데 뽑기를 안 돌리면 여기서 걸린다.
    const version = JSON.parse(
      readFileSync(join(ROOT, 'node_modules/@seed-design/css/package.json'), 'utf8'),
    ).version;

    expect(read('spec/seed-tokens.json').$source).toBe(`@seed-design/css@${version} base.css`);
  });
});

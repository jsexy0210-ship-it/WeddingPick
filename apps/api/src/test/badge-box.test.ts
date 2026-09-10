import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * 배지가 글자를 자르지 못하게 막는다.
 *
 * 배지는 바탕색 상자라 글자가 상자 안에 얼마나 남는지가 그대로 보인다. 세로를
 * `height`로 못박아두면 안쪽(height − 상하 패딩)이 줄 높이보다 작아지고, 줄은
 * 상자 밖으로 비어져 나와 테두리에 닿는다 — 「배지가 잘린다」로 보이던 자리가
 * 전부 이 한 줄이었다(`height: 22` · 패딩 4 · 줄 19 → 안쪽 14).
 *
 * 핸드오프의 배지 22곳(`docs/design-handoff/current/html`)은 어느 것도 height를
 * 적지 않는다. `padding:4px 9px; line-height:19px`뿐이고 그려지는 높이는 27이다.
 * 웹(`apps/web/src/site-styles.ts` `.badge`)도 같다. 그래서 앱도 최소 높이로만 든다.
 *
 * typography.test.ts와 같은 방식으로 저장소를 훑는다 — 눈으로 지키는 규칙은
 * 지켜지지 않는다.
 */
function sourceFiles(): string[] {
  const out = execSync(
    "git ls-files 'packages/**/*.ts' 'packages/**/*.tsx' 'apps/mobile/**/*.ts' 'apps/mobile/**/*.tsx'",
    { cwd: ROOT, encoding: 'utf8' }
  );

  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((path) => existsSync(join(ROOT, path)));
}

/** `이름: { … }` 한 덩어리와 `export const 이름_STYLE = { … }`를 모두 집는다. */
const STYLE_BLOCK = /(?:export const\s+)?([A-Za-z_][\w]*)\s*(?::|=)\s*\{([^{}]*)\}/g;

/** 배지 상자로 볼 이름. */
const BADGE_NAME = /badge/i;

/**
 * 한 변을 못박은 것은 글자가 아니라 도형이 크기를 정한다 — 홈 TOP3의 순위 원(28×28)처럼
 * 가로를 고정한 배지는 이 규칙 밖이다. 글자가 세로를 정하는 상자만 본다.
 */
function sizedByText(body: string): boolean {
  return !/(^|[^a-zA-Z])width:/.test(body);
}

function badgeStyleBlocks(): { where: string; name: string; body: string }[] {
  const found: { where: string; name: string; body: string }[] = [];

  for (const path of sourceFiles()) {
    const source = readFileSync(join(ROOT, path), 'utf8');

    for (const match of source.matchAll(STYLE_BLOCK)) {
      /* `noUncheckedIndexedAccess` — 붙잡은 조각은 `string | undefined`다. */
      const [, name, body] = match;
      if (name === undefined || body === undefined) continue;
      if (!BADGE_NAME.test(name)) continue;
      /* 색·글자만 든 덩어리는 상자가 아니다. */
      if (!/padding|borderRadius|minHeight|[^n]height:/.test(body)) continue;

      const line = source.slice(0, match.index ?? 0).split('\n').length;
      found.push({ where: `${path}:${line}`, name, body });
    }
  }

  return found;
}

/** `theme.ts` · `typography.ts`가 든 숫자를 글자로 읽는다. RN을 불러오지 않으려고 그렇게 한다. */
function tokenNumber(file: string, key: string): number {
  const source = readFileSync(join(ROOT, file), 'utf8');
  const value = source.match(new RegExp(`\\b${key}:\\s*(\\d+)`))?.[1];

  expect(value).toBeDefined();

  return Number(value);
}

describe('배지 상자', () => {
  it('세로를 고정하지 않는다', () => {
    /*
     * `height: …`만 잡는다 — `minHeight` · `lineHeight` · `maxHeight`는 통과한다.
     * 고정 높이가 필요해 보이면 그것은 배지가 아니라 다른 상자다.
     */
    const boxes = badgeStyleBlocks().filter(({ body }) => sizedByText(body));
    const offenders = boxes
      .filter(({ body }) => /(^|[^a-zA-Z])height:/.test(body))
      .map(({ where, name }) => `${where} ${name}`);

    /* 훑는 규칙 자체가 죽으면 통과해버린다 — 배지 상자를 실제로 찾았는지 함께 본다. */
    expect(boxes.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('공용 상자가 토큰으로 최소 높이를 든다', () => {
    const source = readFileSync(join(ROOT, 'packages/ui/src/pick-status-badge.tsx'), 'utf8');

    expect(source).toContain('minHeight: Layout.badgeHeight');
    expect(source).toContain('paddingVertical: Layout.badgePaddingY');
  });

  it('최소 높이가 줄 높이를 누르지 않는다', () => {
    /*
     * 상자가 실제로 그려지는 높이는 `상하 패딩 + 줄 높이`다. 그 값이 최소 높이보다
     * 작으면 최소 높이가 이기면서 패딩이 줄어든다 — 지금은 27 > 22라 패딩이 온전하다.
     * 토큰을 손봐서 이 관계가 뒤집히면 여기서 걸린다.
     */
    const minHeight = tokenNumber('packages/ui/src/theme.ts', 'badgeHeight');
    const paddingY = tokenNumber('packages/ui/src/theme.ts', 'badgePaddingY');
    const lineHeight = tokenNumber('packages/ui/src/typography.ts', 'badge');

    expect(paddingY * 2 + lineHeight).toBeGreaterThanOrEqual(minHeight);
  });

  it('실 제보 단계 배지도 같다', () => {
    const paddingY = tokenNumber('packages/ui/src/theme.ts', 'tierBadgePaddingY');
    const lineHeight = tokenNumber('packages/ui/src/typography.ts', 'micro');
    const source = readFileSync(join(ROOT, 'packages/ui/src/data-tier-badge.tsx'), 'utf8');

    expect(source).not.toMatch(/(^|[^a-zA-Z])height:/m);
    expect(paddingY * 2 + lineHeight).toBeGreaterThan(0);
  });

  it('핸드오프 배지가 여전히 패딩으로만 높이를 만든다', () => {
    /*
     * 기준은 최신 핸드오프다. 시안이 배지에 height를 적기 시작하면 위 규칙이 틀린
     * 것이 되므로, 시안 쪽이 바뀌는 순간을 여기서 잡는다.
     */
    const html = execSync("git ls-files 'docs/design-handoff/current/html/*.dc.html'", {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const declarations = html
      .flatMap((path) => readFileSync(join(ROOT, path), 'utf8').split('\n'))
      .filter((line) => /const badge\s*=/.test(line));

    expect(declarations.length).toBeGreaterThan(0);

    for (const line of declarations) {
      expect(line).toContain('padding:4px 9px');
      expect(line).not.toMatch(/[^-]height:\d/);
    }
  });
});

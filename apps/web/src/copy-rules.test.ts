import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { BANNED_PHRASES, findBannedPhrases, hasExclamationOrEmoji } from '@weddingpick/domain';

import { BRAND, LEAD } from './content';

/**
 * 화면 문구 규칙을 실제로 지키는지 본다.
 *
 * 문서에만 적어두면 지켜지지 않는다 — "찍으면, 진짜 가격이 보인다"가 네 곳에
 * 박혀 있었고 아무도 몰랐다.
 *
 * **주석과 문서는 검사하지 않는다.** 규칙을 설명하려면 금지어를 적어야 하고,
 * 그걸 막으면 왜 금지했는지 적을 수 없게 된다.
 */

const ROOT = join(__dirname, '..', '..', '..');

const SCANNED = [
  join(ROOT, 'apps', 'mobile', 'src'),
  join(ROOT, 'apps', 'web', 'src'),
  join(ROOT, 'packages', 'ui', 'src'),
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      return entry === 'node_modules' || entry === 'admin' ? [] : sourceFiles(path);
    }

    return /\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') ? [path] : [];
  });
}

/** 주석을 걷어낸 소스. 규칙을 설명하는 주석까지 잡으면 설명을 못 쓴다. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

describe('화면 문구 규칙', () => {
  it('브랜드 문구에 판정하는 말이 없다', () => {
    // 우리는 가격의 적정 여부를 판정하지 않는다. 판정처럼 들리는 말을 쓰면
    // 하지 않는 일을 한다고 말하는 것이 된다.
    expect(findBannedPhrases(BRAND.message)).toEqual([]);
    expect(findBannedPhrases(BRAND.description)).toEqual([]);
    expect(findBannedPhrases(LEAD)).toEqual([]);
  });

  it('느낌표와 이모지를 쓰지 않는다', () => {
    expect(hasExclamationOrEmoji(BRAND.message)).toBe(false);
    expect(hasExclamationOrEmoji(BRAND.description)).toBe(false);
  });

  it('앱과 웹 소스 어디에도 금지어가 없다', () => {
    const offenders = SCANNED.flatMap(sourceFiles).flatMap((path) => {
      const found = findBannedPhrases(withoutComments(readFileSync(path, 'utf8')));

      return found.map((violation) => `${path.slice(ROOT.length + 1)}: ${violation.phrase}`);
    });

    expect(offenders).toEqual([]);
  });

  it('금지어 목록이 비어 있지 않다', () => {
    // 목록이 비면 위 검사가 늘 통과한다. 통과하는 검사와 없는 검사는 다르다.
    expect(BANNED_PHRASES.length).toBeGreaterThan(0);
  });
});

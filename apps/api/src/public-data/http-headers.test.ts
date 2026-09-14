import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * HTTP 헤더 값에 아스키가 아닌 글자를 두지 않는다.
 *
 * `scripts/vendor-homepage-images.ts`의 user-agent가 `(+대표 이미지 확인)`이었다.
 * `fetch`는 헤더를 ByteString으로 바꾸는데 한글은 255를 넘어서 **요청을 보내기도 전에
 * 던진다.** 그 자리의 `catch`가 그것을 삼켜 모든 업체가 「페이지 못 읽음」이 됐고,
 * 워크플로는 한 곳도 못 붙인 채 초록으로 끝났다(2026-09-10, 60곳 중 60곳).
 *
 * 우리말 주석을 쓰는 저장소라 이 실수는 다시 난다. 헤더를 적는 자리를 훑어서 막는다.
 */
const ROOT = join(__dirname, '..', '..', '..', '..');
const NON_ASCII = /[^\x20-\x7E]/;

/** `'user-agent': '…'` 처럼 헤더 이름과 문자열 값이 붙어 있는 자리. */
const HEADER_LINE = /['"]?(?:user-agent|accept|accept-language|authorization|content-type|x-[\w-]+)['"]?\s*:\s*(['"`])((?:(?!\1).)*)\1/gi;

function sourceFiles(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

    const path = join(dir, entry.name);

    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) found.push(path);
  }

  return found;
}

describe('HTTP 헤더', () => {
  it('보내는 헤더 값에 아스키가 아닌 글자가 없다', () => {
    const offenders: string[] = [];

    for (const file of [...sourceFiles(join(ROOT, 'scripts')), ...sourceFiles(join(ROOT, 'apps', 'api', 'src'))]) {
      const source = readFileSync(file, 'utf8');

      for (const [, , value] of source.matchAll(HEADER_LINE)) {
        /* 값을 코드로 조립하는 자리는 여기서 판단하지 않는다 — 실행해야 알 수 있다. */
        if (value?.includes('${')) continue;
        if (value && NON_ASCII.test(value)) {
          offenders.push(`${file.slice(ROOT.length + 1)} — ${value}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

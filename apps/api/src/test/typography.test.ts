import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * 토큰 밖의 글자 크기를 막는다.
 *
 * 디자인 시스템이 크기를 정해두어도, 화면 하나가 `fontSize: 19`를 적어두면 그
 * 하나만 다른 글씨가 된다. 그런 값은 고장으로 보이지 않아 아무도 안 고치고,
 * 크기를 손보는 날 그 화면만 옛 값으로 남는다.
 *
 * 저장소를 실제로 훑는다 — 눈으로 지키는 규칙은 지켜지지 않는다.
 *
 * 이 시험이 서버 패키지에 있는 이유: 파일을 읽으려면 node가 필요한데, 앱 쪽
 * 테스트 환경에는 node 타입이 없다. UI 패키지를 불러오지 않고 글자만 훑으므로
 * 여기 있어도 서버와 얽히지 않는다.
 */
function sourceFiles(): string[] {
  const out = execSync(
    "git ls-files 'packages/**/*.ts' 'packages/**/*.tsx' 'apps/mobile/**/*.ts' 'apps/mobile/**/*.tsx' 'apps/web/**/*.ts' 'apps/web/**/*.tsx'",
    { cwd: ROOT, encoding: 'utf8' }
  );

  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    /* 토큰 표 자신은 숫자를 들고 있어야 한다. */
    .filter((path) => !path.endsWith('packages/ui/src/typography.ts'))
    /* 추적 중이지만 작업 트리에서 지워진 파일(아직 커밋 전) — 읽을 것이 없다. */
    .filter((path) => existsSync(join(ROOT, path)));
}

function offenders(pattern: RegExp): string[] {
  const found: string[] = [];

  for (const path of sourceFiles()) {
    readFileSync(join(ROOT, path), 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (pattern.test(line)) found.push(`${path}:${index + 1} ${line.trim()}`);
      });
  }

  return found;
}

describe('글자 크기 토큰', () => {
  it('토큰 표가 t 스케일을 그대로 담는다', () => {
    // 핸드오프 이름을 그대로 쓴다. 우리 이름으로 바꾸면 디자인을 보며 매번 번역해야 한다.
    const tokens = readFileSync(join(ROOT, 'packages/ui/src/typography.ts'), 'utf8');

    expect(tokens).toContain('t6: 16');
    expect(tokens).toContain('t7: 14');
    expect(tokens).toContain('t2: 26');
  });

  it('화면이 글자 크기를 직접 적지 않는다', () => {
    /* `fontSize: 15` 처럼 숫자를 바로 적은 자리만 잡는다. 토큰 참조는 통과한다. */
    expect(offenders(/fontSize:\s*\d/)).toEqual([]);
  });

  it('줄 높이도 직접 적지 않는다', () => {
    expect(offenders(/lineHeight:\s*\d/)).toEqual([]);
  });

  it('웹이 앱과 같은 스케일을 쓴다', () => {
    /*
     * 랜딩은 번들러 없이 문서에 통째로 실려서 tokens.css를 import할 수 없다.
     * 그래서 값을 옮겨 적는데, 옮겨 적은 값은 갈라진다 — 나란히 놓고 보기
     * 전까지 아무도 모른다. 그 갈라짐을 여기서 잡는다.
     */
    const scale = readFileSync(join(ROOT, 'packages/ui/src/typography.ts'), 'utf8');
    const web = readFileSync(join(ROOT, 'apps/web/src/styles.ts'), 'utf8');
    const css = readFileSync(join(ROOT, 'packages/ui/src/tokens.css'), 'utf8');

    for (const token of ['t1', 't2', 't4', 't5', 't6', 't7', 'badge', 'amount']) {
      const size = scale.match(new RegExp(`${token}: (\\d+)`))?.[1];

      expect({ token, size }).toEqual({ token, size: expect.any(String) });
      expect(web).toContain(`--text-${token}: ${size}px;`);
      expect(css).toContain(`--text-${token}: ${size}px;`);
    }
  });

  it('웹도 글자 크기를 직접 적지 않는다', () => {
    const web = readFileSync(join(ROOT, 'apps/web/src/styles.ts'), 'utf8');
    const raw = web
      .split('\n')
      .map((line, index) => [line, index + 1] as const)
      /* 토큰을 정의하는 줄(`--text-t6: 15px`)은 숫자를 들고 있어야 한다. */
      .filter(([line]) => /font-size:\s*[\d.]/.test(line))
      .map(([line, at]) => `apps/web/src/styles.ts:${at} ${line.trim()}`);

    expect(raw).toEqual([]);
  });
});

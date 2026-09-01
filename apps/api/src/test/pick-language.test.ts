import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * 사용자 앱에 `결제`가 다시 들어오는 것을 막는다. 통합정책 v3.11 §1.
 *
 * v3.11이 사용자 앱 일반 UI에서 `결제`와 파생 표현을 전면 금지하고 `Pick 인증`
 * 체계로 통일했다. 한 번 고치는 것으로는 안 지켜진다 — 다음에 화면을 만드는
 * 사람은 정책을 안 읽고, `결제 금액`이라고 적는 것이 자연스럽다.
 *
 * 그래서 저장소를 훑는다. 주석과 내부 코드는 건드리지 않고, **화면에 나가는
 * 문자열만** 본다.
 */

/**
 * 예외 영역. 정책이 직접 정했다(v3.11 §1).
 *
 * 약관·개인정보처리방침·FAQ·고객지원·법적 고지는 **사실관계를 정확히 설명해야
 * 하는 자리**다. 거기서 `Pick 인증`이라고만 적으면 무엇에 동의하는지 알 수 없다.
 *
 * 내부 영역(관리자·DB·API·개발문서)도 기술용어를 그대로 쓴다. 파일 경로로 가른다 —
 * "이 파일은 예외"라고 코드에 표시를 남기면 그 표시가 조용히 늘어난다.
 */
const EXEMPT = [
  /* 약관·방침·FAQ·법적 고지 */
  'packages/domain/src/faq.ts',
  'packages/domain/src/policies.ts',
  'packages/domain/src/consumer-standards.ts',
  'packages/domain/src/withdrawal.ts',
  /* 금지어 목록 자신. 무엇을 막는지 적으려면 그 말을 적어야 한다. */
  'packages/domain/src/pick-verification.ts',
  /* 내부 — 관리자·서버·DB·분석 */
  'apps/api/',
  'packages/db/',
  'apps/web/',
  /* 운영 비용 표. 관리자만 본다 — 어느 파이프라인인지 정확해야 한다. */
  'packages/domain/src/ai-cost.ts',
];

/**
 * 줄 단위 예외 표시.
 *
 * 파일째 빼면 그 파일의 다른 문구가 조용히 옛말로 돌아간다. 줄마다 이유를 적게
 * 하면 리뷰에서 그 이유를 볼 수 있다.
 */
const LINE_EXEMPTION = 'pick-language:';

/**
 * 화면에 나가는 문자열만 고른다.
 *
 * 주석은 뺀다 — 규칙을 설명하려면 그 말을 적어야 하고, 막으면 왜 막았는지 적을
 * 수 없게 된다. 여러 줄 주석은 **여는 줄만 보고는 못 가른다.** 둘째 줄부터는
 * 그냥 글이라, 열림·닫힘을 따라가며 센다.
 */
function userFacingLines(text: string, word: RegExp): { line: string; at: number }[] {
  const found: { line: string; at: number }[] = [];
  let inBlock = false;

  text.split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    const opens = line.includes('/*');
    const closes = line.includes('*/');

    if (inBlock) {
      if (closes) inBlock = false;

      return;
    }

    if (opens && !closes) {
      inBlock = true;

      return;
    }

    if (trimmed.startsWith('//') || opens) return;

    /*
     * 줄에 `pick-language:` 표시가 있으면 뺀다. 실제 서류 이름을 골라야 하는
     * 자리처럼, 그 말이 아니면 뜻이 통하지 않는 곳이 있다. 파일째 빼지 않고
     * 줄마다 이유를 적게 해서 예외가 조용히 늘어나지 않게 한다.
     */
    if (line.includes(LINE_EXEMPTION)) return;

    const inString = new RegExp(`['"\`][^'"\`]*(${word.source})`).test(line);
    const inJsxText = new RegExp(`>[^<]*(${word.source})[^<]*<`).test(line);

    if (inString || inJsxText) found.push({ line, at: index + 1 });
  });

  return found;
}

function sourceFiles(): string[] {
  const out = execSync(
    "git ls-files 'packages/**/*.ts' 'packages/**/*.tsx' 'apps/mobile/**/*.ts' 'apps/mobile/**/*.tsx'",
    { cwd: ROOT, encoding: 'utf8' }
  );

  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((path) => !path.includes('.test.'))
    .filter((path) => !EXEMPT.some((exempt) => path.startsWith(exempt)));
}

function scan(word: RegExp): string[] {
  const offenders: string[] = [];

  for (const path of sourceFiles()) {
    for (const { line, at } of userFacingLines(readFileSync(join(ROOT, path), 'utf8'), word)) {
      offenders.push(`${path}:${at} ${line.trim()}`);
    }
  }

  return offenders;
}

describe('사용자 앱 Pick 언어', () => {
  it('화면에 나가는 말에 결제가 없다', () => {
    expect(scan(/결제/)).toEqual([]);
  });

  it('화면에 나가는 말에 견적·계약서가 없다', () => {
    /*
     * v3.12가 더한 금지다. 사용자가 올리는 것은 `Pick 인증 자료`이고, 그것이
     * 견적서인지 계약서인지는 우리가 읽어서 아는 일이지 사용자가 골라 말할 일이 아니다.
     */
    expect(scan(/견적|계약서/)).toEqual([]);
  });

  it('예외 영역은 결제를 그대로 쓴다', () => {
    /*
     * FAQ가 `Pick 인증 자료를 올리시면`이라고만 적으면 무엇을 올리라는 건지
     * 모른다. 예외가 실제로 열려 있는지 여기서 확인한다 — 열려 있지 않으면
     * 위 시험이 지나치게 넓게 잡고 있다는 뜻이다.
     */
    const faq = readFileSync(join(ROOT, 'packages/domain/src/faq.ts'), 'utf8');

    expect(faq).toContain('결제');
  });

  it('Pick 인증 어휘가 한 곳에 있다', () => {
    const vocabulary = readFileSync(
      join(ROOT, 'packages/domain/src/pick-verification.ts'),
      'utf8'
    );

    for (const word of ['Pick 인증', 'Pick 가격', 'Pick 가격대', 'Pick 인증 자료']) {
      expect(vocabulary).toContain(word);
    }
  });
});

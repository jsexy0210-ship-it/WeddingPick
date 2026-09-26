#!/usr/bin/env node
/**
 * 웨딩픽 카피 린트
 *
 *   node lint-copy.js <path...>
 *
 * spec/glossary.json 의 banned 목록을 사용자 노출 문자열에서 찾는다.
 * 하나라도 걸리면 exit 1 — CI에서 빌드를 실패시킨다.
 *
 * 검사 대상: .swift .kt .kts .dart .tsx .ts .jsx .js .json .webmanifest .xml .strings .html
 * 제외: 관리자 · 내부 문서 · 테스트 · node_modules · build 산출물
 */

const fs = require('fs');
const path = require('path');

const GLOSSARY = path.join(__dirname, 'spec', 'glossary.json');
const g = JSON.parse(fs.readFileSync(GLOSSARY, 'utf8'));

const EXT = /\.(swift|kt|kts|dart|tsx?|jsx?|json|webmanifest|xml|strings|html)$/i;
const SKIP_DIR = /(^|\/)(node_modules|build|dist|\.git|Pods|\.gradle|__snapshots__)(\/|$)/;
/**
 * 검사하지 않는 파일.
 *
 * **2026-09-16에 `admin` · `Admin` · `관리자`를 여기서 뺐다.** 2026-09-11 대표 지시
 * 「전체 메뉴명과 세부 명칭은 AI식 단어를 쓰지 않고, 한국식 토스식 용어를 사용한다」가
 * 금지어를 관리자 화면까지 넓혔는데 **이 줄이 그 전 범위로 남아 있었다.**
 *
 * 그래서 관리자 화면의 금지어 여덟 건이 «카피 린트 통과»를 받은 채 main에 올라가 있었다.
 * 통합할 때마다 「카피 린트 통과」라고 적었고 그 말은 맞았다 — **검사가 그 파일들을
 * 열어보지도 않았을 뿐이다.** 규칙을 넓히면서 그것을 세는 자리를 같이 넓히지 않으면
 * 이렇게 된다.
 */
const SKIP_FILE = /(internal|test|Test|spec\/|\.d\.ts$|glossary\.json$)/;

/**
 * 검사하지 않는 자리. **`pick-language.test.ts`의 `EXEMPT`와 같은 목록이다** —
 * 두 게이트가 다른 범위를 보면 한쪽만 통과하는 문구가 생긴다.
 *
 * 약관·방침·FAQ는 사실관계를 정확히 적어야 하는 자리이고, 서버·DB·웹·비용표는
 * 사용자가 보지 않는 내부다. 금지어 목록 자신도 뺀다 — 무엇을 막는지 적으려면
 * 그 말을 적어야 한다.
 */
const EXEMPT_PATHS = [
  'packages/domain/src/faq.ts',
  'packages/domain/src/policies.ts',
  'packages/domain/src/consumer-standards.ts',
  'packages/domain/src/withdrawal.ts',
  'packages/domain/src/pick-verification.ts',
  'packages/domain/src/copy-rules.ts',
  'packages/domain/src/ai-cost.ts',
  /* 관리자·운영 화면 문구. 정책 문서와 같은 말을 써야 눈으로 맞춰볼 수 있다. */
  'packages/domain/src/advertising.ts',
  'packages/domain/src/pii-review.ts',
  'apps/api/',
  'packages/db/',
  'apps/web/',
];

/**
 * 줄에 이 표시가 있으면 뺀다.
 *
 * `pick-language:`는 `pick-language.test.ts`와 같은 표시다 — 실제 서류 이름을
 * 골라야 하는 자리. `lint-copy:`는 이 게이트만의 예외이고, 둘 다 **이유를 함께
 * 적게 한다** — 표시만 남으면 다음 사람이 복사해 붙인다.
 */
const LINE_EXEMPTIONS = ['pick-language:', 'lint-copy:'];

function isExemptPath(file) {
  const rel = path.relative(process.cwd(), file).replaceAll('\\', '/');

  return EXEMPT_PATHS.some((prefix) => rel.startsWith(prefix));
}

// 사용자에게 보이지 않는 줄은 건너뛴다
const IGNORE_LINE = [
  /^\s*(\/\/|\/\*|\*|#)/,                    // 주석
  /^\s*\{\/\*/,                             // JSX 블록 주석
  /^\s*import\s/,
  /\b(apiPath|endpoint|columnName|dbField|tableName)\b/i,
];

let findings = [];

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  let inBlockComment = false;

  lines.forEach((line, i) => {
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      return;
    }
    if (/^\s*(?:\/\*|\{\/\*)/.test(line)) {
      const start = line.indexOf('/*');
      if (start >= 0 && !line.includes('*/', start + 2)) inBlockComment = true;
      return;
    }
    if (IGNORE_LINE.some((re) => re.test(line))) return;
    if (LINE_EXEMPTIONS.some((mark) => line.includes(mark))) return;

    for (const b of g.banned) {
      // 한글 단어 경계가 없으므로 단순 포함 검사 + 예외 처리
      if (!line.includes(b.term)) continue;
      if (isExempt(line, b)) continue;
      // "AI"는 대문자 두 글자라 오탐이 잦다 — 앞뒤가 영문자면 건너뛴다
      if (b.term === 'AI' && /[A-Za-z]AI|AI[A-Za-z]/.test(line)) continue;

      findings.push({
        file: path.relative(process.cwd(), file),
        line: i + 1,
        term: b.term,
        use: b.use,
        text: line.trim().slice(0, 100),
      });
    }
  });
}

/**
 * 그 줄에 허용된 말이 들어 있으면 넘어간다. 법령·기관 고유명사(«공정거래위원회» ·
 * «공공데이터»)와 금지어를 설명하는 문장이 여기 해당한다.
 *
 * **목록은 `spec/glossary.json`의 `allow` 하나다.** 2026-09-16까지는 이 함수가 목록을
 * 따로 들고 있었고 **용어집의 `allow`를 아무도 안 읽었다** — 그래서 용어집에 «공공데이터»가
 * 허용으로 적혀 있는데도 화면에서 걸렸고, 반대로 린터만 아는 «별점 대신»은 용어집에
 * 없었다. 두 곳에 적으면 반드시 갈린다.
 */
function isExempt(line, b) {
  return !maskAllowed(line, b).includes(b.term);
}

/**
 * 허용된 말을 같은 길이의 자리표시자로 덮는다 — **그 낱말만 풀고 줄 전체는 풀지 않는다.**
 *
 * 2026-09-26 대표 지시로 업체 상세의 정보 출처를 「공공데이터」로 적는다. `데이터`는 그대로
 * 금지어라, 전처럼 «허용된 말이 줄에 있으면 줄째 통과»로 두면 `공공데이터 · 데이터 많은 순`
 * 같은 줄의 뒤쪽 `데이터`까지 함께 빠진다. `copy-rules.ts`의 `maskExempt`와 같은 방식이다.
 */
function maskAllowed(line, b) {
  return (b.allow ?? []).reduce(
    (masked, phrase) => masked.split(phrase).join('\u0000'.repeat(phrase.length)),
    line
  );
}

function walk(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    if (SKIP_DIR.test(target.replaceAll('\\', '/'))) return;
    for (const name of fs.readdirSync(target)) walk(path.join(target, name));
  } else if (EXT.test(target) && !SKIP_FILE.test(target) && !isExemptPath(target)) {
    scanFile(target);
  }
}

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error('usage: node lint-copy.js <path...>');
  process.exit(2);
}
targets.forEach(walk);

if (!findings.length) {
  console.log('카피 린트 통과 — 금지어 없음');
  process.exit(0);
}

console.error(`\n금지어 ${findings.length}건\n`);
const byTerm = {};
findings.forEach((f) => (byTerm[f.term] = byTerm[f.term] || []).push(f));

for (const [term, list] of Object.entries(byTerm)) {
  const use = list[0].use;
  console.error(`  «${term}» → «${use}»  ${list.length}건`);
  list.slice(0, 8).forEach((f) => console.error(`      ${f.file}:${f.line}  ${f.text}`));
  if (list.length > 8) console.error(`      … +${list.length - 8}건`);
  console.error('');
}

console.error('spec/glossary.json 의 대체 표현을 쓰세요.\n');
process.exit(1);

#!/usr/bin/env node
/**
 * 제미나이는 상담 녹음 인식과 결제 증빙 OCR에만 쓴다. 그 밖에서 `callGemini`를
 * 부르면 대표 지시 위반이다(2026-09-15 — 「제미나이는 녹음파일 인식, OCR 확인
 * 외 절대 사용금지다」, `CLAUDE.md` 커밋 `94ca7c62`).
 *
 * **글로만 적힌 규칙은 또 깨진다.** 웨딩피드 자동 작성이 실제로 제미나이로
 * 붙었다가 되돌아온 적이 있다 — 이번엔 CI가 잡는다.
 *
 * `apps/api/src/analysis/gemini-call.ts`(`callGemini` 정의)를 부르는(=
 * import하는) 파일이 아래 허용 목록 밖에 있으면 실패한다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SCAN_DIR = path.join(ROOT, 'apps/api/src');

/** 허용 목록. 늘리려면 대표 확인이 먼저다 — 여기 추가하는 것으로 규칙이 풀린다. */
const ALLOWED = new Set([
  'apps/api/src/analysis/gemini-visit-note-reader.ts',
  'apps/api/src/analysis/consultation-reader.ts',
  'apps/api/src/analysis/gemini-payment-reader.ts',
]);

const IMPORT_PATTERN = /from\s+['"][^'"]*gemini-call['"]/;

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      walk(full, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      out.push(full);
    }
  }

  return out;
}

const violations = [];

for (const file of walk(SCAN_DIR, [])) {
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');

  if (rel === 'apps/api/src/analysis/gemini-call.ts') continue; // 정의 자체

  const text = fs.readFileSync(file, 'utf8');

  if (IMPORT_PATTERN.test(text) && !ALLOWED.has(rel)) {
    violations.push(rel);
  }
}

if (violations.length === 0) {
  console.log('제미나이 사용 범위 검사 통과 — 녹음 · OCR 세 자리 밖에서 부르지 않음');
  process.exit(0);
}

console.error(`\n제미나이 사용 범위 위반 ${violations.length}건\n`);
violations.forEach((f) => console.error(`  ${f}`));
console.error(
  '\n제미나이는 상담 녹음 인식과 결제 증빙 OCR에만 쓴다. 그 밖은 클로드다' +
    '(CLAUDE.md 2026-09-15 대표 지시). 허용 목록은 lint-gemini-scope.js의 ALLOWED다.\n'
);
process.exit(1);

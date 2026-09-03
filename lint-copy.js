#!/usr/bin/env node
/**
 * 웨딩픽 카피 린트
 *
 *   node lint-copy.js <path...>
 *
 * spec/glossary.json 의 banned 목록을 사용자 노출 문자열에서 찾는다.
 * 하나라도 걸리면 exit 1 — CI에서 빌드를 실패시킨다.
 *
 * 검사 대상: .swift .kt .kts .dart .tsx .ts .jsx .js .json .xml .strings .html
 * 제외: 관리자 · 내부 문서 · 테스트 · node_modules · build 산출물
 */

const fs = require('fs');
const path = require('path');

const GLOSSARY = path.join(__dirname, 'spec', 'glossary.json');
const g = JSON.parse(fs.readFileSync(GLOSSARY, 'utf8'));

const EXT = /\.(swift|kt|kts|dart|tsx?|jsx?|json|xml|strings|html)$/i;
const SKIP_DIR = /(^|\/)(node_modules|build|dist|\.git|Pods|\.gradle|__snapshots__)(\/|$)/;
const SKIP_FILE = /(admin|Admin|관리자|internal|test|Test|spec\/|\.d\.ts$|glossary\.json$)/;

// 사용자에게 보이지 않는 줄은 건너뛴다
const IGNORE_LINE = [
  /^\s*(\/\/|\/\*|\*|#)/,                    // 주석
  /^\s*import\s/,
  /\b(apiPath|endpoint|columnName|dbField|tableName)\b/i,
];

let findings = [];

function scanFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');

  lines.forEach((line, i) => {
    if (IGNORE_LINE.some((re) => re.test(line))) return;

    for (const b of g.banned) {
      // 한글 단어 경계가 없으므로 단순 포함 검사 + 예외 처리
      if (!line.includes(b.term)) continue;
      if (b.note && b.note.includes('예외') && isExempt(line, b)) continue;
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

function isExempt(line, b) {
  const exemptPhrases = {
    '중앙값': '확인된 정보의 중앙값이에요',
    '별점': '별점 대신',
    '둘러보기': '둘러보기',
  };
  const p = exemptPhrases[b.term];
  return p ? line.includes(p) : false;
}

function walk(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    if (SKIP_DIR.test(target)) return;
    for (const name of fs.readdirSync(target)) walk(path.join(target, name));
  } else if (EXT.test(target) && !SKIP_FILE.test(target)) {
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

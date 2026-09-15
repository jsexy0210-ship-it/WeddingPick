#!/usr/bin/env node
// 시험 무력화 감시용 정적 스캐너. 손으로 다시 세지 않으려고 둔다.
// 세는 것: 워크스페이스별 시험 파일/블록 수, skip·only·todo 자리,
// 단언이 없는 it(), 조건부 skip이 무엇에 걸려 있는지.
// 코드를 고치지 않는다. 재기만 한다.
//
// 한계 — 아는 채로 둔다: balanced()가 정규식 리터럴을 문자열로 착각한다.
// 따옴표를 담은 정규식(`/content="([^"]*)"/`)이 든 it() 블록은 본문이 잘려
// «단언 없음»으로 잘못 걸린다. 2026-09-15 기준 이런 오탐은
// apps/web/src/site.test.ts:337 하나뿐이고 손으로 확인해 expect 3개가 있다.
// «단언 없음»으로 걸린 자리는 세지 말고 하나씩 눈으로 확인한다.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['apps', 'packages'];
const TEST_RE = /\.test\.tsx?$/;

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.git' || e === 'dist' || e === 'build') continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (TEST_RE.test(e)) out.push(p);
  }
  return out;
}

// it(...) / test(...) 블록을 중괄호 균형으로 잘라낸다.
function balanced(src, openIdx) {
  // openIdx는 '(' 위치. 짝이 맞는 ')' 인덱스를 준다. 문자열/템플릿/주석을 건너뛴다.
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') { i++; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      for (i++; i < src.length; i++) {
        if (src[i] === '\\') { i++; continue; }
        if (src[i] === q) break;
      }
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i); if (i < 0) return -1; i++; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// it(...) / test(...) 블록을 잘라낸다. `.each(table)(name, fn)`는 두 번째 호출이 본문이다.
function blocks(src) {
  const found = [];
  // `.test(` 는 RegExp.prototype.test 다 — 앞에 점이 오면 시험 블록이 아니다.
  const re = /(?<![.\w$])(it|test)\s*(?:\.\s*(each|skip|only|todo|failing|concurrent))?\s*[(`]/g;
  let m;
  while ((m = re.exec(src))) {
    const modifier = m[2] || null;
    const start = m.index;
    let open = re.lastIndex - 1;
    if (src[open] === '`') {
      // it.each`table`(name, fn) — 템플릿 테이블을 건너뛴다.
      let i = open + 1;
      for (; i < src.length; i++) { if (src[i] === '\\') { i++; continue; } if (src[i] === '`') break; }
      open = src.indexOf('(', i);
      if (open < 0) continue;
    } else if (modifier === 'each') {
      const close = balanced(src, open);
      if (close < 0) continue;
      let j = close + 1;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] !== '(') continue;
      open = j;
    }
    const end = balanced(src, open);
    if (end < 0) continue;
    found.push({ modifier, body: src.slice(open + 1, end), index: start });
    re.lastIndex = Math.max(re.lastIndex, end);
  }
  return found;
}

const ASSERT_RE = /\bexpect\s*\(|\bassert\b|\.toMatchSnapshot\(|\btoThrow\b|expect\./;
const WEAK_RE = /toBeDefined\(\)|toBeTruthy\(\)|expect\.any\(|toBeUndefined\(\)|not\.toBeNull\(\)/g;

const report = { workspaces: {}, markers: [], noAssertion: [], conditional: [], totals: {} };

for (const root of ROOTS) {
  for (const ws of readdirSync(root)) {
    const dir = join(root, ws);
    if (!statSync(dir).isDirectory()) continue;
    const files = walk(dir);
    if (!files.length) { report.workspaces[dir] = { files: 0, blocks: 0, weak: 0 }; continue; }
    let nBlocks = 0, nWeak = 0;
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const bs = blocks(src);
      nBlocks += bs.length;
      nWeak += (src.match(WEAK_RE) || []).length;
      for (const b of bs) {
        if (b.modifier && ['skip', 'only', 'todo', 'failing'].includes(b.modifier)) {
          report.markers.push({ file: f, kind: `${b.modifier}`, line: src.slice(0, b.index).split('\n').length });
        }
        if (b.modifier !== 'todo' && !ASSERT_RE.test(b.body)) {
          report.noAssertion.push({ file: f, line: src.slice(0, b.index).split('\n').length, head: b.body.slice(0, 70).replace(/\s+/g, ' ') });
        }
      }
      // describe 레벨 marker + 조건부 skip
      for (const mm of src.matchAll(/\bdescribe\s*\.\s*(skip|only|todo)\s*\(/g)) {
        report.markers.push({ file: f, kind: `describe.${mm[1]}`, line: src.slice(0, mm.index).split('\n').length });
      }
      for (const mm of src.matchAll(/\b(x(?:it|describe))\s*\(/g)) {
        report.markers.push({ file: f, kind: mm[1], line: src.slice(0, mm.index).split('\n').length });
      }
      for (const mm of src.matchAll(/const\s+(\w+)\s*=\s*([^\n;]*?)\s*\?\s*describe\s*:\s*describe\.skip/g)) {
        report.conditional.push({ file: f, alias: mm[1], gate: mm[2].trim(), line: src.slice(0, mm.index).split('\n').length });
      }
    }
    report.workspaces[dir] = { files: files.length, blocks: nBlocks, weak: nWeak };
  }
}

report.totals = {
  files: Object.values(report.workspaces).reduce((a, w) => a + w.files, 0),
  blocks: Object.values(report.workspaces).reduce((a, w) => a + w.blocks, 0),
  markers: report.markers.length,
  noAssertion: report.noAssertion.length,
  conditional: report.conditional.length,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('워크스페이스별 (정적 계수 — it.each는 1로 센다)');
  for (const [k, v] of Object.entries(report.workspaces)) {
    console.log(`  ${k.padEnd(24)} 파일 ${String(v.files).padStart(3)}  블록 ${String(v.blocks).padStart(4)}  약한단언 ${v.weak}`);
  }
  console.log(`\n합계: 파일 ${report.totals.files} / 블록 ${report.totals.blocks}`);
  console.log(`skip·only·todo·xit 자리: ${report.totals.markers}`);
  for (const m of report.markers) console.log(`  ${m.kind}  ${m.file}:${m.line}`);
  console.log(`\n조건부 skip (환경에 따라 통째로 빠지는 묶음): ${report.totals.conditional}`);
  const byGate = {};
  for (const c of report.conditional) (byGate[c.gate] ||= []).push(c.file);
  for (const [g, fs] of Object.entries(byGate)) console.log(`  [${g}] ${fs.length}개 파일`);
  console.log(`\n단언이 없는 it(): ${report.totals.noAssertion}`);
  for (const n of report.noAssertion) console.log(`  ${n.file}:${n.line}  ${n.head}`);
}

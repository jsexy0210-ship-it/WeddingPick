#!/usr/bin/env node
// WeddingPick 공정률 — 매일 오전 브리핑의 근거를 만든다.
//
// 원칙 하나: 숫자를 만들어내지 않는다.
// - 모든 비율에 분모(모수)와 근거를 함께 낸다.
// - 재지 못한 항목은 0%가 아니라 `미측정`으로 적고 가중치에서 뺀다. 재지 못한 것을
//   0으로 세면 공정률이 실제보다 낮게 나오고, 100으로 세면 없는 진척을 만든다.
// - 바깥에서 와야 하는 값(결정 필요)은 공정률에 넣지 않고 따로 센다. 코드로 닫을 수
//   없는 항목이라 공정률에 섞으면 우리가 못 움직이는 것을 우리 진도로 읽게 된다.
//
// 사용법:
//   node scripts/progress.mjs                          오늘 브리핑 (터미널)
//   node scripts/progress.mjs --checks                 타입체크·린트·테스트까지 돌려서 측정
//   node scripts/progress.mjs --format markdown        붙여넣기용
//   node scripts/progress.mjs --format json            기계용
//   node scripts/progress.mjs --compare "7 days ago"   비교 시점 지정 (기본 1 day ago)
//   node scripts/progress.mjs --no-compare             비교 없이 오늘만

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'scripts/progress.config.json'), 'utf8'));
const SEP = '\u001f'; // 커밋 한 줄을 자를 구분자 — 제목 글자와 섞이지 않는 제어문자

// ── 인자 ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = { format: 'text', compare: '1 day ago', checks: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--checks') opts.checks = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--no-compare') opts.compare = null;
    else if (arg === '--format') opts.format = argv[++i];
    else if (arg.startsWith('--format=')) opts.format = arg.slice('--format='.length);
    else if (arg === '--compare') opts.compare = argv[++i];
    else if (arg.startsWith('--compare=')) opts.compare = arg.slice('--compare='.length);
    else throw new Error(`모르는 인자: ${arg}`);
  }
  if (!['text', 'markdown', 'json'].includes(opts.format)) {
    throw new Error(`--format 은 text · markdown · json 중 하나다 (받은 값: ${opts.format})`);
  }
  return opts;
}

// ── git ─────────────────────────────────────────────────────────────────────
function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 32 * 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
}

// rev 가 null 이면 작업 트리를, 아니면 그 커밋의 내용을 읽는다.
// 같은 계산기를 과거 커밋에 그대로 돌릴 수 있어야 어제와 오늘을 견줄 수 있다.
function readerFor(rev) {
  return (path) => {
    if (rev === null) {
      const full = join(ROOT, path);
      return existsSync(full) ? readFileSync(full, 'utf8') : null;
    }
    return git(['show', `${rev}:${path}`]);
  };
}

function resolveCompareRev(spec) {
  if (!spec) return null;
  // 커밋처럼 생겼으면 그대로, 아니면 '그 시점 이전의 마지막 커밋'으로 푼다.
  const direct = git(['rev-parse', '--verify', '--quiet', `${spec}^{commit}`]);
  if (direct) return direct;
  return git(['rev-list', '-1', `--before=${spec}`, 'HEAD']);
}

// ── 문서 파싱 ───────────────────────────────────────────────────────────────
// `## N. 제목` 단위로 자른다. `### ` 는 세 번째 글자가 '#' 이라 걸리지 않는다.
function splitSections(src) {
  const heads = [...src.matchAll(/^## (.+)$/gm)];
  return heads.map((head, i) => {
    const start = head.index + head[0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index : src.length;
    const title = head[1].trim();
    const num = /^(\d+)\./.exec(title);
    return { number: num ? Number(num[1]) : null, title, body: src.slice(start, end) };
  });
}

// `### 아직 없는 것` 블록의 최상위 불릿을 남은 항목으로 센다.
// 이 문서의 약속이다 — 각 절이 못 한 것을 그 블록에 적는다.
function openItemsIn(body) {
  const items = [];
  const re = /^### 아직 없는 것[^\n]*\n([\s\S]*?)(?=^#{2,3} |$(?![\s\S]))/gm;
  for (const block of body.matchAll(re)) {
    for (const line of block[1].split('\n')) {
      const bullet = /^- (.+)$/.exec(line);
      if (bullet) items.push(bullet[1].trim());
    }
  }
  return items;
}

function stripMd(text) {
  return text
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function clip(text, max) {
  const t = stripMd(text);
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

// ── 공정 항목 측정 ──────────────────────────────────────────────────────────
// 각 측정은 { done, total, unit, detail } 또는 재지 못했으면 null 을 낸다.

function measureScreens(read) {
  const src = read(CONFIG.specPath);
  if (src == null) return null;
  const rows = [...src.matchAll(/^\|\s*(A-\d+)\s*(✅)?\s*\|(.*)\|\s*(\d)\s*\|\s*$/gm)];
  if (rows.length === 0) return null;
  const screens = rows.map((r) => ({
    id: r[1],
    done: Boolean(r[2]),
    phase: Number(r[4]),
    title: stripMd(r[3].split('|')[0] ?? ''),
  }));
  const byPhase = new Map();
  for (const s of screens) {
    const bucket = byPhase.get(s.phase) ?? { done: 0, total: 0 };
    bucket.total += 1;
    if (s.done) bucket.done += 1;
    byPhase.set(s.phase, bucket);
  }
  return {
    done: screens.filter((s) => s.done).length,
    total: screens.length,
    unit: '화면',
    detail: {
      pending: screens.filter((s) => !s.done).map((s) => `${s.id} ${s.title}`),
      phases: [...byPhase.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([phase, v]) => ({ phase, ...v })),
    },
  };
}

function measureOpenQuestions(read) {
  const src = read(CONFIG.specPath);
  if (src == null) return null;
  const section = splitSections(src).find((s) => s.title.includes('열린 질문'));
  if (!section) return null;
  const boxes = [...section.body.matchAll(/^- \[([ xX])\] (.+)$/gm)];
  if (boxes.length === 0) return null;
  return {
    done: boxes.filter((b) => b[1].toLowerCase() === 'x').length,
    total: boxes.length,
    unit: '질문',
    detail: { pending: boxes.filter((b) => b[1] === ' ').map((b) => stripMd(b[2])) },
  };
}

function measureSpecSections(read) {
  const src = read(CONFIG.specPath);
  if (src == null) return null;
  const sections = splitSections(src).filter((s) => s.number !== null);
  if (sections.length === 0) return null;
  const withGaps = sections
    .map((s) => ({ section: s, open: openItemsIn(s.body) }))
    .filter((s) => s.open.length > 0);
  return {
    done: sections.length - withGaps.length,
    total: sections.length,
    unit: '절',
    detail: {
      openCount: withGaps.reduce((n, s) => n + s.open.length, 0),
      sections: withGaps.map((s) => ({
        title: s.section.title,
        items: s.open.map((i) => clip(i, 90)),
      })),
    },
  };
}

// 코드 게이트만 저장소 상태가 아니라 실행 결과다. 과거 커밋에는 돌리지 않는다.
function measureCodeGates(read, { run }) {
  if (!run) return null;
  const gates = [
    { name: 'typecheck', argv: ['run', 'typecheck'] },
    { name: 'lint', argv: ['run', 'lint'] },
    { name: 'test', argv: ['test'] },
  ];
  const results = gates.map((gate) => {
    try {
      execFileSync('npm', gate.argv, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'ignore',
        timeout: 20 * 60 * 1000,
      });
      return { ...gate, pass: true };
    } catch {
      return { ...gate, pass: false };
    }
  });
  return {
    done: results.filter((r) => r.pass).length,
    total: results.length,
    unit: '게이트',
    detail: { failed: results.filter((r) => !r.pass).map((r) => r.name) },
  };
}

const MEASURERS = {
  screens: measureScreens,
  openQuestions: measureOpenQuestions,
  specSections: measureSpecSections,
  codeGates: measureCodeGates,
};

function measure(rev, { runChecks }) {
  const read = readerFor(rev);
  const items = CONFIG.items.map((item) => {
    const measured = MEASURERS[item.key]?.(read, { run: runChecks && rev === null }) ?? null;
    return {
      ...item,
      measured: measured !== null,
      done: measured?.done ?? null,
      total: measured?.total ?? null,
      unit: measured?.unit ?? null,
      rate: measured && measured.total > 0 ? measured.done / measured.total : null,
      detail: measured?.detail ?? null,
    };
  });
  const counted = items.filter((i) => i.rate !== null);
  const weightSum = counted.reduce((n, i) => n + i.weight, 0);
  return {
    rev: rev ?? git(['rev-parse', 'HEAD']),
    items,
    overall: weightSum > 0
      ? counted.reduce((n, i) => n + i.rate * i.weight, 0) / weightSum
      : null,
    countedWeight: weightSum,
    totalWeight: CONFIG.items.reduce((n, i) => n + i.weight, 0),
  };
}

// ── 재고 — 비율이 아니라 개수다 ─────────────────────────────────────────────
// 분모(전체가 몇 개여야 하는지)를 모르는 것은 비율로 만들지 않는다. 대신 세어서
// 어제와 견준다. 문서가 안 움직인 날에도 코드가 움직였는지는 이 줄에 남는다.
function fileList(rev) {
  const out = rev === null
    ? git(['ls-files'])
    : git(['ls-tree', '-r', '--name-only', rev]);
  return out ? out.split('\n').filter(Boolean) : [];
}

function inventory(rev) {
  const files = fileList(rev);
  return (CONFIG.inventory ?? []).map((entry) => {
    const pattern = new RegExp(entry.pattern);
    const exclude = entry.exclude ? new RegExp(entry.exclude) : null;
    return {
      label: entry.label,
      count: files.filter((f) => pattern.test(f) && !(exclude && exclude.test(f))).length,
    };
  });
}

// ── 공정률에 넣지 않는 참고 정보 ────────────────────────────────────────────
function pendingDecisions(read) {
  const src = read(CONFIG.specPath);
  if (src == null) return [];
  const out = [];
  for (const section of splitSections(src)) {
    for (const line of section.body.split('\n')) {
      if (!line.includes('결정 필요')) continue;
      const text = clip(line.replace(/^[-*|\s]+/, ''), 100);
      if (text) out.push({ section: section.title, text });
    }
  }
  return out;
}

function recentCommits(sinceRev) {
  const args = ['log', '--no-merges', `--pretty=format:%h${SEP}%ad${SEP}%an${SEP}%s`, '--date=short'];
  if (sinceRev) args.push(`${sinceRev}..HEAD`);
  else args.push('-10');
  const out = git(args);
  if (!out) return [];
  return out.split('\n').filter(Boolean).map((line) => {
    const [hash, date, author, subject] = line.split(SEP);
    return { hash, date, author, subject };
  });
}

// ── 출력 ────────────────────────────────────────────────────────────────────
const pct = (rate) => (rate === null ? '미측정' : `${(rate * 100).toFixed(1)}%`);

function delta(now, before) {
  if (now === null || before === null || before === undefined) return null;
  return now - before;
}

function deltaText(d) {
  if (d === null) return '';
  if (Math.abs(d) < 0.0005) return '변화 없음';
  return `${d > 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(1)}%p`;
}

// 한글은 터미널에서 두 칸을 먹는다. padEnd 로만 맞추면 표가 어긋난다.
function width(text) {
  let n = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0);
    const wide = (c >= 0x1100 && c <= 0x115f)
      || (c >= 0x2e80 && c <= 0xa4cf)
      || (c >= 0xac00 && c <= 0xd7a3)
      || (c >= 0xf900 && c <= 0xfaff)
      || (c >= 0xfe30 && c <= 0xfe6f)
      || (c >= 0xff00 && c <= 0xff60)
      || (c >= 0xffe0 && c <= 0xffe6);
    n += wide ? 2 : 1;
  }
  return n;
}

const pad = (text, target) => text + ' '.repeat(Math.max(0, target - width(text)));

function header(today, before, compareSpec) {
  const stamp = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date());
  const head = today.rev ? today.rev.slice(0, 7) : '알 수 없음';
  return [
    `WeddingPick 공정률 브리핑 — ${stamp} (KST)`,
    before?.rev
      ? `기준 ${head} · 비교 ${before.rev.slice(0, 7)} (${compareSpec})`
      : `기준 ${head} · 비교 대상 없음 (${compareSpec ?? '비교 안 함'})`,
  ];
}

function renderText(report) {
  const { today, before, compareSpec, decisions, commits } = report;
  const out = [...header(today, before, compareSpec), ''];

  const overallDelta = delta(today.overall, before?.overall);
  const tail = overallDelta === null
    ? '견줄 자료 없음'
    : `직전 ${pct(before.overall)} · ${deltaText(overallDelta)}`;
  out.push(`전체 공정률  ${pct(today.overall)}   (${tail})`);
  if (today.countedWeight < today.totalWeight) {
    out.push(`             가중치 ${today.countedWeight}/${today.totalWeight} 만 재고 나눴다 — 미측정 항목은 0으로 세지 않는다`);
  }
  out.push('');

  for (const item of today.items) {
    const was = before?.items.find((i) => i.key === item.key);
    const count = item.measured ? `${item.done}/${item.total} ${item.unit}` : '—';
    out.push(`  ${pad(item.label, 16)}${pad(pct(item.rate), 9)}${pad(count, 16)}가중치 ${pad(String(item.weight), 4)}${deltaText(delta(item.rate, was?.rate ?? null))}`);
  }
  out.push('');

  const screens = today.items.find((i) => i.key === 'screens');
  if (screens?.detail?.phases?.length) {
    out.push(`  화면 단계별: ${screens.detail.phases.map((p) => `Phase ${p.phase} ${p.done}/${p.total}`).join(' · ')}`);
    if (screens.detail.pending.length) out.push(`  남은 화면: ${screens.detail.pending.join(', ')}`);
    out.push('');
  }

  const sections = today.items.find((i) => i.key === 'specSections');
  if (sections?.detail?.sections?.length) {
    out.push(`열려 있는 것 — ${sections.detail.sections.length}개 절에 ${sections.detail.openCount}건`);
    for (const s of sections.detail.sections) {
      out.push(`  · ${s.title}`);
      for (const item of s.items) out.push(`      - ${item}`);
    }
    out.push('');
  }

  const questions = today.items.find((i) => i.key === 'openQuestions');
  if (questions?.detail?.pending?.length) {
    out.push(`아직 답이 없는 질문 ${questions.detail.pending.length}건`);
    for (const q of questions.detail.pending) out.push(`  · ${clip(q, 100)}`);
    out.push('');
  }

  if (decisions.length) {
    out.push(`바깥에서 와야 하는 값 ${decisions.length}건 — 공정률에 넣지 않는다`);
    for (const d of decisions) out.push(`  · [${clip(d.section, 30)}] ${d.text}`);
    out.push('');
  }

  if (report.inventory.length) {
    out.push('재고 — 분모를 모르는 것은 비율로 내지 않고 센다');
    for (const row of report.inventory) {
      const was = report.inventoryBefore?.find((r) => r.label === row.label);
      const d = was ? row.count - was.count : null;
      const move = d === null || d === 0 ? '' : `  ${d > 0 ? '+' : '−'}${Math.abs(d)}`;
      out.push(`  ${pad(row.label, 20)}${pad(String(row.count), 6)}${move}`);
    }
    out.push('');
  }

  if (CONFIG.outOfScope?.length) {
    out.push('이 공정률이 재지 않는 것');
    for (const line of CONFIG.outOfScope) out.push(`  · ${line}`);
    out.push('');
  }

  const gates = today.items.find((i) => i.key === 'codeGates');
  if (!gates?.measured) {
    out.push('코드 게이트는 재지 않았다 — `npm run progress -- --checks` 로 타입체크·린트·테스트까지 돌린다.');
    out.push('');
  } else if (gates.detail.failed.length) {
    out.push(`코드 게이트 실패: ${gates.detail.failed.join(', ')}`);
    out.push('');
  }

  out.push(commits.length ? `그 사이 커밋 ${commits.length}건` : '그 사이 커밋 없음');
  for (const c of commits.slice(0, 10)) out.push(`  ${c.hash} ${c.date} ${c.author} — ${c.subject}`);
  if (commits.length > 10) out.push(`  … 외 ${commits.length - 10}건`);

  return out.join('\n');
}

function renderMarkdown(report) {
  const { today, before, compareSpec, decisions, commits } = report;
  const out = ['## 공정률 브리핑', '', ...header(today, before, compareSpec).map((l) => `${l}  `), ''];

  const overallDelta = delta(today.overall, before?.overall);
  out.push(`**전체 공정률 ${pct(today.overall)}** ${overallDelta === null ? '(견줄 자료 없음)' : `(직전 ${pct(before.overall)}, ${deltaText(overallDelta)})`}`);
  if (today.countedWeight < today.totalWeight) {
    out.push('', `> 가중치 ${today.countedWeight}/${today.totalWeight} 만 재고 나눴다. 재지 못한 항목은 0으로 세지 않고 분모에서 뺐다.`);
  }
  out.push('', '| 공정 | 비율 | 모수 | 가중치 | 직전 대비 | 근거 |', '|---|---|---|---|---|---|');
  for (const item of today.items) {
    const was = before?.items.find((i) => i.key === item.key);
    const count = item.measured ? `${item.done}/${item.total} ${item.unit}` : '—';
    out.push(`| ${item.label} | ${pct(item.rate)} | ${count} | ${item.weight} | ${deltaText(delta(item.rate, was?.rate ?? null)) || '—'} | ${item.basis} |`);
  }

  const sections = today.items.find((i) => i.key === 'specSections');
  if (sections?.detail?.sections?.length) {
    out.push('', `### 열려 있는 것 (${sections.detail.openCount}건)`, '');
    for (const s of sections.detail.sections) {
      out.push(`- **${s.title}**`);
      for (const item of s.items) out.push(`  - ${item}`);
    }
  }

  const questions = today.items.find((i) => i.key === 'openQuestions');
  if (questions?.detail?.pending?.length) {
    out.push('', `### 아직 답이 없는 질문 (${questions.detail.pending.length}건)`, '');
    for (const q of questions.detail.pending) out.push(`- ${clip(q, 120)}`);
  }

  if (decisions.length) {
    out.push('', `### 바깥에서 와야 하는 값 (${decisions.length}건 · 공정률에 넣지 않는다)`, '');
    for (const d of decisions) out.push(`- [${clip(d.section, 30)}] ${d.text}`);
  }

  if (report.inventory.length) {
    out.push('', '### 재고 (분모를 모르는 것은 비율로 내지 않고 센다)', '', '| 항목 | 개수 | 직전 대비 |', '|---|---|---|');
    for (const row of report.inventory) {
      const was = report.inventoryBefore?.find((r) => r.label === row.label);
      const d = was ? row.count - was.count : null;
      out.push(`| ${row.label} | ${row.count} | ${d === null || d === 0 ? '—' : `${d > 0 ? '+' : '−'}${Math.abs(d)}`} |`);
    }
  }

  if (CONFIG.outOfScope?.length) {
    out.push('', '### 이 공정률이 재지 않는 것', '');
    for (const line of CONFIG.outOfScope) out.push(`- ${line}`);
  }

  out.push('', `### 그 사이 커밋 (${commits.length}건)`, '');
  if (commits.length === 0) out.push('- 없음');
  for (const c of commits.slice(0, 20)) out.push(`- \`${c.hash}\` ${c.date} ${c.author} — ${c.subject}`);

  return out.join('\n');
}

// ── 실행 ────────────────────────────────────────────────────────────────────
function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8')
      .split('\n')
      .filter((l) => l.startsWith('//'))
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'));
    return 0;
  }

  const today = measure(null, { runChecks: opts.checks });
  const compareRev = resolveCompareRev(opts.compare);
  const sameCommit = compareRev !== null && compareRev === today.rev;
  const before = compareRev && !sameCommit ? measure(compareRev, { runChecks: false }) : null;

  const report = {
    generatedAt: new Date().toISOString(),
    compareSpec: sameCommit ? `${opts.compare} — 그 뒤로 새 커밋 없음` : opts.compare,
    today,
    before,
    decisions: pendingDecisions(readerFor(null)),
    commits: recentCommits(compareRev),
    inventory: inventory(null),
    inventoryBefore: before ? inventory(compareRev) : null,
  };

  if (opts.format === 'json') console.log(JSON.stringify(report, null, 2));
  else if (opts.format === 'markdown') console.log(renderMarkdown(report));
  else console.log(renderText(report));
  return 0;
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (error) {
  console.error(`공정률을 내지 못했다: ${error.message}`);
  process.exit(1);
}

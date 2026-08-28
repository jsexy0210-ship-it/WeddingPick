import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import type { DocumentPage } from './analysis/analyzer';
import { createClaudeAnalyzer } from './analysis/claude-analyzer';
import {
  checkNoPersonalInfoLeak,
  scoreCase,
  type Expected,
} from './analysis/eval-scoring';

/**
 * 실제 견적서로 추출 정확도를 잰다.
 *
 *   ANTHROPIC_API_KEY=... npm run analysis:eval --workspace @weddingpick/api
 *   ANTHROPIC_API_KEY=... npm run analysis:eval --workspace @weddingpick/api -- ./내견적서들
 *
 * 케이스 하나 = 문서 파일(.png/.jpg/.pdf) + 같은 이름의 `.expected.json`.
 * 기대값 파일이 없으면 채점하지 않고 추출 결과만 보여준다 — 실제 견적서를 처음 넣어볼 때
 * 그대로 쓰면 된다.
 *
 * **모델을 실제로 호출한다. 문서 한 장에 수십 원에서 수백 원이 든다.**
 */

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

/** claude-opus-5 기준. 비용 감각을 잡기 위한 것이다. */
const USD_PER_INPUT_TOKEN = 5 / 1_000_000;
const USD_PER_OUTPUT_TOKEN = 25 / 1_000_000;

async function loadCases(dir: string) {
  const entries = await readdir(dir);
  const documents = entries.filter((name) => MIME_BY_EXTENSION[path.extname(name).toLowerCase()]);

  return Promise.all(
    documents.sort().map(async (name) => {
      const base = name.slice(0, -path.extname(name).length);
      const expectedPath = path.join(dir, `${base}.expected.json`);

      const expected: Expected | null = await readFile(expectedPath, 'utf8')
        .then((raw) => JSON.parse(raw) as Expected)
        .catch(() => null);

      const page: DocumentPage = {
        mimeType: MIME_BY_EXTENSION[path.extname(name).toLowerCase()]!,
        bytes: await readFile(path.join(dir, name)),
      };

      return { name: base, page, expected };
    })
  );
}

async function main() {
  const dir = process.argv[2] ?? path.join(__dirname, '..', 'eval', 'cases');
  const analyzer = createClaudeAnalyzer({ model: process.env.ANALYSIS_MODEL });
  const cases = await loadCases(dir);

  if (cases.length === 0) {
    throw new Error(`${dir}에 문서가 없다.`);
  }

  console.log(`${cases.length}개 문서를 분석한다. 모델을 실제로 호출하므로 비용이 든다.\n`);

  let passed = 0;
  let total = 0;
  let cost = 0;

  for (const testCase of cases) {
    const started = Date.now();
    const { extraction, usage } = await analyzer.analyze([testCase.page]);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    const caseCost =
      usage.inputTokens * USD_PER_INPUT_TOKEN + usage.outputTokens * USD_PER_OUTPUT_TOKEN;
    cost += caseCost;

    console.log(`── ${testCase.name} (${seconds}초, $${caseCost.toFixed(4)})`);

    if (testCase.expected?.note) {
      console.log(`   ${testCase.expected.note}`);
    }

    const checks = testCase.expected ? scoreCase(extraction, testCase.expected) : [];
    checks.push(checkNoPersonalInfoLeak(extraction));

    for (const check of checks) {
      console.log(`   ${check.passed ? '✓' : '✗'} ${check.label} — ${check.detail}`);
      total += 1;
      if (check.passed) passed += 1;
    }

    if (!testCase.expected) {
      console.log('   기대값 파일이 없어 채점하지 않는다. 추출 결과:');
      console.log(JSON.stringify(extraction, null, 2));
    }

    console.log();
  }

  console.log(`합계 ${passed}/${total} 통과 · 비용 $${cost.toFixed(4)}`);

  if (passed < total) {
    process.exitCode = 1;
  }
}

main().catch((error: Error) => {
  if (/authentication/i.test(error.message)) {
    console.error(
      'Anthropic 자격증명이 없다. ANTHROPIC_API_KEY를 설정하고 다시 실행할 것.\n' +
        '  ANTHROPIC_API_KEY=... npm run analysis:eval --workspace @weddingpick/api'
    );
  } else {
    console.error(error.message);
  }

  process.exit(1);
});

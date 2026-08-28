import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';

import { createClaudeAnalyzer } from './analysis/claude-analyzer';
import { persistExtraction } from './analysis/persist';
import { loadConfig } from './config';
import { createPool, withTransaction } from './db';
import { loadQuote } from './quote-view';

/**
 * 손에 있는 문서 한 건을 실제 분석 파이프라인에 넣는다.
 *
 *   npm run analyze --workspace @weddingpick/api -- --file 계약서.pdf
 *   npm run analyze --workspace @weddingpick/api -- --file 계약서.pdf --dry-run
 *
 * 앱을 거치지 않고 파일에서 바로 넣는 길이다. 앱이 출시되기 전에는 실제 계약서가
 * 들어올 경로가 없어서, 파이프라인이 진짜 문서에 대해 무엇을 뽑는지 볼 방법이
 * 없었다. 그것을 보려고 만든다.
 *
 * `--dry-run`은 분석만 하고 저장하지 않는다. **남의 계약서로 시험할 때는 이걸
 * 쓴다** — 실험이 데이터가 되어 남으면 안 된다.
 *
 * 저장하면 다른 문서와 똑같은 취급을 받는다. 등급은 L0에서 시작하고, 사용자
 * 확인과 개인정보 재검토를 거치기 전에는 어떤 비교에도 들어가지 않는다.
 */

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);

  return index === -1 ? undefined : process.argv[index + 1];
}

/** 뽑아낸 것을 사람이 읽는 말로. 화면에 나가는 것과 같은 뷰를 쓴다. */
function describe(view: Awaited<ReturnType<typeof loadQuote>>): string[] {
  const lines: string[] = [];
  const won = (amount: number | null) =>
    amount === null ? '(읽지 못함)' : `${amount.toLocaleString('ko-KR')}원`;

  lines.push(`  업체: ${view.vendor?.name ?? '(등록된 업체와 연결되지 않음)'}`);
  lines.push(`  상품: ${view.productName ?? '(읽지 못함)'}`);
  lines.push(`  총액: ${won(view.totalAmount)}`);
  lines.push(`  계약금: ${won(view.depositAmount)}`);
  lines.push(`  계약일: ${view.contractDate ?? '(읽지 못함)'}`);
  lines.push(`  예식일: ${view.weddingDate ?? '(읽지 못함)'}`);

  if (view.lineItems.length > 0) {
    lines.push('  항목:');
    for (const item of view.lineItems) lines.push(`    [${item.kind}] ${item.label}`);
  }

  if (view.terms.length > 0) {
    lines.push('  계약조건:');
    for (const term of view.terms) {
      lines.push(`    ${term.flagged ? '⚠ ' : ''}${term.body}`);
    }
  }

  // 신뢰도가 낮아 사용자 확인(A-07)을 거쳐야 하는 항목들.
  const needsConfirmation = view.extractionFields.filter((field) => field.requiresConfirmation);

  if (needsConfirmation.length > 0) {
    lines.push('  확인이 필요한 항목 (신뢰도가 낮다):');
    for (const field of needsConfirmation) {
      lines.push(`    ${field.path}: ${field.value} (신뢰도 ${field.confidence.toFixed(2)})`);
    }
  }

  return lines;
}

async function main(): Promise<void> {
  const file = argument('file');
  const dryRun = process.argv.includes('--dry-run');

  if (!file) {
    console.error('--file <경로>가 필요하다.');
    process.exitCode = 1;
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      'ANTHROPIC_API_KEY가 없다. 이 명령은 실제 분석을 부르므로 키가 있어야 한다.'
    );
    process.exitCode = 1;
    return;
  }

  const bytes = await readFile(file);
  const mimeType = MIME_BY_EXTENSION[extname(file).toLowerCase()];

  if (!mimeType) {
    console.error(
      `읽을 수 없는 형식이다: ${extname(file)}\n` +
        `받는 것: ${Object.keys(MIME_BY_EXTENSION).join(', ')}`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`${basename(file)} (${(bytes.length / 1024).toFixed(0)}KB) 분석 중…`);

  const analyzer = createClaudeAnalyzer({ model: process.env.ANALYSIS_MODEL });
  // 읽지 못하면 예외가 난다. 여기서 감싸지 않는다 — 왜 못 읽었는지가 그대로 보여야 한다.
  const { extraction, usage } = await analyzer.analyze([{ mimeType, bytes }]);

  console.log(`\n문서 종류: ${extraction.documentKind}`);

  if (extraction.unreadable) {
    console.error('글씨를 읽을 수 없다고 판단했다. 더 밝게·크게 다시 찍어야 한다.');
  }

  if (extraction.documentKind === 'not_a_document') {
    console.error('견적서·계약서가 아니라고 판단했다.');
  }

  /*
   * 개인정보는 종류만 보여준다. 값은 애초에 뽑지 않게 되어 있지만, 그 규칙이
   * 지켜졌는지 여기서 눈으로 확인할 수 있어야 한다.
   */
  console.log(
    `읽은 개인정보 종류: ${
      extraction.personalInfoKinds.length > 0 ? extraction.personalInfoKinds.join(', ') : '없음'
    }`
  );

  if (dryRun) {
    console.log(
      `\n토큰: 입력 ${usage.inputTokens.toLocaleString('ko-KR')} · ` +
        `출력 ${usage.outputTokens.toLocaleString('ko-KR')}`
    );
    console.log('\n--dry-run 이므로 저장하지 않았다.');
    console.log(JSON.stringify(extraction, null, 2));
    return;
  }

  const pool = createPool(loadConfig().databaseUrl);

  try {
    const quoteId = await withTransaction(pool, async (client) => {
      const user = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );
      const wedding = await client.query<{ id: string }>(
        'INSERT INTO structured.weddings (owner_user_id) VALUES ($1) RETURNING id',
        [user.rows[0]!.id]
      );
      const document = await client.query<{ id: string }>(
        'INSERT INTO originals.raw_documents (owner_user_id, page_count) VALUES ($1, 1) RETURNING id',
        [user.rows[0]!.id]
      );

      await client.query(
        `INSERT INTO originals.raw_document_pages (raw_document_id, page_index, storage_key, mime_type)
         VALUES ($1, 0, $2, $3)`,
        [document.rows[0]!.id, `${document.rows[0]!.id}/page-0${extname(file)}`, mimeType]
      );

      return await persistExtraction(client, {
        weddingId: wedding.rows[0]!.id,
        rawDocumentId: document.rows[0]!.id,
        extraction,
      });
    });

    const view = await loadQuote(pool, quoteId);

    console.log('\n뽑아낸 것:');
    for (const line of describe(view)) console.log(line);

    console.log(
      `\n저장했다: ${quoteId}` +
        '\n등급은 L0이고 사용자 확인 전이라 아직 어떤 비교에도 들어가지 않는다.'
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

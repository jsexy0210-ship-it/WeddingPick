/**
 * 마케팅 파이프라인 CLI.
 *
 *   npm run marketing --workspace @weddingpick/api -- demo <outDir>
 *   npm run marketing --workspace @weddingpick/api -- preview <source.json> <input.json> <outDir>
 *   npm run marketing --workspace @weddingpick/api -- simulate   (DATABASE_URL 필요)
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { generateContent, VERIFIED_FACTS } from './content';
import { createPool } from '../db';
import { processScheduled } from './store';
import type { MarketingChannel, MarketingFormat, MarketingSource } from '@weddingpick/api-contract';

const CHANNELS: MarketingChannel[] = ['blog', 'instagram', 'shortform', 'community'];
const FORMATS: MarketingFormat[] = ['product', 'feature', 'checklist', 'data'];

async function cmdDemo(outDir: string) {
  await mkdir(outDir, { recursive: true });
  const lines: string[] = ['# 마케팅 파이프라인 개발 예제', '', `생성 시각: ${new Date().toISOString()}`, ''];

  const demoSource: MarketingSource = {
    id: 'demo-source-01',
    factIds: ['pick', 'compare', 'together', 'schedule', 'data'],
    reviewed: true,
    reviewedAt: new Date().toISOString(),
    expiresAt: null,
    nextVerifyAt: null,
    active: true,
    note: '개발용 예제 소재',
  };

  for (const channel of CHANNELS) {
    lines.push(`## 채널: ${channel}`, '');
    for (const format of FORMATS) {
      const key = `demo_${channel}_${format}`;
      const result = generateContent(demoSource, channel, format, key);
      lines.push(`### ${format}`);
      if (result.ok) {
        lines.push(`**제목:** ${result.title}`, '', '**본문:**', '```', result.body, '```', '', `**UTM:** ${result.utmUrl}`, '');
      } else {
        lines.push(`> 오류: ${result.error}`, '');
      }
    }
  }

  const outFile = join(outDir, 'index.md');
  await writeFile(outFile, lines.join('\n'), 'utf-8');
  console.log(`✓ ${CHANNELS.length * FORMATS.length}개 예제 생성 → ${outFile}`);
}

async function cmdPreview(sourceFile: string, inputFile: string, outDir: string) {
  const source: MarketingSource = JSON.parse(await readFile(sourceFile, 'utf-8')) as MarketingSource;
  const input: { channel: MarketingChannel; format: MarketingFormat } = JSON.parse(await readFile(inputFile, 'utf-8')) as { channel: MarketingChannel; format: MarketingFormat };

  await mkdir(outDir, { recursive: true });
  const key = `preview_${Date.now()}`;
  const result = generateContent(source, input.channel, input.format, key);

  const outFile = join(outDir, `${key}.md`);
  if (result.ok) {
    await writeFile(outFile, [
      `# 미리보기: ${input.channel} / ${input.format}`,
      '',
      `**제목:** ${result.title}`,
      '',
      '**본문:**',
      '```',
      result.body,
      '```',
      '',
      `**UTM:** ${result.utmUrl}`,
      '',
      '**계획 프롬프트:**',
      '```',
      result.planningPrompt,
      '```',
    ].join('\n'), 'utf-8');
    console.log(`✓ 미리보기 생성 → ${outFile}`);
  } else {
    console.error(`✗ 생성 실패: ${result.error}`);
    process.exit(1);
  }
}

async function cmdSimulate() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL이 설정되지 않았습니다.');
    process.exit(1);
  }
  const pool = createPool(DATABASE_URL);
  try {
    const result = await processScheduled(pool);
    console.log(`✓ 완료: 성공 ${result.ok}건, 실패 ${result.failed}건`);
  } finally {
    await pool.end();
  }
}

async function cmdFacts() {
  console.log('## 검토된 사실 ID 목록\n');
  for (const [id, sentence] of Object.entries(VERIFIED_FACTS)) {
    console.log(`- **${id}**: ${sentence}`);
  }
}

void (async () => {
  const [cmd, ...rest] = process.argv.slice(2);

  switch (cmd) {
    case 'demo':
      await cmdDemo(rest[0] ?? '.marketing-preview');
      break;
    case 'preview':
      if (rest.length < 3) {
        console.error('사용법: preview <source.json> <input.json> <outDir>');
        process.exit(1);
      }
      await cmdPreview(rest[0]!, rest[1]!, rest[2]!);
      break;
    case 'simulate':
      await cmdSimulate();
      break;
    case 'facts':
      await cmdFacts();
      break;
    default:
      console.log('명령: demo [outDir] | preview <source> <input> <outDir> | simulate | facts');
      process.exit(0);
  }
})();

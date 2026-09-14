import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { Pool } from 'pg';

import { exportRollups } from './activity-admin';
import { loadConfig } from './config';

/**
 * 집계층을 파일로 떨군다.
 *
 *   npm run activity:export --workspace @weddingpick/api -- --out out/activity.json
 *   npm run activity:export --workspace @weddingpick/api -- --from 2026-08-01 --to 2026-09-30 --csv
 *
 * **여기까지다.** 외부로 자동 전송하는 길은 만들지 않는다(2026-09-14 지시) —
 * 실제로 파는 것은 계약·가격·상대가 정해져야 하고 그것은 대표님 결정이다.
 * 이 파일에 HTTP 클라이언트도 업로드도 없는 것은 빠뜨린 것이 아니다.
 *
 * **원장(1층)을 내보내는 길도 없다.** 내보내는 것은 `structured.activity_rollups`
 * 뿐이고, 그 표에는 사람 단위 행이 애초에 들어가지 못한다.
 */

type Args = {
  out: string;
  from?: string;
  to?: string;
  csv: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { out: 'out/activity-rollup.json', csv: false };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];

    if (flag === '--csv') {
      args.csv = true;
      continue;
    }

    const value = argv[i + 1];

    if (!value) continue;

    if (flag === '--out') {
      args.out = value;
      i += 1;
    } else if (flag === '--from') {
      args.from = value;
      i += 1;
    } else if (flag === '--to') {
      args.to = value;
      i += 1;
    }
  }

  if (args.csv && args.out.endsWith('.json')) {
    args.out = args.out.replace(/\.json$/, '.csv');
  }

  return args;
}

const CSV_COLUMNS = [
  'periodStart',
  'periodDays',
  'eventName',
  'surface',
  'region',
  'category',
  'budgetBracket',
  'subjectCount',
  'eventCount',
  'foldRule',
  'kThreshold',
] as const;

/**
 * 쉼표와 따옴표가 든 값은 감싼다. 지역 이름에 「그 외」처럼 공백이 들고, 업종
 * 이름은 한글이라 지금은 쉼표가 없지만 — 없다고 믿고 짜면 생기는 날 조용히 깨진다.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  const text = String(value);

  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });

  try {
    const result = await exportRollups(pool, {
      ...(args.from ? { from: args.from } : {}),
      ...(args.to ? { to: args.to } : {}),
    });

    const target = resolve(process.cwd(), args.out);

    await mkdir(dirname(target), { recursive: true });

    if (args.csv) {
      const lines = [
        CSV_COLUMNS.join(','),
        ...result.rows.map((row) =>
          CSV_COLUMNS.map((column) => csvCell(row[column])).join(',')
        ),
      ];

      await writeFile(target, `${lines.join('\n')}\n`, 'utf8');
    } else {
      /*
       * 최소 인원과 접는 규칙을 **파일 안에** 적는다. 표만 건네면 받는 쪽은 이
       * 수치가 어느 기준으로 묶인 것인지 알 수 없고, 나중에 「이게 정말 익명이냐」를
       * 따질 때 근거가 파일 밖에만 남는다.
       */
      await writeFile(
        target,
        `${JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            minSubjects: result.kThreshold,
            foldRule: result.foldRule,
            note: '한 행은 묶음이고 사람 단위 행은 없다. 최소 인원 미만인 묶음은 행 자체가 빠져 있다.',
            rows: result.rows,
          },
          null,
          2
        )}\n`,
        'utf8'
      );
    }

    console.log(`${result.rows.length}행 · ${target}`);
    console.log(`최소 인원 ${result.kThreshold}명 · 접는 규칙 ${result.foldRule}`);
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

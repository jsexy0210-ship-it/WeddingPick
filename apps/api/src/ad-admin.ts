import {
  ADVERTISING_MUST_NOT_AFFECT,
  PROTECTED_SURFACE_LABEL,
  SPONSORED_LABEL,
} from '@weddingpick/domain';

import { loadConfig } from './config';
import { createPool } from './db';

/**
 * 광고 지면 도구. 최종통합정책 v2.0 E장.
 *
 * **이 도구가 하는 일은 자리를 잡아주는 것뿐이다.** 광고를 넣어도 검색 순위는
 * 달라지지 않는다 — 광고는 `ads` 스키마에 있고, 자연 결과를 세는 질의는 그
 * 스키마를 보지 않는다.
 *
 *   npm run ads --workspace @weddingpick/api -- --list
 *   npm run ads --workspace @weddingpick/api -- --add <vendor-id> \
 *     --surface search --from 2026-09-01 --to 2026-09-30 [--category hall] [--region 서울]
 *   npm run ads --workspace @weddingpick/api -- --remove <placement-id>
 *   npm run ads --workspace @weddingpick/api -- --firewall
 *
 * `--firewall`은 광고가 건드리지 못하는 것의 목록을 찍는다. 광고를 붙이는 사람이
 * 이 목록을 한 번은 읽고 지나가게 하려는 것이다.
 */

type Options = {
  list: boolean;
  firewall: boolean;
  add?: string;
  remove?: string;
  surface?: string;
  tier?: string;
  from?: string;
  to?: string;
  category?: string;
  region?: string;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { list: false, firewall: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--list') options.list = true;
    else if (arg === '--firewall') options.firewall = true;
    else if (arg === '--add') options.add = argv[++i];
    else if (arg === '--remove') options.remove = argv[++i];
    else if (arg === '--surface') options.surface = argv[++i];
    else if (arg === '--tier') options.tier = argv[++i];
    else if (arg === '--from') options.from = argv[++i];
    else if (arg === '--to') options.to = argv[++i];
    else if (arg === '--category') options.category = argv[++i];
    else if (arg === '--region') options.region = argv[++i];
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.firewall) {
    console.log(`광고비가 영향을 줄 수 없는 것 (v2.0 E-1) — ${ADVERTISING_MUST_NOT_AFFECT.length}가지:`);
    for (const surface of ADVERTISING_MUST_NOT_AFFECT) {
      console.log(`  ${PROTECTED_SURFACE_LABEL[surface]}`);
    }
    console.log(`유료 노출에는 "${SPONSORED_LABEL}"을 붙이고 자연 결과와 다른 자리에 싣는다.`);
    return;
  }

  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (options.list) {
      const { rows } = await pool.query<{
        id: string;
        name: string;
        surface: string;
        category: string | null;
        region: string | null;
        starts_on: Date;
        ends_on: Date;
        live: boolean;
      }>(
        `SELECT p.id, v.name, p.surface, p.category::text, p.region,
                p.starts_on, p.ends_on,
                current_date BETWEEN p.starts_on AND p.ends_on AS live
         FROM ads.placements p
         JOIN structured.vendors v ON v.id = p.vendor_id
         ORDER BY p.starts_on DESC`
      );

      if (rows.length === 0) {
        console.log('잡아둔 광고 자리가 없다.');
        return;
      }

      for (const row of rows) {
        const day = (at: Date) => at.toISOString().slice(0, 10);
        const scope = [row.category ?? '전체 업종', row.region ?? '전국'].join(' · ');

        console.log(
          `  ${row.id}  ${row.live ? '노출 중' : '기간 밖'}  ${row.name}  ` +
            `${row.surface}  ${scope}  ${day(row.starts_on)}~${day(row.ends_on)}`
        );
      }
      return;
    }

    if (options.remove) {
      const { rowCount } = await pool.query('DELETE FROM ads.placements WHERE id = $1', [
        options.remove,
      ]);

      console.log(rowCount === 0 ? '없는 자리다.' : '내렸다.');
      return;
    }

    if (options.add) {
      if (!options.surface || !options.tier || !options.from || !options.to) {
        console.error(
          '--surface, --tier, --from, --to가 필요하다. 기간 없는 광고는 내릴 때를 모르고, ' +
            '등급 없는 광고는 무엇을 판 것인지 모른다.'
        );
        process.exitCode = 1;
        return;
      }

      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO ads.placements (vendor_id, surface, tier, category, region, starts_on, ends_on)
         VALUES ($1, $2::ad_surface, $3::ad_tier, $4::vendor_category, $5, $6, $7)
         RETURNING id`,
        [
          options.add,
          options.surface,
          options.tier,
          options.category ?? null,
          options.region ?? null,
          options.from,
          options.to,
        ]
      );

      console.log(`잡았다: ${rows[0]!.id}`);
      console.log('검색 순위는 달라지지 않는다. 광고는 자연 결과와 다른 자리에 실린다.');
      return;
    }

    console.error('무엇을 할지 정해라: --list | --add | --remove | --firewall');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

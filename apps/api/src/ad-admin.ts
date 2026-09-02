import {
  ADVERTISING_MUST_NOT_AFFECT,
  PROTECTED_SURFACE_LABEL,
  SPONSORED_LABEL,
} from '@weddingpick/domain';
import type { Pool } from 'pg';

import { loadConfig } from './config';
import { createPool } from './db';
import { requireOperator } from './decisions';

/**
 * 광고 지면 도구. 최종통합정책 v2.0 E장.
 *
 * **이 도구가 하는 일은 자리를 잡아주는 것뿐이다.** 광고를 넣어도 검색 순위는
 * 달라지지 않는다 — 광고는 `ads` 스키마에 있고, 자연 결과를 세는 질의는 그
 * 스키마를 보지 않는다.
 *
 *   npm run ads --workspace @weddingpick/api -- --list
 *   npm run ads --workspace @weddingpick/api -- --add <vendor-id> --by <operator-id> \
 *     --surface search --tier basic --from 2026-09-01 --to 2026-09-30 [--category hall] [--region 서울]
 *   npm run ads --workspace @weddingpick/api -- --remove <placement-id> --by <operator-id>
 *   npm run ads --workspace @weddingpick/api -- --firewall
 *
 * `--firewall`은 광고가 건드리지 못하는 것의 목록을 찍는다. 광고를 붙이는 사람이
 * 이 목록을 한 번은 읽고 지나가게 하려는 것이다.
 *
 * **이전에는 운영자 확인이 없었다.** CLI를 돌릴 수 있는 사람이면 누구나 자리를
 * 잡거나 내릴 수 있었다 — 관리자 콘솔이 HTTP로 열리면 그 암묵적 경계가 사라지므로
 * 여기서부터 `requireOperator`를 건다.
 */

export type AdPlacement = {
  id: string;
  vendorName: string;
  surface: string;
  category: string | null;
  region: string | null;
  startsOn: Date;
  endsOn: Date;
  live: boolean;
};

export async function list(pool: Pool): Promise<AdPlacement[]> {
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

  return rows.map((row) => ({
    id: row.id,
    vendorName: row.name,
    surface: row.surface,
    category: row.category,
    region: row.region,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    live: row.live,
  }));
}

export type AddPlacementInput = {
  vendorId: string;
  surface: string;
  tier: string;
  category?: string;
  region?: string;
  from: string;
  to: string;
};

export async function add(pool: Pool, input: AddPlacementInput, by: string): Promise<string> {
  await requireOperator(pool, by);

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO ads.placements (vendor_id, surface, tier, category, region, starts_on, ends_on)
     VALUES ($1, $2::ad_surface, $3::ad_tier, $4::vendor_category, $5, $6, $7)
     RETURNING id`,
    [
      input.vendorId,
      input.surface,
      input.tier,
      input.category ?? null,
      input.region ?? null,
      input.from,
      input.to,
    ]
  );

  return rows[0]!.id;
}

export async function remove(pool: Pool, placementId: string, by: string): Promise<boolean> {
  await requireOperator(pool, by);

  const { rowCount } = await pool.query('DELETE FROM ads.placements WHERE id = $1', [
    placementId,
  ]);

  return rowCount !== 0;
}

export function firewallNotice(): { protectedSurfaces: string[]; sponsoredLabel: string } {
  return {
    protectedSurfaces: ADVERTISING_MUST_NOT_AFFECT.map((surface) => PROTECTED_SURFACE_LABEL[surface]),
    sponsoredLabel: SPONSORED_LABEL,
  };
}

type Options = {
  list: boolean;
  firewall: boolean;
  add?: string;
  remove?: string;
  by?: string;
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
    else if (arg === '--by') options.by = argv[++i];
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
    const notice = firewallNotice();

    console.log(`광고비가 영향을 줄 수 없는 것 (v2.0 E-1) — ${notice.protectedSurfaces.length}가지:`);
    for (const surface of notice.protectedSurfaces) {
      console.log(`  ${surface}`);
    }
    console.log(`유료 노출에는 "${notice.sponsoredLabel}"을 붙이고 자연 결과와 다른 자리에 싣는다.`);
    return;
  }

  const pool = createPool(loadConfig().databaseUrl);

  try {
    if (options.list) {
      const placements = await list(pool);

      if (placements.length === 0) {
        console.log('잡아둔 광고 자리가 없다.');
        return;
      }

      for (const p of placements) {
        const day = (at: Date) => at.toISOString().slice(0, 10);
        const scope = [p.category ?? '전체 업종', p.region ?? '전국'].join(' · ');

        console.log(
          `  ${p.id}  ${p.live ? '노출 중' : '기간 밖'}  ${p.vendorName}  ` +
            `${p.surface}  ${scope}  ${day(p.startsOn)}~${day(p.endsOn)}`
        );
      }
      return;
    }

    if (!options.by) {
      console.error('실행한 사람(--by <operator-id>)이 필요하다.');
      process.exitCode = 1;
      return;
    }

    if (options.remove) {
      const removed = await remove(pool, options.remove, options.by);

      console.log(removed ? '내렸다.' : '없는 자리다.');
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

      const id = await add(
        pool,
        {
          vendorId: options.add,
          surface: options.surface,
          tier: options.tier,
          category: options.category,
          region: options.region,
          from: options.from,
          to: options.to,
        },
        options.by
      );

      console.log(`잡았다: ${id}`);
      console.log('검색 순위는 달라지지 않는다. 광고는 자연 결과와 다른 자리에 실린다.');
      return;
    }

    console.error('무엇을 할지 정해라: --list | --add | --remove | --firewall');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

/*
 * CLI로 직접 실행했을 때만 돈다. 테스트가 이 파일에서 함수를 가져오면(require)
 * `require.main`이 테스트 러너를 가리키므로 여기 걸리지 않는다.
 */
if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createPool } from '../db';
import { downloadPublicCsv, downloadSbizApiVendors, parsePublicCsv } from './collect';
import { PUBLIC_SOURCES, sourceKey } from './sources';
import { VENDOR_CATEGORIES, type VendorCategory } from '@weddingpick/domain';
import { syncCollected } from './sync';

/**
 * 한 번에 넘기는 업체 수. 예전에는 이 수를 넘으면 던지고 「지역·업종별로 나누세요」라고
 * 안내했는데, 그건 할 수 없는 일을 시키는 말이었다 — `sbiz-seoul`은 이미 시도 하나이고
 * 서울을 더 쪼갤 출처 정의가 없다. 업종 코드를 고쳐 서울 전수가 들어오는 순간 코드를
 * 바꾸기 전에는 영원히 반영이 안 되는 상태였다.
 *
 * 그래서 거절하는 대신 이 수만큼 잘라서 반복한다. 한 번에 너무 많이 쓰지 않는다는
 * 원래 의도는 그대로다 — `syncCollected`는 어차피 행마다 따로 트랜잭션을 열므로
 * (`sync.ts`) 이 값이 지키는 것은 트랜잭션 크기가 아니라 사고 시 되돌릴 크기다.
 */
const APPLY_CHUNK = 2000;

/**
 * 한 실행이 반영할 수 있는 업체 수의 **상한**. 위 APPLY_CHUNK와 다른 것이다 —
 * 저쪽은 「몇 개씩 끊어 쓰나」이고 이것은 「이보다 많으면 아예 쓰지 않는다」다.
 *
 * 왜 필요한가. 예전 상한(`vendors.length > 2000`이면 거절)은 전국 전수를 막아서
 * 없앴고, 그 뒤로는 한 실행이 쓸 수 있는 양에 아무 한계가 없었다. 분류가 한 번
 * 어긋나면 그대로 전국 상권 자료가 통째로 들어온다 — 상호 조건이 없으면 실제로
 * 그렇게 된다(`resolveSbizCategory`). 되돌리기는 수집보다 어렵다.
 *
 * 그래서 자르지 않고 **거절한다.** 잘라서 쓰면 「어디까지 들어왔나」가 실행마다
 * 달라져 되돌릴 수 없고, 무엇보다 이상한 양이 들어왔다는 사실 자체가 묻힌다.
 *
 * **값 5만은 추정값이다 — 아직 실측이 없다.** 확인된 소분류 다섯(README «확인된
 * 업종 소분류 코드»)의 전국 합을 한 번도 받아 본 적이 없어서, 「실제 웨딩 업체
 * 수보다는 넉넉히 위, 분류 사고(상권 자료 전체는 백만 단위)보다는 확실히 아래」로
 * 잡아 둔 선이다. **첫 전국 수집이 성공하면 리포트의 accepted를 보고 이 값을
 * 실측 기준으로 다시 정한다.** 그전까지 상한에 걸리는 것은 사고가 아니라 「숫자를
 * 처음 봤다」는 뜻이므로, 리포트를 보고 `PUBLIC_DATA_MAX_APPLY`로 올린다.
 */
const MAX_APPLY = () => Number(process.env.PUBLIC_DATA_MAX_APPLY ?? 50_000);

/**
 * 받아들인 업체를 업종별로 센다.
 *
 * 리포트에는 합계(accepted)만 있었다. 그런데 화면은 업종 12종으로 나뉘어 있어서
 * 「부케가 몇 건인가」를 물으면 아무 데서도 답이 안 나왔다 — 실제로 2026-09-11에
 * 그 질문을 받고서야 드러났다. 업종은 업체마다 붙어 있는데 세어 주는 곳이 없었다.
 *
 * 12종을 **0이어도 전부** 적는다. 빠진 업종과 0건인 업종은 다른 이야기이고,
 * 0으로 적혀 있어야 「코드를 안 받아와서 0」인지 「받았는데 없어서 0」인지 묻게 된다.
 * 순서는 VENDOR_CATEGORIES(준비 순서) 그대로라 화면과 같은 차례로 읽힌다.
 */
function countByCategory(vendors: { category: VendorCategory }[]): Record<VendorCategory, number> {
  const counts = Object.fromEntries(VENDOR_CATEGORIES.map((c) => [c, 0])) as Record<VendorCategory, number>;
  for (const v of vendors) counts[v.category] += 1;
  return counts;
}

/** Invoked through the existing public-data:import CLI. --apply is an explicit DB write. */
export async function runPublicCollection(args: string[]) {
  function arg(name: string) { const i=args.indexOf(name); return i<0 ? undefined : args[i+1]; }
  const key = sourceKey(arg('--source') ?? '');
  const file = arg('--file');
  const sbizApiKey = arg('--sbiz-api-key') ?? process.env.SBIZ_API_KEY;
  const upjongCodes = arg('--upjong-codes');
  const upjongDivId = arg('--upjong-div-id');
  /*
   * 소량 확인용 상한(2026-09-11 대표 지시 — 「소량만 우선 수집해 100건 정도」).
   * 전수를 받기 전에 무엇이 어떤 업종으로 들어오는지 눈으로 보려는 것이다.
   * MAX_APPLY(반영 상한)와 다르다 — 저쪽은 「너무 많으면 안 쓴다」이고
   * 이것은 「이만큼만 받는다」다. API를 그만 두드린다는 점에서 성격이 다르다.
   */
  const limitArg = arg('--limit') ?? process.env.PUBLIC_DATA_LIMIT;
  const limit = limitArg ? Number(limitArg) : undefined;
  if (limit !== undefined && (!Number.isFinite(limit) || limit < 1))
    throw new Error(`--limit은 1 이상의 수여야 합니다: ${limitArg}`);
  const apply = args.includes('--apply');
  if (apply && args.includes('--dry-run')) throw new Error('--apply와 --dry-run은 함께 사용할 수 없습니다.');
  if (apply && !process.env.DATABASE_URL) throw new Error('DATABASE_URL 없음: --apply를 제외하면 수집·검증 가능합니다.');

  const source = PUBLIC_SOURCES[key];
  const at = new Date();
  let vendors: Awaited<ReturnType<typeof parsePublicCsv>>['vendors'];
  let total: number;
  let rejected: number;
  let duplicates: number;
  let closed: number;
  /** sbiz 전용 — 다 못 받은 업종코드와 그 이유. 비어 있어야 전수다. */
  let truncated: { code: string; got: number; total: number | null; reason: string }[] = [];

  if (source.format === 'sbiz-api') {
    if (!sbizApiKey) throw new Error('SBIZ_API_KEY 환경변수 또는 --sbiz-api-key 옵션이 필요합니다.');
    // 업종코드는 하드코딩하지 않는다 — CLI 또는 SBIZ_UPJONG_CODES에서 온다.
    const result = await downloadSbizApiVendors(key, sbizApiKey, at,
      upjongCodes ? { divId: upjongDivId ?? 'indsLclsCd', codes: upjongCodes.split(',') } : undefined,
      limit);
    vendors = result.vendors;
    // total은 API가 돌려준 원본 건수다. accepted가 0인데 total이 크면 지역·분류
    // 필터가 응답 필드와 어긋난 것이므로 리포트만 보고 구분할 수 있어야 한다.
    total = result.fetched;
    rejected = result.rejected;
    duplicates = result.duplicates;
    truncated = result.truncated;
    // OpenAPI 응답에는 영업상태 열이 없다 — 폐업 판정은 CSV 경로에만 있다.
    closed = 0;
  } else {
    if (file && (await stat(file)).size > 64 * 1024 * 1024) throw new Error('64 MiB 이하 지역별 CSV가 필요합니다.');
    const bytes = file ? await readFile(file) : await downloadPublicCsv(key);
    const result = parsePublicCsv(bytes, key, at);
    vendors = result.vendors;
    total = result.total;
    rejected = result.rejected;
    duplicates = result.duplicates;
    closed = result.closed;
    // CSV는 파일을 통째로 받은 뒤라 더 안 받을 것이 없다 — 앞에서 자르기만 한다.
    if (limit !== undefined && vendors.length > limit) vendors = vendors.slice(0, limit);
  }

  const output = arg('--out') ?? '.collection';
  await mkdir(output, {recursive: true});
  // Only the whitelist projection is saved; no phone, address, coordinates, HTML or original CSV.
  await writeFile(join(output, `${key}.json`), JSON.stringify({vendors, total, rejected, duplicates, closed}, null, 2) + '\n', 'utf8');

  let db = null;
  /*
   * 상한에 걸리면 여기서 곧바로 던지지 않는다 — 리포트를 쓰고 나서 던진다.
   *
   * 상한을 넘겼다는 말만 남기고 끝나면 사람이 볼 것이 없다. 상한을 올릴지 분류를
   * 고칠지는 total·accepted·rejected를 봐야 정할 수 있고, 그것이 리포트다.
   * 던지는 것은 그대로다 — 잡을 초록으로 넘기지 않는다.
   */
  const cap = MAX_APPLY();
  const applyRefused = apply && vendors.length > cap
    ? `반영 상한 초과: ${vendors.length}건 (상한 ${cap}건). 한 건도 쓰지 않고 멈춘다.\n` +
      `이 양이 맞다면 PUBLIC_DATA_MAX_APPLY로 상한을 올려서 다시 돌린다. ` +
      `맞지 않다면 업종 분류(resolveSbizCategory)나 업종코드(SBIZ_UPJONG_CODES)가 어긋난 것이다 — ` +
      `${join(output, `${key}-report.json`)}의 total·accepted·rejected를 먼저 본다.`
    : null;

  if (apply && !applyRefused) {
    const pool = createPool(process.env.DATABASE_URL!);
    try {
      // heldBy까지 합친다 — 합계만 남기면 「사람이 봐야 하는 건이 있었나」를
      // 리포트만 보고 가를 수 없다. 사유별 내역 원본은 vendor_import_holds다.
      db = {created: 0, updated: 0, unchanged: 0, held: 0, errors: 0,
        heldBy: {admin_locked: 0, multiple_matches: 0, ambiguous_name: 0,
          insert_conflict: 0, field_conflict: 0}};
      for (let from = 0; from < vendors.length; from += APPLY_CHUNK) {
        const counts = await syncCollected(pool, vendors.slice(from, from + APPLY_CHUNK));
        for (const field of ['created','updated','unchanged','held','errors'] as const) db[field] += counts[field];
        for (const reason of Object.keys(db.heldBy) as (keyof typeof db.heldBy)[]) db.heldBy[reason] += counts.heldBy[reason];
      }
    } finally { await pool.end(); }
  }
  const report = {source: key, sourceUrl: source.url, collectedAt: at.toISOString(),
    total, accepted: vendors.length, rejected, duplicates, closed,
    // 상한을 걸고 받았으면 accepted는 「있는 만큼」이 아니다. 그 사실을 남긴다.
    limit: limit ?? null,
    categoryCounts: countByCategory(vendors), truncated,
    // 요청했으나 상한에 막힌 것과 애초에 요청하지 않은 것은 다르다.
    databaseApplied: apply && !applyRefused, applyRefused, db};
  await writeFile(join(output, `${key}-report.json`), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify(report));
  if (applyRefused) throw new Error(applyRefused);
  if (db?.errors) throw new Error('일부 DB 반영 실패. import_errors 확인');
}

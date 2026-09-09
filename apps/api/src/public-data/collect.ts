import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { toRegion } from './localdata';
import { PUBLIC_SOURCES, type SourceKey } from './sources';

export type CollectedVendor = {
  name: string;
  region: string;
  category: 'hall' | 'studio' | 'dress' | 'makeup' | 'snap' | 'wedding_info_company';
  sourceKey: SourceKey;
  sourceUrl: string;
  sourceRecordId: string | null;
  publishedOn: string | null;
  collectedAt: string;
  status: 'needs_verification';
};

export function isoDay(value: string, today: string): string | null {
  const day = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day && day <= today
    ? day : null;
}

/**
 * 상권 소분류 + 상호로 업종을 고른다. 사진관·미용실·의류대여점 전체를 웨딩 업체로
 * 추정하지 않는다 — 상호에 «웨딩»·«본식»·«브라이덜»이 있어야 받는다.
 *
 * v3.18부터 스튜디오·드레스·메이크업이 따로다(전에는 `sdm` 하나였다). 사진 업종은
 * 상호로 가른다 — «본식»·«스냅»이면 본식스냅, «스튜디오»면 스튜디오, 그 밖의
 * «웨딩 사진»은 전처럼 본식스냅으로 둔다.
 */
export function classifyWeddingIndustry(industry: string, name: string): CollectedVendor['category'] | null {
  if (/사진|촬영|스튜디오/.test(industry)) {
    if (/본식|스냅/.test(name)) return 'snap';
    if (/스튜디오/.test(name) && /웨딩|브라이덜/.test(name)) return 'studio';
    return /웨딩/.test(name) ? 'snap' : null;
  }
  if (!/웨딩|브라이덜/.test(name)) return null;
  if (/의류.*대여|드레스/.test(industry)) return 'dress';
  if (/미용|메이크업/.test(industry)) return 'makeup';
  return null;
}

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[\s()[\]{}·・,.\-_/]/g, '');
}

export function contentHash(v: Pick<CollectedVendor, 'name' | 'region' | 'category' | 'status'>): string {
  return createHash('sha256').update(JSON.stringify([v.name, v.region, v.category, v.status])).digest('hex');
}

/** 실제 영업을 확인하는 API가 아니므로 명단 수록만으로 영업중·폐업을 판정하지 않는다. */
export function parsePublicCsv(bytes: Buffer, key: SourceKey, at = new Date()) {
  if (bytes.length > 64 * 1024 * 1024) throw new Error('파일은 64 MiB 이하 지역별 CSV로 나누세요.');
  const source = PUBLIC_SOURCES[key];
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { text = iconv.decode(bytes, 'cp949'); }
  const rows = parse(text, {
    bom: true, columns: (headers: string[]) => headers.map((h) => h.trim()),
    skip_empty_lines: true, max_record_size: 64 * 1024,
  }) as Record<string, string>[];
  if (!rows.length) throw new Error('빈 CSV는 정상 수집으로 처리하지 않습니다.');
  const headers = Object.keys(rows[0]!);
  const required = [source.nameColumn, '도로명주소', ...(source.format === 'sbiz'
    ? ['상가업소번호', '상권업종소분류명'] : [source.dateColumn])];
  if (required.some((h) => !headers.includes(h))) throw new Error('CSV 필수 열이 변경되었습니다.');
  const vendors: CollectedVendor[] = [];
  const seen = new Set<string>();
  let rejected = 0;
  let duplicates = 0;
  for (const row of rows) {
    const branch = source.format === 'sbiz' ? row['지점명']?.trim() : '';
    const name = [row[source.nameColumn]?.trim(), branch].filter(Boolean).join(' ');
    const region = toRegion(row['도로명주소']?.trim() ?? '');
    let category: CollectedVendor['category'] | null = source.format === 'municipal' ? 'hall' : null;
    if (source.format === 'sbiz') {
      const industry = row['상권업종소분류명']?.trim() ?? '';
      // 사진관·미용실 전체를 웨딩 업체로 추정하지 않는다.
      if (/예식장/.test(industry)) category = 'hall';
      else if (/결혼.*중개|결혼.*상담/.test(industry)) category = 'wedding_info_company';
      else category = classifyWeddingIndustry(industry, name);
    }
    const publishedOn = source.dateColumn ? isoDay(row[source.dateColumn] ?? '', at.toISOString().slice(0, 10)) : null;
    if (!name || name.length > 500 || !category || !/^\S+(?:시|도)\s+\S+/.test(region)
      || (source.dateColumn && !publishedOn)) { rejected++; continue; }
    const identity = `${normalizeName(name)}|${region}`;
    if (seen.has(identity)) { duplicates++; continue; }
    seen.add(identity);
    vendors.push({ name, region, category, sourceKey: key, sourceUrl: source.url,
      sourceRecordId: source.format === 'sbiz' ? row['상가업소번호']?.trim() || null : null,
      publishedOn, collectedAt: at.toISOString(), status: 'needs_verification' });
  }
  return { vendors, total: rows.length, rejected, duplicates };
}

const ALLOWED_ORIGINS = new Set(['https://www.data.go.kr', 'https://apis.data.go.kr']);

/**
 * 공공데이터포털이 발급하는 서비스키(일반 인증키)는 이미 URL-encode된 값으로
 * 준다(예: '/'가 '%2F'로, '='가 '%3D'로). `URLSearchParams.set()`은 넘긴
 * 값을 그대로 다시 encode하므로, encode된 키를 그대로 넘기면 '%'가
 * '%25'로 한 번 더 encode되어(이중 인코딩) 서버가 키를 못 알아본다 —
 * apis.data.go.kr 연동에서 가장 흔한 실수다. 여기서 한 번 decode해 원래
 * 키로 되돌린 뒤 넘기면 `URLSearchParams`가 정확히 한 번만 encode한다.
 * 이미 decode된 키가 들어와도(우연히 %XX 패턴이 아닌 한) 그대로 통과한다.
 */
function normalizeServiceKey(apiKey: string): string {
  try { return decodeURIComponent(apiKey); }
  catch { return apiKey; }
}

/**
 * apis.data.go.kr 연결은 간헐적으로 끊긴다 — 같은 커밋·같은 키로 한 번은
 * 1초 만에 응답하고(2026-09-09 02:47) 5분 뒤에는 3회 연속 connect timeout이
 * 났다(02:52). 서버 오류가 아니라 연결 자체가 안 맺어지는 것이라 짧은 재시도로는
 * 넘기지 못한다. 시도 횟수를 늘리고 대기를 지수적으로 벌린다(2·4·8·16·32초,
 * 최대 약 1분). 여기서 못 넘기면 진짜 장애로 보고 실패시킨다.
 */
async function fetchWithRetry(url: string, attempts = 6): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    try { return await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) }); }
    catch (err) {
      if (i === attempts - 1 || !(err instanceof TypeError)) throw err;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw new Error('unreachable');
}

/** allowlist + HTTPS + no redirects + bounded streaming; raw pages are never persisted. */
export async function publicGet(url: string, limit: number): Promise<Buffer> {
  const parsed = new URL(url);
  if (!ALLOWED_ORIGINS.has(parsed.origin) || parsed.username || parsed.password)
    throw new Error('허용되지 않은 수집 주소');
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error(`공공데이터 응답 오류 ${response.status}`);
  const chunks: Buffer[] = [];
  let size = 0;
  if (!response.body) throw new Error('응답 본문 없음');
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) { throw new Error('공공데이터 응답 크기 제한 초과'); }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function downloadPublicCsv(key: SourceKey): Promise<Buffer> {
  const source = PUBLIC_SOURCES[key];
  if (source.format === 'sbiz' || source.format === 'sbiz-api')
    throw new Error('소상공인 상권정보는 --sbiz-api-key 또는 --file 옵션이 필요합니다.');
  const html = (await publicGet(source.url, 4 * 1024 * 1024)).toString('utf8');
  // 라이선스가 변경되면 자동 다운로드/반영을 멈춘다.
  const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    const metadata = JSON.parse(match[1]!) as { license?: string; distribution?: { contentUrl?: string }[] };
    const unrestricted = metadata.license === '이용허락범위 제한 없음'
      || (metadata.license === 'https://data.go.kr/ugs/selectPortalPolicyView.do'
        && html.includes('이용허락범위 제한 없음'));
    if (!unrestricted) continue;
    const distributions = Array.isArray(metadata.distribution) ? metadata.distribution : [metadata.distribution];
    for (const item of distributions) {
      if (!item?.contentUrl) continue;
      const target = new URL(item.contentUrl);
      if (target.pathname !== '/cmm/cmm/fileDownload.do') continue;
      return publicGet(target.href, 4 * 1024 * 1024);
    }
  }
  throw new Error('공식 다운로드 메타데이터 또는 이용허락 확인 실패');
}

/**
 * 공공데이터포털 응답 봉투는 오퍼레이션마다 다르다 — sdsc2의 업종코드 조회는
 * `{ data: [...] }`가 아니라 여러 겹으로 감싼 모양으로 온다(2026-09-09 실 응답
 * 확인). 봉투 이름을 추측하는 대신, 기대하는 필드를 가진 첫 객체 배열을 찾는다.
 * 봉투가 바뀌어도 레코드 필드가 그대로면 계속 읽힌다.
 */
export function findRecords<T>(payload: unknown, requiredField: string): T[] {
  const queue: unknown[] = [payload];
  while (queue.length) {
    const node = queue.shift();
    if (Array.isArray(node)) {
      const rows = node.filter(
        (row): row is Record<string, unknown> =>
          !!row && typeof row === 'object' && requiredField in row);
      if (rows.length) return rows as T[];
      queue.push(...node);
    } else if (node && typeof node === 'object') {
      queue.push(...Object.values(node));
    }
  }
  return [];
}

/** 봉투 어디에 있든 이름이 같은 첫 숫자 값을 찾는다(totalCount 등). */
export function findNumber(payload: unknown, key: string): number | null {
  const queue: unknown[] = [payload];
  while (queue.length) {
    const node = queue.shift();
    if (Array.isArray(node)) queue.push(...node);
    else if (node && typeof node === 'object') {
      const value = (node as Record<string, unknown>)[key];
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
      queue.push(...Object.values(node));
    }
  }
  return null;
}

/** sbiz OpenAPI 응답의 data 배열 한 항목 */
type SbizApiRecord = {
  bizesId?: string;
  bizesNm?: string;
  brchNm?: string;
  indsSclsNm?: string;
  ctprvnCd?: string;
  rdnmAdr?: string;
};

/**
 * 소상공인진흥공단 상권정보 OpenAPI(v2)에서 특정 시도의 웨딩업종을 전수 수집한다.
 * 페이지당 최대 1000건을 처리한다. API 키는 호출 시 전달받으며 코드에
 * 하드코딩하지 않는다.
 *
 * **업종코드는 코드에 박지 않는다.** 예전 구현은 대분류 `'Q'`를 하드코딩했는데
 * 2026-08-05 활용가이드 어디에도 없는 값이라 수집이 조용히 0건이 됐다. 이제
 * 조회할 업종코드는 호출자가 넘기거나 `SBIZ_UPJONG_CODES`(쉼표 구분)로 준다 —
 * 값이 없으면 수집을 시작하지 않고 즉시 실패한다. 진짜 코드는
 * `listIndustryCategories`(largeUpjongList·middleUpjongList·smallUpjongList)를
 * 실 키로 호출해 확인한 뒤 넣는다. 코드 자리(`divId`)도 대분류 대신 소분류로
 * 좁힐 수 있게 `SBIZ_UPJONG_DIV_ID`로 바꾼다.
 *
 * 수집 카테고리 (indsSclsNm 기준):
 *   예식장 → hall
 *   결혼정보·결혼상담 → wedding_info_company
 *   사진|촬영|스튜디오 + 본식|스냅 이름 → snap (웨딩 이름만 있어도 snap)
 *   사진|촬영|스튜디오 + 웨딩|브라이덜 스튜디오 이름 → studio
 *   의류대여|드레스 + 웨딩|브라이덜 이름 → dress
 *   미용|메이크업 + 웨딩|브라이덜 이름 → makeup
 *   (classifyWeddingIndustry)
 */
export type SbizUpjongQuery = { divId: string; codes: string[] };

/** 조회할 업종 자리와 코드. 코드가 없으면 수집을 시작하지 않는다. */
export function resolveUpjongQuery(override?: SbizUpjongQuery): SbizUpjongQuery {
  const divId = override?.divId ?? process.env.SBIZ_UPJONG_DIV_ID ?? 'indsLclsCd';
  const codes = (override?.codes ?? (process.env.SBIZ_UPJONG_CODES ?? '').split(','))
    .map((c) => c.trim()).filter(Boolean);
  if (!codes.length)
    throw new Error(
      'SBIZ_UPJONG_CODES가 비어 있습니다. --lookup-category로 실제 업종코드를 확인한 뒤 지정하세요.');
  if (divId !== 'indsLclsCd' && divId !== 'indsMclsCd' && divId !== 'indsSclsCd')
    throw new Error('SBIZ_UPJONG_DIV_ID는 indsLclsCd·indsMclsCd·indsSclsCd 중 하나여야 합니다.');
  return { divId, codes };
}

export async function downloadSbizApiVendors(
  key: SourceKey,
  apiKey: string,
  at = new Date(),
  upjong?: SbizUpjongQuery,
): Promise<CollectedVendor[]> {
  const source = PUBLIC_SOURCES[key];
  if (source.format !== 'sbiz-api') throw new Error('sbiz-api 형식 출처가 아닙니다.');
  const ctprvnCd = (source as { ctprvnCd: string }).ctprvnCd;
  const query = resolveUpjongQuery(upjong);

  const vendors: CollectedVendor[] = [];
  const seen = new Set<string>();
  const MAX_PAGES = 20;

  for (const code of query.codes) {
  let seenForCode = 0;
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
    const url = new URL(source.url);
    url.searchParams.set('serviceKey', normalizeServiceKey(apiKey));
    url.searchParams.set('pageNo', String(pageNo));
    url.searchParams.set('numOfRows', '1000');
    url.searchParams.set('divId', query.divId);
    url.searchParams.set('key', code);
    url.searchParams.set('type', 'json');

    const buf = await publicGet(url.toString(), 8 * 1024 * 1024);
    const payload = JSON.parse(buf.toString('utf8')) as unknown;
    const records = findRecords<SbizApiRecord>(payload, 'bizesNm');
    const totalCount = findNumber(payload, 'totalCount');
    seenForCode += records.length;

    for (const r of records) {
      // 시도 코드로 지역 필터
      if (r.ctprvnCd !== ctprvnCd) continue;

      const branch = r.brchNm?.trim() ?? '';
      const name = [r.bizesNm?.trim(), branch].filter(Boolean).join(' ');
      const region = toRegion(r.rdnmAdr?.trim() ?? '');
      const industry = r.indsSclsNm?.trim() ?? '';

      let category: CollectedVendor['category'] | null = null;
      if (/예식장/.test(industry)) category = 'hall';
      else if (/결혼.*중개|결혼.*상담/.test(industry)) category = 'wedding_info_company';
      else category = classifyWeddingIndustry(industry, name);

      if (!name || name.length > 500 || !category || !/^\S+(?:시|도)\s+\S+/.test(region)) continue;

      const identity = `${normalizeName(name)}|${region}`;
      if (seen.has(identity)) continue;
      seen.add(identity);

      vendors.push({
        name, region, category,
        sourceKey: key,
        sourceUrl: source.url,
        sourceRecordId: r.bizesId?.trim() || null,
        publishedOn: null,
        collectedAt: at.toISOString(),
        status: 'needs_verification',
      });
    }

    const fetched = (pageNo - 1) * 1000 + records.length;
    if (!totalCount || fetched >= totalCount || records.length < 1000) break;
  }
  // 코드가 틀리면 API는 오류 대신 빈 목록을 준다 — 조용한 0건 수집을 막는다.
  if (!seenForCode) throw new Error(`업종코드 ${query.divId}=${code} 응답이 0건입니다. 코드를 확인하세요.`);
  }

  return vendors;
}

export type IndustryCategory = { code: string; name: string };

const UPJONG_ENDPOINT = { large: 'largeUpjongList', middle: 'middleUpjongList', small: 'smallUpjongList' } as const;
const UPJONG_CODE_FIELD = { large: 'indsLclsCd', middle: 'indsMclsCd', small: 'indsSclsCd' } as const;
const UPJONG_NAME_FIELD = { large: 'indsLclsNm', middle: 'indsMclsNm', small: 'indsSclsNm' } as const;

/**
 * 상권정보 업종 대/중/소분류 코드 조회 — DB 반영용이 아니라 진짜 코드값을
 * 찾기 위한 조사용이다. `downloadSbizApiVendors`가 쓰는 대분류 'Q'가
 * 공식 활용가이드에 없는 값이라(위 주석 참고), 이 함수로 중분류·소분류
 * 이름에서 "예식"·"결혼"·"웨딩" 등을 찾아 진짜 코드를 확인한다.
 *
 * `type=json` 응답이 `storeListInUpjong`과 같은 `{ data: [...] }` 모양이라고
 * 가정한다 — 활용가이드가 XML 예시만 보여줘 실제 JSON 필드명은 실키로
 * 한 번 호출해 확인 전이다.
 */
function upjongUrl(
  level: keyof typeof UPJONG_ENDPOINT,
  apiKey: string,
  parent?: { indsLclsCd?: string; indsMclsCd?: string },
): string {
  const url = new URL(`https://apis.data.go.kr/B553077/api/open/sdsc2/${UPJONG_ENDPOINT[level]}`);
  url.searchParams.set('serviceKey', normalizeServiceKey(apiKey));
  url.searchParams.set('type', 'json');
  if (parent?.indsLclsCd) url.searchParams.set('indsLclsCd', parent.indsLclsCd);
  if (parent?.indsMclsCd) url.searchParams.set('indsMclsCd', parent.indsMclsCd);
  return url.toString();
}

/**
 * 업종코드 응답 원문 앞부분을 그대로 돌려준다 — 응답 모양이 우리 가정과
 * 다를 때 무엇이 왔는지 보기 위한 진단용이다. 서비스키는 URL에만 있고
 * 본문에는 없으므로 이 값을 출력해도 키가 새지 않는다. 저장하지 않는다.
 */
export async function fetchIndustryCategoriesRaw(
  level: keyof typeof UPJONG_ENDPOINT,
  apiKey: string,
  parent?: { indsLclsCd?: string; indsMclsCd?: string },
  limit = 2000,
): Promise<string> {
  const buf = await publicGet(upjongUrl(level, apiKey, parent), 4 * 1024 * 1024);
  return buf.toString('utf8').slice(0, limit);
}

export async function listIndustryCategories(
  level: keyof typeof UPJONG_ENDPOINT,
  apiKey: string,
  parent?: { indsLclsCd?: string; indsMclsCd?: string },
): Promise<IndustryCategory[]> {
  const buf = await publicGet(upjongUrl(level, apiKey, parent), 4 * 1024 * 1024);
  const codeField = UPJONG_CODE_FIELD[level];
  const nameField = UPJONG_NAME_FIELD[level];
  const rows = findRecords<Record<string, string>>(JSON.parse(buf.toString('utf8')), codeField);

  return rows.map((row) => ({ code: row[codeField] ?? '', name: row[nameField] ?? '' }));
}

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
 * 공공데이터포털은 여기서 자주 못 붙는다.
 *
 * GitHub 러너에서 `apis.data.go.kr:443`으로 붙을 때 **연결 단계에서 10초에 끊긴다**
 * (`ConnectTimeoutError` · undici 기본 연결 제한). 2026-09-09에 세 번 불러 한 번만
 * 붙었다 — 서버가 죽은 것이 아니라 간헐적이다. `AbortSignal.timeout(30_000)`은 연결
 * 단계를 못 늘린다(그건 전체 응답 제한이다). 연결 제한 자체를 바꾸려면 undici
 * 디스패처가 필요한데 그 의존을 이 하나 때문에 더하지 않는다.
 *
 * 관측된 끊김은 한 번에 2~5분 이어진다 — 약 1분 창(2·4·8·16·32초)으로도 모자라
 * 03:19 수집이 통째로 실패했다. 주 1회 배치라 몇 분 더 기다리는 편이 실행 자체를
 * 잃는 것보다 낫다. **대기를 60초에서 멈추고 시도를 8회로 늘려 총 4분쯤 버틴다.**
 * 여기서도 못 넘기면 진짜 장애로 보고 실패시킨다 — 성공으로 바꾸지 않는다.
 *
 * 재시도할 것과 아닌 것을 가른다. 연결 실패는 `TypeError`(`fetch failed`)로 오고
 * 전체 제한 초과는 `TimeoutError`/`AbortError`로 온다 — 둘 다 다시 걸어볼 값이 있다.
 * 그 밖(주소가 틀렸다거나 리다이렉트 거부)은 다시 걸어도 같으므로 바로 던진다.
 */
function isRetriable(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const name = err instanceof Error ? err.name : '';
  return name === 'TimeoutError' || name === 'AbortError';
}

async function fetchWithRetry(url: string, attempts = 8): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    try { return await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) }); }
    catch (err) {
      if (i === attempts - 1 || !isRetriable(err)) throw err;
      /* 주소는 찍지 않는다 — 질의 문자열에 서비스 키가 들어 있다. */
      console.warn(`공공데이터 연결 실패 ${i + 1}/${attempts} — 다시 시도한다.`);
      await new Promise((r) => setTimeout(r, Math.min(2000 * 2 ** i, 60_000)));
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
  if (!response.ok) {
    // 오류 본문에 이유가 들어 있다(등록되지 않은 서비스, 파라미터 오류 등).
    // 상태코드만으로는 무엇이 잘못됐는지 알 수 없어 앞부분을 함께 올린다.
    // 서비스키는 URL에만 있고 본문에는 없으므로 키가 새지 않는다.
    const detail = await response.text().then((t) => t.slice(0, 500).replace(/\s+/g, ' ').trim())
      .catch(() => '');
    throw new Error(`공공데이터 응답 오류 ${response.status}${detail ? ` — ${detail}` : ''}`);
  }
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

/**
 * «목록이 비어 있다»와 «목록을 못 찾았다»를 가른다.
 *
 * `findRecords`는 기대 필드를 가진 **비어 있지 않은** 배열만 돌려주므로, 진짜
 * 0건(포털이 `items: []`를 준 경우)과 봉투 모양을 모르는 경우가 같은 값이 된다.
 * 둘은 사람이 할 일이 다르다 — 앞은 조건에 맞는 업종이 없는 것이고, 뒤는 코드를
 * 고쳐야 하는 것이다. 봉투 안의 배열이 하나라도 있고 그것들이 전부 비어 있으면
 * 포털이 목록 자리를 주고 비워 둔 것으로 본다.
 */
export function hasEmptyListSlot(payload: unknown): boolean {
  const queue: unknown[] = [payload];
  let sawArray = false;
  while (queue.length) {
    const node = queue.shift();
    if (Array.isArray(node)) {
      if (node.length) return false;
      sawArray = true;
    } else if (node && typeof node === 'object') {
      queue.push(...Object.values(node));
    }
  }
  return sawArray;
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
): Promise<{ vendors: CollectedVendor[]; fetched: number; rejected: number; duplicates: number;
  truncated: { code: string; got: number; total: number }[] }> {
  const source = PUBLIC_SOURCES[key];
  if (source.format !== 'sbiz-api') throw new Error('sbiz-api 형식 출처가 아닙니다.');
  /*
   * 지역 필터. 시도 출처(`sbiz-seoul` 등)는 값이 있고, 전국 출처(`sbiz-all`)는
   * 없다 — 없으면 거르지 않고 전부 받는다. API가 전국을 돌려주므로 전국 출처는
   * 같은 응답을 한 번만 내려받아 다 쓴다.
   */
  const ctprvnCd = (source as { ctprvnCd?: string }).ctprvnCd;
  const query = resolveUpjongQuery(upjong);

  const vendors: CollectedVendor[] = [];
  const seen = new Set<string>();
  /*
   * 페이지 상한. 20페이지(2만 건)는 시도 하나를 걸러낼 때의 값이었다. 전국
   * 전수는 그보다 크다 — 상한에 걸려 조용히 잘리면 「싹다」가 아니게 되므로
   * 넉넉히 두고, 대신 잘렸을 때 그 사실을 리포트에 남긴다(truncated).
   * 무한 루프 방지용 안전장치로만 쓴다.
   */
  const MAX_PAGES = Number(process.env.SBIZ_MAX_PAGES ?? 500);

  let fetched = 0;
  let rejected = 0;
  let duplicates = 0;
  /** 상한에 걸려 다 못 받은 업종코드. 비어 있어야 「전수」다. */
  const truncated: { code: string; got: number; total: number }[] = [];

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
    fetched += records.length;

    for (const r of records) {
      // 시도 코드로 지역 필터. 전국 출처는 거르지 않는다.
      if (ctprvnCd && r.ctprvnCd !== ctprvnCd) { rejected++; continue; }

      const branch = r.brchNm?.trim() ?? '';
      const name = [r.bizesNm?.trim(), branch].filter(Boolean).join(' ');
      const region = toRegion(r.rdnmAdr?.trim() ?? '');
      const industry = r.indsSclsNm?.trim() ?? '';

      let category: CollectedVendor['category'] | null = null;
      if (/예식장/.test(industry)) category = 'hall';
      else if (/결혼.*중개|결혼.*상담/.test(industry)) category = 'wedding_info_company';
      else category = classifyWeddingIndustry(industry, name);

      if (!name || name.length > 500 || !category || !/^\S+(?:시|도)\s+\S+/.test(region)) {
        rejected++; continue;
      }

      const identity = `${normalizeName(name)}|${region}`;
      if (seen.has(identity)) { duplicates++; continue; }
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

    if (!totalCount || seenForCode >= totalCount || records.length < 1000) break;
    // 상한에서 멈추는 것은 다 받은 것과 다르다. 그 사실을 리포트로 넘긴다.
    if (pageNo === MAX_PAGES) truncated.push({ code, got: seenForCode, total: totalCount });
  }
  // 코드가 틀리면 API는 오류 대신 빈 목록을 준다 — 조용한 0건 수집을 막는다.
  if (!seenForCode) throw new Error(`업종코드 ${query.divId}=${code} 응답이 0건입니다. 코드를 확인하세요.`);
  }

  return { vendors, fetched, rejected, duplicates, truncated };
}

export type IndustryCategory = { code: string; name: string };

const UPJONG_ENDPOINT = { large: 'largeUpjongList', middle: 'middleUpjongList', small: 'smallUpjongList' } as const;
const UPJONG_CODE_FIELD = { large: 'indsLclsCd', middle: 'indsMclsCd', small: 'indsSclsCd' } as const;
const UPJONG_NAME_FIELD = { large: 'indsLclsNm', middle: 'indsMclsNm', small: 'indsSclsNm' } as const;

/**
 * 상권정보 업종 대/중/소분류 코드 조회 — DB 반영용이 아니라 수집에 넣을 진짜
 * 코드값을 찾기 위한 조사용이다. 이름에서 "예식"·"결혼"·"웨딩" 등을 찾아
 * `SBIZ_UPJONG_CODES`에 넣을 코드를 확인한다.
 *
 * 2026-09-09 실키 호출로 확인한 웨딩 관련 소분류(`indsSclsCd`):
 *   S21101 예식장업 · S21105 결혼 상담 서비스업 · M11301 사진촬영업 ·
 *   N11004 의류 대여업 · S20701 미용실.
 * 대분류는 두 글자 열아홉 개이고 한 글자 'Q'는 없다 — 예전 하드코딩이 틀렸다.
 *
 * **응답 껍데기가 한 가지가 아니다**(2026-09-09 실키 호출로 확인). 공공데이터포털은
 * `{ response: { body: { items: [...] } } }` 표준 봉투를 쓰는 곳과 `{ data: [...] }`를
 * 그대로 주는 곳이 섞여 있고, `items`가 `{ item: [...] }`로 한 겹 더 싸이기도 한다.
 * 한 모양만 보면 목록을 못 찾고도 «0건»으로 조용히 끝난다 — 실제로 그랬다.
 * 그래서 `findRecords`로 기대 필드를 가진 배열을 봉투 어디서든 찾고,
 * 어디서도 못 찾으면 그 사실을 알린다.
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
  const page = JSON.parse(buf.toString('utf8')) as unknown;
  const codeField = UPJONG_CODE_FIELD[level];
  const nameField = UPJONG_NAME_FIELD[level];

  assertServiceOk(page);

  /*
   * #137은 알려진 봉투 자리를 나열해 찾았다. 여기서는 `findRecords`로 기대 필드를
   * 가진 배열을 봉투 어디서든 찾는다 — 2026-09-09 실 응답이 나열된 자리 중 어디에도
   * 없는 모양이었고, 자리를 하나씩 추가하는 방식은 다음 변형에서 또 막힌다.
   * 못 찾았을 때 던지는 것은 #137 그대로다 — «0건»과 «모양을 모름»은 다르다.
   * findRecords는 비어 있지 않은 배열만 돌려주므로 빈 결과는 곧 «못 찾음»이다.
   */
  const rows = findRecords<Record<string, string>>(page, codeField);
  if (!rows.length) {
    // 목록 자리를 주고 비워 둔 것이면 진짜 0건이다. 못 찾은 것과 구분한다.
    if (hasEmptyListSlot(page)) return [];
    // 값이 아니라 **자리 이름만** 알린다. 본문을 찍으면 서비스 키가 섞여 나올 수 있다.
    throw new Error(
      `업종 목록을 응답에서 찾지 못했다. 최상위 키: ${describeShape(page)}. ` +
        `찾던 필드: ${codeField}.`
    );
  }

  return rows.map((row) => ({ code: row[codeField] ?? '', name: row[nameField] ?? '' }));
}

/**
 * 응답 머리의 결과 코드를 먼저 본다.
 *
 * 공공데이터포털은 **키를 거절해도 HTTP 200**으로 답한다. 머리만 실패고 몸통은
 * 비어 있어서, 검사하지 않으면 「업종 0건」으로 조용히 끝난다. 실제로 그렇게 끝났다.
 *
 * 여기서 갈리는 것은 대부분 **개발계정과 운영계정의 차이**다. 개발계정 키는 하루
 * 1,000건이고 오퍼레이션마다 승인 범위가 다르다. 운영계정은 활용신청이 승인돼야
 * 나온다. 사용자 결정(2026-09-09) — **운영계정 키 하나로 통일한다.** 그래서 코드를
 * 그대로 던지지 않고, 사람이 무엇을 해야 하는지까지 적는다.
 *
 * 메시지에 키를 담지 않는다 — 코드와 서비스가 준 문구만 옮긴다.
 */
function assertServiceOk(page: unknown): void {
  const at = (value: unknown, key: string): unknown =>
    value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;

  const header = at(at(page, 'response'), 'header') ?? at(page, 'header');
  const code = at(header, 'resultCode');
  if (typeof code !== 'string' || code === '' || Number(code) === 0) return;

  const message = typeof at(header, 'resultMsg') === 'string' ? (at(header, 'resultMsg') as string) : '';
  const guide = SERVICE_RESULT_GUIDE[code];

  throw new Error(
    `공공데이터 응답이 실패다(resultCode ${code}${message ? ` · ${message}` : ''}). ` +
      (guide ?? '포털 마이페이지 → 오픈API → 개발계정에서 이 오퍼레이션의 승인 상태를 확인해라.')
  );
}

/** 계정 때문에 나는 코드만 적는다. 나머지는 서비스가 준 문구를 그대로 보여준다. */
const SERVICE_RESULT_GUIDE: Record<string, string> = {
  '20': '접근이 거부됐다 — 이 오퍼레이션이 승인 범위 밖이다. 운영계정 활용신청에 포함시켜야 한다.',
  '22': '요청 한도를 넘겼다 — 개발계정은 하루 1,000건이다. 운영계정 키로 바꿔라.',
  '30': '등록되지 않은 서비스 키다 — SBIZ_API_KEY에 운영계정 키가 들어 있는지 확인해라.',
  '31': '활용기간이 끝났다 — 포털에서 연장을 신청해야 한다.',
  '32': '등록되지 않은 주소에서 불렀다 — 활용신청의 허용 주소를 확인해라.',
};

/** 응답의 «모양»만 한 줄로. 값은 담지 않는다. */
function describeShape(page: unknown): string {
  if (page === null || typeof page !== 'object') return typeof page;
  if (Array.isArray(page)) return `array(${page.length})`;

  const keys = Object.keys(page as Record<string, unknown>);
  return keys.length ? keys.join(' · ') : '(빈 객체)';
}

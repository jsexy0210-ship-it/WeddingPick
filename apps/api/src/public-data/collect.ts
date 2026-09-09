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
 * 그래서 **시도 횟수를 늘리고 간격을 벌린다.** 최악이 5회 × 10초 + 대기 30초로
 * 80초 남짓이고, 이 함수를 쓰는 잡의 제한은 10~15분이라 여유가 있다.
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

async function fetchWithRetry(url: string, attempts = 5): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    try { return await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) }); }
    catch (err) {
      if (i === attempts - 1 || !isRetriable(err)) throw err;
      /* 주소는 찍지 않는다 — 질의 문자열에 서비스 키가 들어 있다. */
      console.warn(`공공데이터 연결 실패 ${i + 1}/${attempts} — 다시 시도한다.`);
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

/** sbiz OpenAPI 응답의 data 배열 한 항목 */
type SbizApiRecord = {
  bizesId?: string;
  bizesNm?: string;
  brchNm?: string;
  indsSclsNm?: string;
  ctprvnCd?: string;
  rdnmAdr?: string;
};

type SbizApiPage = {
  currentCount?: number;
  totalCount?: number;
  pageIndex?: number;
  pageSize?: number;
  data?: SbizApiRecord[];
};

/**
 * 소상공인진흥공단 상권정보 OpenAPI(v2)에서 특정 시도의 웨딩업종을 전수 수집한다.
 * 페이지당 최대 1000건을 처리한다. API 키는 호출 시 전달받으며 코드에
 * 하드코딩하지 않는다.
 *
 * **주의 — 대분류 코드 'Q'는 확인 전이다.** 2026-08-05 승인된 공식
 * 활용가이드의 대분류 코드는 전부 "영문자+숫자" 두 글자다(F1·G2·I1·I2·J1·
 * L1·M1·N1·O1·P1·Q1·R1·S1·S2 등 — 예: Q1=보건의료). 가이드 어디에도 웨딩
 * 관련 대분류나 'Q' 단독 코드는 없다 — 실제 API가 이 값으로 빈 결과를
 * 돌려주고 있을 가능성이 높다(수집 자체가 조용히 0건). `listIndustryCategories`로
 * 중/소분류를 뒤져 진짜 코드를 찾은 뒤 여기 'Q'를 교체해야 한다.
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
export async function downloadSbizApiVendors(
  key: SourceKey,
  apiKey: string,
  at = new Date(),
): Promise<CollectedVendor[]> {
  const source = PUBLIC_SOURCES[key];
  if (source.format !== 'sbiz-api') throw new Error('sbiz-api 형식 출처가 아닙니다.');
  const ctprvnCd = (source as { ctprvnCd: string }).ctprvnCd;

  const vendors: CollectedVendor[] = [];
  const seen = new Set<string>();
  const MAX_PAGES = 20;

  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
    const url = new URL(source.url);
    url.searchParams.set('serviceKey', normalizeServiceKey(apiKey));
    url.searchParams.set('pageNo', String(pageNo));
    url.searchParams.set('numOfRows', '1000');
    // 업종 대분류 Q = 결혼관련서비스업 (소상공인진흥공단 기준)
    url.searchParams.set('divId', 'indsLclsCd');
    url.searchParams.set('key', 'Q');
    url.searchParams.set('type', 'json');

    const buf = await publicGet(url.toString(), 8 * 1024 * 1024);
    const page = JSON.parse(buf.toString('utf8')) as SbizApiPage;
    const records = page.data ?? [];

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
    if (!page.totalCount || fetched >= page.totalCount || records.length < 1000) break;
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
 * **응답 껍데기가 한 가지가 아니다**(2026-09-09 실키 호출로 확인). 공공데이터포털은
 * `{ response: { body: { items: [...] } } }` 표준 봉투를 쓰는 곳과 `{ data: [...] }`를
 * 그대로 주는 곳이 섞여 있고, `items`가 `{ item: [...] }`로 한 겹 더 싸이기도 한다.
 * 한 모양만 보면 목록을 못 찾고도 «0건»으로 조용히 끝난다 — 실제로 그랬다.
 * 그래서 알려진 자리를 차례로 보고, 어디서도 못 찾으면 그 사실을 알린다.
 */
export async function listIndustryCategories(
  level: keyof typeof UPJONG_ENDPOINT,
  apiKey: string,
  parent?: { indsLclsCd?: string; indsMclsCd?: string },
): Promise<IndustryCategory[]> {
  const url = new URL(`https://apis.data.go.kr/B553077/api/open/sdsc2/${UPJONG_ENDPOINT[level]}`);
  url.searchParams.set('serviceKey', normalizeServiceKey(apiKey));
  url.searchParams.set('type', 'json');
  if (parent?.indsLclsCd) url.searchParams.set('indsLclsCd', parent.indsLclsCd);
  if (parent?.indsMclsCd) url.searchParams.set('indsMclsCd', parent.indsMclsCd);

  const buf = await publicGet(url.toString(), 4 * 1024 * 1024);
  const page = JSON.parse(buf.toString('utf8')) as unknown;
  const codeField = UPJONG_CODE_FIELD[level];
  const nameField = UPJONG_NAME_FIELD[level];

  const rows = findCategoryRows(page);
  if (rows === null) {
    /*
     * 목록을 못 찾았다. «0건»과 구분되어야 한다 — 0건은 조회가 된 것이고 이쪽은
     * 응답 모양을 모르는 것이다. 값이 아니라 **자리 이름만** 알린다(키에 개인정보나
     * 인증 정보가 담기지 않는다). 본문 전체를 찍으면 서비스 키가 섞여 나올 수 있다.
     */
    throw new Error(
      `업종 목록을 응답에서 찾지 못했다. 최상위 키: ${describeShape(page)}. ` +
        '봉투 모양이 또 다르다 — findCategoryRows에 그 자리를 추가해야 한다.'
    );
  }

  return rows.map((row) => ({ code: row[codeField] ?? '', name: row[nameField] ?? '' }));
}

/** 알려진 자리를 차례로 본다. 어디에도 없으면 `null` — 빈 배열과 구분한다. */
function findCategoryRows(page: unknown): Record<string, string>[] | null {
  const asRows = (value: unknown): Record<string, string>[] | null =>
    Array.isArray(value) ? (value as Record<string, string>[]) : null;

  const at = (value: unknown, key: string): unknown =>
    value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;

  const body = at(at(page, 'response'), 'body');
  const candidates: unknown[] = [
    at(page, 'data'),
    at(body, 'items'),
    at(at(body, 'items'), 'item'),
    at(body, 'item'),
    at(page, 'items'),
    at(at(page, 'items'), 'item'),
    page,
  ];

  for (const candidate of candidates) {
    const rows = asRows(candidate);
    if (rows) return rows;
  }
  return null;
}

/** 응답의 «모양»만 한 줄로. 값은 담지 않는다. */
function describeShape(page: unknown): string {
  if (page === null || typeof page !== 'object') return typeof page;
  if (Array.isArray(page)) return `array(${page.length})`;

  const keys = Object.keys(page as Record<string, unknown>);
  return keys.length ? keys.join(' · ') : '(빈 객체)';
}

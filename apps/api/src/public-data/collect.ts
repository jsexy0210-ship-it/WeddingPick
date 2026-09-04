import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { toRegion } from './localdata';
import { PUBLIC_SOURCES, type SourceKey } from './sources';

export type CollectedVendor = {
  name: string;
  region: string;
  category: 'hall' | 'sdm' | 'snap' | 'wedding_info_company';
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
      else if (/사진/.test(industry) && /웨딩|본식/.test(name)) category = 'snap';
      else if (/미용|메이크업|의류.*대여/.test(industry) && /웨딩|브라이덜/.test(name)) category = 'sdm';
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

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    try { return await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30_000) }); }
    catch (err) {
      if (i === attempts - 1 || !(err instanceof TypeError)) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error('unreachable');
}

/** allowlist + HTTPS + no redirects + bounded streaming; raw pages are never persisted. */
export async function publicGet(url: string, limit: number): Promise<Buffer> {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://www.data.go.kr' || parsed.username || parsed.password)
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
  if (source.format === 'sbiz') throw new Error('전국 상권정보는 승인된 API 키 또는 공식 지역별 CSV가 필요합니다. --file 사용');
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

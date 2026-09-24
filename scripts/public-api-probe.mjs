/*
 * 공공데이터포털 OpenAPI를 한 번 불러 응답 «모양»만 로그에 찍는다. 읽기 전용이다.
 *
 * 작업 세션 컨테이너는 data.go.kr이 막혀 있어 응답을 직접 못 본다(2026-09-24).
 * 모양을 모르고 수집기를 짜면 엉뚱한 칸을 읽는다 — 그래서 러너에서 먼저 한 번 본다.
 * DB에 붙지 않고 아무것도 쓰지 않는다.
 *
 *   PUBLIC_API_KEY=... node scripts/public-api-probe.mjs <endpoint> [key=value ...]
 *   node scripts/public-api-probe.mjs https://www.data.go.kr/data/<번호>/fileData.do
 *
 * - OpenAPI 주소는 data.go.kr OpenAPI 호스트만 받는다. 다른 곳으로 키가 나가지 않게 한다.
 * - 파일데이터 페이지(`www.data.go.kr/data/<번호>/fileData.do`)를 주면 키 없이 공식
 *   다운로드 링크(ld+json `contentUrl`)로 파일을 받아 앞부분 표를 찍는다(CSV · XLSX).
 * - 키는 로그에 찍지 않는다. 요청 주소도 키를 가린 채로만 찍는다.
 * - 전화 · 주소 · 좌표 칸은 값 대신 「값 있음」만 찍는다(public-data/README.md —
 *   원본 전화번호 · 상세주소 · 좌표를 로그에 남기지 않는다).
 */

import { inflateRawSync } from 'node:zlib';

export const ALLOWED_HOSTS = new Set(['apis.data.go.kr', 'api.data.go.kr']);
const SENSITIVE_FIELD = /전화|tel|phone|fax|주소|addr|위도|경도|lat|lon|lng|좌표|x좌표|y좌표/i;
const PREVIEW_MAX = 40;
const FILE_PAGE = /^https:\/\/www\.data\.go\.kr\/data\/\d+\/fileData\.do$/;
const FILE_LIMIT = 8 * 1024 * 1024;

/** 요청 주소를 만든다. 허용 호스트가 아니면 던진다. */
export function buildUrl(endpoint, params, serviceKey) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`지원하지 않는 주소: ${endpoint}`);
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`data.go.kr OpenAPI 호스트만 받는다: ${url.hostname}`);
  }
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  // 포털은 인코딩 키와 디코딩 키를 둘 다 준다. 이미 인코딩된 키를 다시 인코딩하면
  // SERVICE_KEY_IS_NOT_REGISTERED_ERROR가 난다 — `%`가 있으면 그대로 붙인다.
  const encoded = serviceKey.includes('%') ? serviceKey : encodeURIComponent(serviceKey);
  const separator = url.search ? '&' : '?';

  return `${url.toString()}${separator}serviceKey=${encoded}`;
}

/** 로그에 찍을 주소 — 키를 가린다. */
export function redactUrl(url) {
  return url.replace(/([?&]serviceKey=)[^&]*/i, '$1***');
}

function preview(name, value) {
  if (value === null || value === undefined || value === '') return '(빈 값)';
  if (typeof value === 'object') return Array.isArray(value) ? `(배열 ${value.length})` : '(객체)';
  const text = String(value);
  if (SENSITIVE_FIELD.test(name)) return `(값 있음 · ${text.length}자)`;

  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX)}…` : text;
}

/** JSON 응답 안에서 가장 먼저 나오는 «객체 배열»을 찾는다 — 그것이 항목 목록이다. */
export function findItems(node, depth = 0) {
  if (depth > 6 || node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    if (node.length > 0 && node.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
      return node;
    }
    return null;
  }
  // 포털 JSON은 항목이 하나면 배열 대신 객체 하나로 오기도 한다(items.item).
  if (node.item && typeof node.item === 'object' && !Array.isArray(node.item)) return [node.item];
  for (const value of Object.values(node)) {
    const found = findItems(value, depth + 1);
    if (found) return found;
  }
  return null;
}

function findValue(node, keys, depth = 0) {
  if (depth > 6 || node === null || typeof node !== 'object') return undefined;
  for (const [key, value] of Object.entries(node)) {
    if (keys.includes(key) && (typeof value !== 'object' || value === null)) return value;
  }
  for (const value of Object.values(node)) {
    const found = findValue(value, keys, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** 응답 본문을 사람이 읽을 요약 줄들로 바꾼다. */
export function summarize(body, sampleCount = 2) {
  const lines = [];
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    json = undefined;
  }

  if (json !== undefined) {
    lines.push('형식: JSON');
    lines.push(`결과 코드: ${findValue(json, ['resultCode', 'returnReasonCode']) ?? '(없음)'}`);
    lines.push(`결과 메시지: ${findValue(json, ['resultMsg', 'returnAuthMsg', 'errMsg']) ?? '(없음)'}`);
    lines.push(`전체 건수: ${findValue(json, ['totalCount', 'matchCount']) ?? '(없음)'}`);
    const items = findItems(json);
    if (!items) {
      lines.push('항목 목록을 찾지 못했다. 최상위 키: ' + Object.keys(json).join(', '));
      return lines;
    }
    lines.push(`받은 항목: ${items.length}건 · 칸 ${Object.keys(items[0]).length}개`);
    items.slice(0, sampleCount).forEach((item, index) => {
      lines.push(`--- 항목 ${index + 1}`);
      for (const [name, value] of Object.entries(item)) lines.push(`  ${name}: ${preview(name, value)}`);
    });
    return lines;
  }

  const tag = (name) => body.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1];
  if (/^\s*</.test(body)) {
    lines.push('형식: XML');
    lines.push(`결과 코드: ${tag('resultCode') ?? tag('returnReasonCode') ?? '(없음)'}`);
    lines.push(`결과 메시지: ${tag('resultMsg') ?? tag('returnAuthMsg') ?? tag('errMsg') ?? '(없음)'}`);
    lines.push(`전체 건수: ${tag('totalCount') ?? '(없음)'}`);
    const items = [...body.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
    lines.push(`받은 항목: ${items.length}건`);
    items.slice(0, sampleCount).forEach((item, index) => {
      lines.push(`--- 항목 ${index + 1}`);
      for (const [, name, value] of item.matchAll(/<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g)) {
        lines.push(`  ${name}: ${preview(name, value)}`);
      }
    });
    return lines;
  }

  lines.push('형식: 알 수 없음');
  lines.push(`앞부분: ${body.slice(0, 300)}`);
  return lines;
}

/** 파일데이터 페이지인가 — 이것만 키 없이 받는다. */
export function isFilePage(url) {
  return FILE_PAGE.test(url.split('?')[0]);
}

/**
 * 파일데이터 페이지에서 공식 다운로드 주소와 이용허락을 읽는다.
 * `apps/api/src/public-data/collect.ts`의 `downloadPublicCsv`와 같은 자리(ld+json)를 본다.
 */
export function findDownload(html) {
  const license = html.includes('이용허락범위 제한 없음') ? '이용허락범위 제한 없음' : '(확인 필요)';
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let metadata;
    try {
      metadata = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const distributions = Array.isArray(metadata.distribution) ? metadata.distribution : [metadata.distribution];
    for (const item of distributions) {
      if (!item?.contentUrl) continue;
      const target = new URL(item.contentUrl, 'https://www.data.go.kr');
      if (target.hostname.endsWith('data.go.kr') && target.pathname === '/cmm/cmm/fileDownload.do') {
        return { url: target.href, license, name: metadata.name ?? '', format: item.encodingFormat ?? '' };
      }
    }
  }
  return null;
}

/** zip 안의 파일 하나를 꺼낸다(XLSX는 zip이다). 표준 라이브러리만 쓴다. */
export function unzipEntry(buffer, wanted) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('zip 끝 표시를 찾지 못했다');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  for (let n = 0; n < count; n += 1) {
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    if (name === wanted) {
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error(`지원하지 않는 압축 방식 ${method}`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

const xmlText = (text) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** XLSX 첫 시트를 행 배열로 읽는다. */
export function readXlsx(buffer) {
  const shared = [];
  const sharedXml = unzipEntry(buffer, 'xl/sharedStrings.xml');
  if (sharedXml) {
    for (const [, si] of sharedXml.toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      shared.push(xmlText([...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join('')));
    }
  }
  const sheet = unzipEntry(buffer, 'xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('첫 시트(sheet1.xml)가 없다');
  const rows = [];
  for (const [, rowXml] of sheet.toString('utf8').matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const [, attrs, inner] of rowXml.matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1] ?? '';
      const column = [...ref].reduce((sum, ch) => sum * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const type = attrs.match(/t="([^"]+)"/)?.[1];
      const raw = inner?.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = '';
      if (type === 's' && raw !== undefined) value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = xmlText(inner?.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '');
      else if (raw !== undefined) value = xmlText(raw);
      if (column >= 0) row[column] = value;
    }
    rows.push(Array.from(row, (cell) => cell ?? ''));
  }
  return rows;
}

/** CSV를 행 배열로 읽는다. UTF-8이 깨지면 CP949(EUC-KR)로 다시 읽는다. */
export function readCsv(buffer) {
  let text = buffer.toString('utf8');
  if (text.includes('�')) text = new TextDecoder('euc-kr').decode(buffer);
  return text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => line.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim()));
}

/** 표 앞부분을 찍을 줄로 바꾼다. 머리글이 전화·주소·좌표인 칸은 가린다. */
export function tableLines(rows, maxRows = 40) {
  const header = rows[0] ?? [];
  const hidden = header.map((name) => SENSITIVE_FIELD.test(String(name)));
  const lines = [`행 ${rows.length}개 · 열 ${header.length}개`];
  rows.slice(0, maxRows).forEach((row, index) => {
    const cells = row.map((cell, column) => (index > 0 && hidden[column] && cell ? '(값 있음)' : cell));
    lines.push(`${String(index + 1).padStart(3)}: ${cells.join(' | ')}`);
  });
  return lines;
}

async function probeFile(pageUrl) {
  const page = await fetch(pageUrl, { signal: AbortSignal.timeout(20000) });
  const html = await page.text();
  console.log(`페이지: ${pageUrl} · 상태 ${page.status}`);
  const download = findDownload(html);
  if (!download) throw new Error('공식 다운로드 링크(ld+json contentUrl)를 찾지 못했다');
  console.log(`이름: ${download.name} · 형식: ${download.format} · 이용허락: ${download.license}`);
  const response = await fetch(download.url, { signal: AbortSignal.timeout(30000) });
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > FILE_LIMIT) throw new Error(`파일이 너무 크다: ${buffer.length} bytes`);
  const isZip = buffer.readUInt32LE(0) === 0x04034b50;
  console.log(`파일: 상태 ${response.status} · ${buffer.length} bytes · ${isZip ? 'XLSX(zip)' : 'CSV로 읽음'}`);
  for (const line of tableLines(isZip ? readXlsx(buffer) : readCsv(buffer))) console.log(line);
}

async function main() {
  const [endpoint, ...pairs] = process.argv.slice(2);
  const serviceKey = process.env.PUBLIC_API_KEY ?? '';
  if (!endpoint) throw new Error('조회할 End Point 주소가 필요하다.');
  if (isFilePage(endpoint)) return probeFile(endpoint);
  if (!serviceKey) throw new Error('PUBLIC_API_KEY가 비어 있다. 고른 GitHub Secret이 등록돼 있는지 확인한다.');

  const params = { pageNo: '1', numOfRows: '3', type: 'json' };
  for (const pair of pairs) {
    const at = pair.indexOf('=');
    if (at <= 0) throw new Error(`key=value 모양이 아니다: ${pair}`);
    params[pair.slice(0, at)] = pair.slice(at + 1);
  }

  const url = buildUrl(endpoint, params, serviceKey);
  console.log(`요청: ${redactUrl(url)}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  const body = await response.text();
  console.log(`상태: ${response.status} · ${response.headers.get('content-type') ?? '(형식 없음)'} · ${body.length} bytes`);
  for (const line of summarize(body)) console.log(line.split(serviceKey).join('***'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`실패: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

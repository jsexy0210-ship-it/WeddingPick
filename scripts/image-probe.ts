/**
 * 업체 이미지가 **외부 URL**이라 생기는 값을 실제로 잰다. 아무것도 바꾸지 않는다.
 *
 * 「외부 URL이면 출력 속도 문제가 없는가 · 내부 저장소로 옮기면 요금이 얼마인가」를
 * 묻는 자리다(2026-09-10 사용자). 둘 다 **바이트와 밀리초를 재야** 답할 수 있다 —
 * 지금 저장소에는 이미지가 몇 장인지 세는 도구만 있고 얼마나 무거운지 재는 것은 없었다.
 *
 * 재는 것:
 *   크기      Content-Length. 저장 용량과 전송량의 근거다.
 *   응답      첫 바이트까지 걸린 시간과 전체 시간. 화면에 그림이 뜨는 속도다.
 *   상태      403(핫링크 차단) · 404(이미 사라짐)를 센다. 깨진 그림은 느린 것보다 나쁘다.
 *   호스트     몇 군데에 흩어져 있는가. 많을수록 연결을 새로 여는 횟수가 늘어난다.
 *
 * 출력은 집계와 호스트 이름뿐이다. 이미지 URL 전체는 찍지 않는다 — 로그에 남으면
 * 그대로 남는다.
 */
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
const SAMPLE = Number(process.env.SAMPLE ?? 120);
/** 한 장에 이만큼 넘게 기다리지 않는다. 넘으면 「느림」으로 세고 넘어간다. */
const TIMEOUT_MS = 10_000;

if (!url) {
  console.error('::error::DATABASE_URL이 없다.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes('localhost') || url.includes('127.0.0.1') ? undefined : { rejectUnauthorized: false },
});

type Probe = {
  host: string;
  status: number | null;
  bytes: number | null;
  ttfbMs: number | null;
  totalMs: number | null;
  error: string | null;
};

/**
 * 한 장을 받아 본다. **GET으로 받되 몸통은 버린다** — HEAD를 막아두고 GET만 받는
 * 서버가 흔해서, HEAD만 재면 실제보다 실패가 많이 나온다.
 */
async function probe(imageUrl: string): Promise<Probe> {
  const host = (() => {
    try {
      return new URL(imageUrl).host;
    } catch {
      return '(주소 형식 아님)';
    }
  })();

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: { accept: 'image/*,*/*' },
    });
    const ttfbMs = Date.now() - started;
    const buffer = await response.arrayBuffer();

    return {
      host,
      status: response.status,
      bytes: buffer.byteLength || Number(response.headers.get('content-length')) || null,
      ttfbMs,
      totalMs: Date.now() - started,
      error: null,
    };
  } catch (error) {
    return {
      host,
      status: null,
      bytes: null,
      ttfbMs: null,
      totalMs: Date.now() - started,
      error: (error as Error).name === 'AbortError' ? '시간 초과' : (error as Error).message.split('\n')[0],
    };
  } finally {
    clearTimeout(timer);
  }
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
}

const mb = (bytes: number) => (bytes / 1_048_576).toFixed(1);

async function main(): Promise<void> {
  const { rows: total } = await pool.query<{ 건수: string }>(
    'SELECT count(*) AS 건수 FROM structured.vendor_images',
  );
  const all = Number(total[0]?.건수 ?? 0);

  const { rows } = await pool.query<{ source_url: string }>(
    `SELECT source_url FROM structured.vendor_images
      WHERE source_url IS NOT NULL
      ORDER BY random() LIMIT $1`,
    [SAMPLE],
  );

  console.log(`이미지 ${all}장 중 ${rows.length}장을 표본으로 잰다 (한 장 제한 ${TIMEOUT_MS / 1000}초)\n`);

  /* 한 번에 8장씩. 실제 화면도 여러 장을 동시에 받으므로 한 장씩 재면 너무 느리게 나온다. */
  const results: Probe[] = [];

  for (let index = 0; index < rows.length; index += 8) {
    const batch = rows.slice(index, index + 8);

    results.push(...(await Promise.all(batch.map((row) => probe(row.source_url)))));
  }

  const ok = results.filter((r) => r.status === 200 && r.bytes !== null);
  const sizes = ok.map((r) => r.bytes!);
  const times = ok.map((r) => r.totalMs!);
  const bytesTotal = sizes.reduce((sum, value) => sum + value, 0);
  const average = ok.length === 0 ? 0 : bytesTotal / ok.length;

  console.log('받아진 것');
  console.log(`  성공(200)                 ${ok.length} / ${results.length}`);

  const byStatus = new Map<string, number>();

  for (const r of results) {
    const key = r.error ? `오류: ${r.error}` : `HTTP ${r.status}`;

    byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
  }
  for (const [key, value] of [...byStatus].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key.padEnd(24)} ${value}`);
  }

  console.log('\n크기');
  console.log(`  평균                      ${Math.round(average / 1024)} KB`);
  console.log(`  중앙값                     ${Math.round(percentile(sizes, 50) / 1024)} KB`);
  console.log(`  상위 10%(p90)             ${Math.round(percentile(sizes, 90) / 1024)} KB`);
  console.log(`  가장 큰 것                  ${Math.round(percentile(sizes, 100) / 1024)} KB`);
  console.log(`  표본 합계                   ${mb(bytesTotal)} MB`);
  console.log(`  전체 ${all}장 환산            ${mb(average * all)} MB`);

  console.log('\n응답 시간 (내려받기 완료까지)');
  console.log(`  중앙값                     ${percentile(times, 50)} ms`);
  console.log(`  p90                       ${percentile(times, 90)} ms`);
  console.log(`  p99                       ${percentile(times, 99)} ms`);
  console.log(`  가장 느린 것                 ${percentile(times, 100)} ms`);

  console.log('\n어디에 흩어져 있나');
  const byHost = new Map<string, number>();

  for (const r of results) byHost.set(r.host, (byHost.get(r.host) ?? 0) + 1);

  console.log(`  서로 다른 호스트              ${byHost.size}곳`);
  for (const [host, value] of [...byHost].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`    ${host.padEnd(40)} ${value}`);
  }

  await pool.end();
}

main().catch((error: Error) => {
  console.error(`::error::측정 실패: ${error.message.split('\n')[0]}`);
  process.exit(1);
});

/*
 * 박람회 일정 페이지를 받아 「웨딩」이 들어간 줄만 로그에 찍는다. 읽기 전용이다.
 *
 * 작업 세션 컨테이너는 외부 사이트가 막혀 있어 박람회 일정을 직접 못 읽는다
 * (2026-09-24). GitHub Actions 러너는 열려 있으므로 여기서 받아 로그로 넘긴다 —
 * 그 로그를 보고 공식 페이지에서 확인된 값만 data/expos/*.json 후보로 옮긴다.
 * DB에 붙지 않고 아무것도 쓰지 않는다.
 *
 *   node scripts/expo-page-probe.mjs <url> [<url> ...]
 */

const KEYWORD = /웨딩|wedding|결혼|혼수|허니문/i;
const MAX_LINES_PER_PAGE = 120;

function textLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|td|th|h\d|dd|dt|a|span)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

async function probe(url) {
  console.log(`\n===== ${url}`);
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; WeddingPickExpoProbe/1.0)', 'accept-language': 'ko-KR,ko' },
      signal: AbortSignal.timeout(20000),
    });
    const html = await response.text();
    console.log(`status ${response.status} · ${html.length} bytes`);
    const lines = textLines(html);
    let printed = 0;
    for (let i = 0; i < lines.length && printed < MAX_LINES_PER_PAGE; i += 1) {
      if (!KEYWORD.test(lines[i])) continue;
      // 제목 줄 앞뒤에 날짜·장소가 붙어 있는 경우가 많아 두 줄씩 같이 본다.
      const context = lines.slice(Math.max(0, i - 2), i + 3).join(' | ');
      console.log(`- ${context.slice(0, 400)}`);
      printed += 1;
    }
    if (printed === 0) console.log('(웨딩 관련 줄 없음 — 화면이 스크립트로 그려지는 페이지일 수 있다)');
  } catch (error) {
    console.log(`실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const urls = process.argv.slice(2).filter(Boolean);
for (const url of urls) {
  await probe(url);
}

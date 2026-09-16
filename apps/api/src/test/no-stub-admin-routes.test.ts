import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES_DIR = join(__dirname, '..', 'routes');

/**
 * 관리자 쓰기 라우트가 **아무것도 하지 않고 성공을 돌려주지 않는지** 센다.
 *
 * 2026-09-16 대표 지시 — 「전체적으로 싹다 검수해 기능 동작 프론트와 연결여부
 * 안되는거 싹다 검수해서 고쳐」.
 *
 * 그날 기계로 세어 보니 관리자 라우트 여섯이 껍데기였다. `POST /v1/admin/ads`는
 * 새 uuid를 지어내 돌려줬고, `PATCH /v1/admin/ads-gate` · `PATCH
 * /v1/admin/automation` · `DELETE /v1/admin/ads/:id`는 204를 냈다. **표에는 아무것도
 * 남지 않았는데 화면에는 성공으로 보였다.**
 *
 * **눌러도 아무 일이 없는 것이 가장 나쁘다.** 실패하면 운영자가 다시 하거나 사람을
 * 부른다. 성공으로 보이면 아무도 부르지 않고, 안 된 일이 된 것으로 기록된다.
 *
 * **글로 적은 규칙은 깨지고 세는 시험은 안 깨진다.** 같은 일이 FAQ 다섯 라우트에서
 * 한 번(0230 마이그레이션 주석), 광고·자동화·캠페인 여섯에서 또 한 번 있었다. 두
 * 번 다 사람 눈이 아니라 훑어서 세는 쪽이 찾았다.
 *
 * ---------------------------------------------------------------------------
 * 무엇을 세는가
 * ---------------------------------------------------------------------------
 *
 * `/v1/admin/`으로 시작하는 **쓰기 라우트**(POST · PUT · PATCH · DELETE)만 본다.
 *
 * **조회는 세지 않는다.** 빈 목록을 돌려주는 GET은 화면에 「없어요」로 그대로
 * 보인다 — 거짓말이 아니라 빈 상태다. 거짓말이 되는 것은 **하지도 않은 일을 했다고
 * 말하는 쓰기**다.
 *
 * 라우트가 DB에 닿는지는 그 자리에서 `context.pool` · `.query(` ·
 * `withTransaction`을 부르는지로 본다. 핸들러가 같은 파일의 도우미 함수에 넘기는
 * 꼴이 흔하므로(`change` · `setImageStatus`) **한 단계 따라 들어가서** 본다.
 */
const TOUCHES_DB = /(context\.pool|\.query\(|withTransaction)/;

const WRITE_METHODS = ['post', 'put', 'patch', 'delete'] as const;

/**
 * 의도한 예외. **왜 예외인지를 그 줄에 적는다** — 근거 없이 늘어나면 이 시험은
 * 아무것도 세지 않는 시험이 된다.
 *
 * `/v1/auth/naver/callback`은 여기 없다. 관리자 라우트가 아니라 이 시험의 범위
 * 밖이고, 딥링크로 넘겨주기만 하므로 DB를 볼 일이 없다.
 */
const ALLOWED = new Map<string, string>([
  [
    'POST /v1/admin/terms',
    '약관 조문 편집·공개는 앱 약관·동의 기록에 연결한 뒤 열린다(`termsUnavailable`). 열릴 때 세 줄을 함께 지운다.',
  ],
  ['PUT /v1/admin/terms/:id/clauses/:clauseId', '위와 같다 — `termsUnavailable`.'],
  ['POST /v1/admin/terms/:id/publish', '위와 같다 — `termsUnavailable`.'],
  [
    'PATCH /v1/admin/ads-gate',
    '관문이 담는 사실 셋(승인 · 켜짐 · 끔)은 전용 라우트가 이미 쓴다. 여기에 길을 내면 실운영 전환을 켜는 두 번째 입구가 된다 — 대표 오더 대기(2026-09-16).',
  ],
  [
    'PATCH /v1/admin/automation',
    '고칠 수 있는 칸은 `self_heal_enabled` 하나인데 그것을 읽고 도는 코드가 없다(0130 주석). 켜 주면 딱지만 바뀐다.',
  ],
  [
    'POST /v1/admin/campaigns',
    '캠페인 표가 없다. `structured.reward_grants`는 근거(초대 · 홍보) 없는 지급을 `grant_has_exactly_one_source` CHECK로 거절한다(0039).',
  ],
  [
    'POST /v1/admin/site-meta/og-image/upload-target',
    '그림 올릴 자리를 스토리지(`context.storage`)에 만든다. DB를 보지 않는 것이 맞다.',
  ],
  [
    'POST /v1/admin/data/price-stats/:vendorId/recalc',
    '**껍데기가 아니라 실패를 돌려준다**(2026-09-16). 재 보니 다시 계산할 것 자체가 없었다 — 바로 위 `GET`이 읽을 때마다 새로 구하고, `stats.price_stats`는 표만 있고 쓰는 코드가 없다. DB를 안 보는 것이 맞다.',
  ],
]);

type Route = { method: string; path: string; body: string; file: string };

/** `(`에서 짝이 맞는 `)`까지. 문자열 안의 괄호는 세지 않는다. */
function callBody(source: string, openParen: number): string {
  let depth = 0;
  let quote: string | null = null;

  for (let i = openParen; i < source.length; i += 1) {
    const char = source[i]!;

    if (quote) {
      if (char === '\\') i += 1;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') quote = char;
    else if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openParen + 1, i);
    }
  }

  return source.slice(openParen + 1);
}

/** 같은 파일에 선언된 함수의 몸통. 못 찾으면 빈 문자열이다. */
function localFunctionBody(source: string, name: string): string {
  const declaration = new RegExp(
    `(?:async\\s+function|function)\\s+${name}\\s*[(<]|(?:const|let)\\s+${name}\\s*=\\s*(?:async\\s*)?[(<]`
  ).exec(source);

  if (!declaration) return '';

  const brace = source.indexOf('{', declaration.index + declaration[0].length);
  if (brace === -1) return '';

  let depth = 0;

  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(brace, i + 1);
    }
  }

  return '';
}

function adminWriteRoutes(): Route[] {
  const files = readdirSync(ROUTES_DIR).filter(
    (file) => file.endsWith('.ts') && !file.endsWith('.test.ts')
  );

  const routes: Route[] = [];

  for (const file of files) {
    const source = readFileSync(join(ROUTES_DIR, file), 'utf8');
    const pattern = new RegExp(`app\\.(${WRITE_METHODS.join('|')})\\s*(?:<[^(]*>\\s*)?\\(`, 'g');

    for (const match of source.matchAll(pattern)) {
      const openParen = match.index! + match[0].length - 1;
      const body = callBody(source, openParen);
      const path = /^\s*['"`]([^'"`]+)/.exec(body)?.[1];

      if (!path?.startsWith('/v1/admin/')) continue;

      routes.push({ method: match[1]!.toUpperCase(), path, body, file });
    }
  }

  return routes;
}

/** 라우트가 DB에 닿는가. 같은 파일의 도우미까지 한 단계 따라 들어간다. */
function reachesDatabase(route: Route, source: string): boolean {
  if (TOUCHES_DB.test(route.body)) return true;

  const called = new Set(
    [...route.body.matchAll(/\b([a-zA-Z_$][\w$]*)\s*\(/g)].map((match) => match[1]!)
  );

  for (const name of called) {
    if (TOUCHES_DB.test(localFunctionBody(source, name))) return true;
  }

  return false;
}

describe('관리자 쓰기 라우트는 하지 않은 일을 성공이라 하지 않는다', () => {
  const routes = adminWriteRoutes();

  it('훑어낸 쓰기 라우트가 실제로 있다', () => {
    /*
     * 정규식이 어긋나 0개를 찾으면 아래 시험이 **아무것도 확인하지 않고 통과한다.**
     * 빈 목록으로 도는 시험은 없는 시험보다 나쁘다 — 있다고 믿게 만든다.
     */
    expect(routes.length).toBeGreaterThan(40);
  });

  it('DB를 한 번도 안 만지면서 성공을 돌려주는 라우트가 없다', () => {
    const sources = new Map<string, string>();
    const stubs: string[] = [];

    for (const route of routes) {
      const key = `${route.method} ${route.path}`;
      if (ALLOWED.has(key)) continue;

      let source = sources.get(route.file);
      if (source === undefined) {
        source = readFileSync(join(ROUTES_DIR, route.file), 'utf8');
        sources.set(route.file, source);
      }

      if (!reachesDatabase(route, source)) stubs.push(`${key} (${route.file})`);
    }

    expect(stubs).toEqual([]);
  });

  it('예외 목록이 실제로 있는 라우트만 가리킨다', () => {
    /*
     * 라우트가 고쳐졌는데 예외 줄이 남으면 다음 껍데기가 그 줄에 숨는다. 없어진
     * 예외는 지운다.
     */
    const present = new Set(routes.map((route) => `${route.method} ${route.path}`));

    expect([...ALLOWED.keys()].filter((key) => !present.has(key))).toEqual([]);
  });

  it('예외마다 왜 예외인지가 적혀 있다', () => {
    expect([...ALLOWED].filter(([, reason]) => reason.trim().length < 20)).toEqual([]);
  });
});

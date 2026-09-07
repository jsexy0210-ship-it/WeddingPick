import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * 라우트가 있는 메서드는 CORS 허용 목록에도 있어야 한다.
 *
 * PATCH가 빠져 있었다. 관리자 API에 PATCH 라우트가 실재하고 관리자 화면이 실제로
 * PATCH를 보내는데, 브라우저 preflight가 전부 막았다. 서버는 200을 줄 준비가 돼
 * 있는데 브라우저가 요청을 보내지도 못하는 상태라 로그에도 안 남는다 — 코드를
 * 읽어야만 알 수 있어서 오래 남아 있었다.
 */
describe('CORS 허용 메서드', () => {
  const routesDir = path.join(__dirname, '..', 'routes');
  const serverSource = readFileSync(path.join(__dirname, '..', 'server.ts'), 'utf8');

  const allowed = new Set(
    (serverSource.match(/methods: \[([^\]]+)\]/)?.[1] ?? '')
      .split(',')
      .map((entry) => entry.trim().replace(/'/g, ''))
      .filter(Boolean)
  );

  const registered = new Set<string>();
  for (const file of readdirSync(routesDir).filter((name) => name.endsWith('.ts'))) {
    const source = readFileSync(path.join(routesDir, file), 'utf8');
    for (const match of source.matchAll(/\bapp\.(get|post|put|patch|delete|head)\(/g)) {
      const method = match[1];
      if (method) registered.add(method.toUpperCase());
    }
  }

  it('라우트를 등록한 메서드가 모두 허용된다', () => {
    expect(allowed.size).toBeGreaterThan(0);
    expect(registered.size).toBeGreaterThan(0);

    const missing = [...registered].filter((method) => !allowed.has(method)).sort();
    expect(missing).toEqual([]);
  });

  it('PATCH 라우트가 실재하므로 PATCH가 허용된다', () => {
    expect(registered.has('PATCH')).toBe(true);
    expect(allowed.has('PATCH')).toBe(true);
  });
});

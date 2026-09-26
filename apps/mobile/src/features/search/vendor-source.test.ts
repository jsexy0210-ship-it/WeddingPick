import { violatesCopyRules } from '@weddingpick/domain';

import { PUBLIC_DATA_SOURCE, VENDOR_SOURCE_LABEL, vendorSourceValue } from './vendor-source';

declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('node:fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };
const { execFileSync } = require('node:child_process') as {
  execFileSync: (cmd: string, args: string[], options: { cwd: string; encoding: 'utf8'; stdio: 'pipe' }) => string;
};

const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const APP = join(__dirname, '..', '..', 'app');

/** 2026-09-26 대표 지시 — 업체 상세의 정보 출처는 「공공데이터」 한 이름. */
describe('업체 정보 출처 표기', () => {
  it('서버 문장이 무엇이든 공공데이터 한 이름으로 적는다', () => {
    for (const note of [
      '지방행정 인허가 데이터 · 공공데이터포털',
      '공공데이터포털 자료',
      '행정안전부 지방행정 인허가 데이터 (2026-09-01 확인)',
    ]) {
      expect(vendorSourceValue(note)).toBe('공공데이터');
    }
    expect(PUBLIC_DATA_SOURCE).toBe('공공데이터');
    expect(VENDOR_SOURCE_LABEL).toBe('출처');
  });

  it('출처가 없는 업체는 줄을 만들지 않는다', () => {
    expect(vendorSourceValue(null)).toBeNull();
    expect(vendorSourceValue(undefined)).toBeNull();
    expect(vendorSourceValue('  ')).toBeNull();
  });

  it('업체 상세 · 비교 · 견적 결과가 모두 같은 함수를 거친다 — 서버 문장을 그대로 적지 않는다', () => {
    const detail = readFileSync(join(APP, '(tabs)', 'search', '[vendorId]', 'index.tsx'), 'utf8');
    const compare = readFileSync(join(APP, '(tabs)', 'search', 'compare.tsx'), 'utf8');
    const quote = readFileSync(join(__dirname, '..', 'quotes', 'quote-result-view.tsx'), 'utf8');
    for (const source of [detail, compare, quote]) {
      expect(source).toContain('vendorSourceValue(');
    }
    expect(detail).not.toContain('value={vendor.sourceNote}');
    expect(compare).not.toContain('value: vendor.sourceNote ??');
    expect(quote).not.toContain('{quote.vendor.sourceNote}');
  });

  it('카피 규칙은 공공데이터 한 낱말만 풀고 나머지 데이터는 계속 막는다', () => {
    expect(violatesCopyRules('공공데이터')).toBe(false);
    expect(violatesCopyRules('공공데이터 · 가격 데이터')).toBe(true);
    expect(violatesCopyRules('데이터 12건')).toBe(true);
  });

  it('lint-copy.js도 같은 줄에 섞인 데이터를 잡는다', () => {
    const lint = readFileSync(join(ROOT, 'lint-copy.js'), 'utf8');
    expect(lint).toContain('function maskAllowed(');
    expect(lint).toContain('2026-09-26 대표 지시');
    const glossary = JSON.parse(readFileSync(join(ROOT, 'spec', 'glossary.json'), 'utf8')) as {
      banned: { term: string; allow?: string[] }[];
    };
    expect(glossary.banned.find((entry) => entry.term === '데이터')?.allow).toEqual(['공공데이터']);

    const { mkdtempSync, writeFileSync } = require('node:fs') as {
      mkdtempSync: (prefix: string) => string;
      writeFileSync: (path: string, data: string) => void;
    };
    const { tmpdir } = require('node:os') as { tmpdir: () => string };
    const dir = mkdtempSync(join(tmpdir(), 'wp-copy-'));
    const ok = join(dir, 'ok.ts');
    const bad = join(dir, 'bad.ts');
    writeFileSync(ok, "export const a = '공공데이터';\n");
    writeFileSync(bad, "export const b = '공공데이터 · 가격 데이터';\n");

    const run = (file: string) => {
      try {
        execFileSync('node', [join(ROOT, 'lint-copy.js'), file], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
        return 0;
      } catch {
        return 1;
      }
    };
    expect(run(ok)).toBe(0);
    expect(run(bad)).toBe(1);
  });
});

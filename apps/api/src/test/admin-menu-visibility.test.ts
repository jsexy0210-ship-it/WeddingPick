import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');
const ADMIN_DIR = join(ROOT, 'apps/mobile/src/app/admin');

const readAdmin = (file: string): string => readFileSync(join(ADMIN_DIR, file), 'utf8');

function hiddenKeys(): string[] {
  return readdirSync(ADMIN_DIR)
    .filter((file) => file.endsWith('.tsx'))
    .flatMap((file) => {
      const source = readAdmin(file);
      return [...source.matchAll(/\{\s*key:\s*'([^']+)'[^}]*hidden:\s*true[^}]*\}/g)]
        .map((match) => match[1]!);
    })
    .sort();
}

describe('관리자 메뉴 노출 정책', () => {
  it('숨김 탭은 메뉴에서만 제외한다', () => {
    expect(readAdmin('_ui.tsx')).toContain("tabs.filter((t) => !t.hidden).map");
    expect(hiddenKeys()).toEqual(['email-matching', 'marketing', 'revenue']);
  });

  it('상위 메뉴 이름도 실제 노출 기능과 맞춘다', () => {
    const layout = readAdmin('_layout.tsx');
    expect(layout).toContain("label: '광고·보상'");
    expect(layout).toContain("label: '통계·분석'");
    expect(layout).not.toContain("label: '광고·마케팅'");
    expect(layout).not.toContain("label: '통계·수익'");
  });

  it('숨겨도 기존 화면과 직접 접근 경로는 유지한다', () => {
    const legacyRoutes = [
      ['email-matching.tsx', '/admin/vendors?tab=email-matching'],
      ['revenue.tsx', '/admin/stats?tab=revenue'],
      ['marketing.tsx', '/admin/ads?tab=marketing'],
    ] as const;

    for (const [file, href] of legacyRoutes) {
      const source = readAdmin(file);
      expect(source).toContain(href);
      expect(source).toContain('Redirect');
    }
  });
});

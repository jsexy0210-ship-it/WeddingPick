import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('관리자 UX 정책', () => {
  it('로그인과 /admin 기본 진입은 대시보드다', () => {
    expect(read('apps/mobile/src/app/admin/login.tsx')).toContain("router.replace('/admin/home'");
    expect(read('apps/mobile/src/app/admin/index.tsx')).toContain("'/admin/home'");
  });

  it('화면 폭을 채우는 상태 띠는 그리지 않는다', () => {
    const ui = read('apps/mobile/src/app/admin/_ui.tsx');
    const statusBanner = /export function StatusBanner[\s\S]*?\n\}/.exec(ui)?.[0] ?? '';

    expect(statusBanner).toContain("if (tone !== 'bad') return null");
    expect(statusBanner).toContain('styles.inlineError');
    expect(statusBanner).not.toContain('backgroundColor');
    expect(read('apps/mobile/src/app/admin/ads-gate.tsx')).not.toContain('styles.statusBanner');
  });

  it('등록·수정과 확인 카드는 모달로 연다', () => {
    const ui = read('apps/mobile/src/app/admin/_ui.tsx');

    expect(ui).toMatch(/export function ConfirmCard[\s\S]*?<Modal visible/);
    expect(read('apps/mobile/src/app/admin/wedding-feed.tsx')).toContain('<AdminFormModal');
    expect(read('apps/mobile/src/app/admin/og-card.tsx')).toContain('<AdminFormModal');
  });

  it('현재 프론트 콘텐츠인 웨딩피드를 최상위 메뉴에서 바로 연다', () => {
    const layout = read('apps/mobile/src/app/admin/_layout.tsx');

    expect(layout).toContain("label: '웨딩피드 콘텐츠', href: '/admin/wedding-feed'");
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { savedAtLabel } from '@/app/(tabs)/my/scraps';

const source = readFileSync(join(__dirname, '../../app/(tabs)/my/scraps.tsx'), 'utf8');

describe('MY 스크랩 07-lounge-my 4-6 정본', () => {
  it('88px 이미지 · 카테고리 · 제목 · 저장일 · bookmark를 한 행에 둔다', () => {
    expect(source).toContain('<CategoryImage uri={item.imageUrl} />');
    expect(source).toContain('{item.categoryLabel}');
    expect(source).toContain('{item.title}');
    expect(source).toContain('{savedAtLabel(item.savedAt)}');
    expect(source).toContain('<ProductSymbol name="bookmark" size={20} color={theme.tint} />');
    expect(source).not.toContain('<Row');
  });

  it('저장 시각을 정본 문구로 표시한다', () => {
    expect(savedAtLabel('2026-09-08T12:34:56.000Z')).toBe('9월 8일 저장');
    expect(savedAtLabel('invalid')).toBe('저장됨');
  });
});

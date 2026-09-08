import type { VendorCategory } from '@weddingpick/domain';
import type { CategoryIconKind } from '@weddingpick/ui';

/**
 * 업종(`VendorCategory`) → 업종 아이콘(WP-ST-016). `packages/ui`는 domain을
 * 모르므로 이 변환은 앱 레이어에 둔다(vendor-image-category.ts와 같은 이유).
 * 준비 순서 10종은 글리프가 하나씩 있고, 기타는 글리프가 없어 null — 아이콘 없이
 * 글자만 둔다. switch는 빠짐없이 적는다 — 업종이 늘면 여기서 컴파일이 깨져야 한다.
 */
export function categoryIconKind(category: VendorCategory): CategoryIconKind | null {
  switch (category) {
    case 'wedding_info_company':
      return 'agency';
    case 'hall':
      return 'hall';
    case 'studio':
      return 'studio';
    case 'dress':
      return 'dress';
    case 'makeup':
      return 'makeup';
    case 'snap':
      return 'snap';
    case 'goods':
      return 'ring';
    case 'dowry':
      return 'dowry';
    case 'honeymoon':
      return 'honeymoon';
    case 'invitation':
      return 'invitation';
    case 'etc':
      return null;
  }
}

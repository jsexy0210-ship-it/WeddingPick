import type { VendorCategory } from '@weddingpick/domain';
import type { CategoryIconKind } from '@weddingpick/ui';

/**
 * 업종(`VendorCategory`) → 업종 아이콘(WP-ST-016). `packages/ui`는 domain을
 * 모르므로 이 변환은 앱 레이어에 둔다(vendor-image-category.ts와 같은 이유).
 * 스드메는 세 아이콘(스튜디오·드레스·메이크업) 중 첫 번째를, 기타는 글리프가
 * 없어 null — 아이콘 없이 글자만 둔다.
 */
export function categoryIconKind(category: VendorCategory): CategoryIconKind | null {
  switch (category) {
    case 'wedding_info_company':
      return 'agency';
    case 'hall':
      return 'hall';
    case 'sdm':
      return 'studio';
    case 'snap':
      return 'snap';
    case 'goods':
      return 'ring';
    case 'honeymoon':
      return 'honeymoon';
    case 'etc':
      return null;
  }
}

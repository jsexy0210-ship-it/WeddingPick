import type { VendorCategory } from '@weddingpick/domain';
import type { VendorCategory as UIVendorCategory } from '@weddingpick/ui';

/**
 * 업종(`VendorCategory`, 사업계획서 6번) → `VendorImage` 폴백 이미지 카테고리.
 *
 * `packages/ui`는 판단을 모르는 표시 전용 패키지라 domain을 import하지 않는다
 * (`vendor-image.tsx` 파일 머리말 참고) — 그래서 이 변환은 둘 다 아는 앱
 * 레이어에 둔다. 두 카테고리 집합이 1:1이 아니다: `sdm`은 폴백 이미지가
 * `studio` 하나뿐이고, `wedding_info_company`·`goods`·`honeymoon`은 전용 폴백
 * 이미지가 없어 `etc`로 묶인다.
 */
export function vendorImageCategory(category: VendorCategory): UIVendorCategory {
  switch (category) {
    case 'hall':
      return 'hall';
    case 'sdm':
      return 'studio';
    case 'snap':
      return 'video';
    case 'goods':
    case 'wedding_info_company':
    case 'honeymoon':
    case 'etc':
      return 'etc';
  }
}

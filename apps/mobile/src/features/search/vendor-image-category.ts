import type { VendorCategory } from '@weddingpick/domain';
import type { VendorCategory as UIVendorCategory } from '@weddingpick/ui';

/**
 * 업종(`VendorCategory`, 핸드오프 v3.18 §1.3) → `VendorImage` 폴백 이미지 카테고리.
 *
 * `packages/ui`는 판단을 모르는 표시 전용 패키지라 domain을 import하지 않는다
 * (`vendor-image.tsx` 파일 머리말 참고) — 그래서 이 변환은 둘 다 아는 앱
 * 레이어에 둔다. 2026-09-08부터 두 집합은 1:1이라(업종 10종 + 기타) 값을 그대로
 * 넘기면 되지만, 두 타입이 따로 선언돼 있어 어느 한쪽이 어긋나면 여기서 컴파일이
 * 깨지도록 함수를 남겨 둔다.
 */
export function vendorImageCategory(category: VendorCategory): UIVendorCategory {
  return category;
}

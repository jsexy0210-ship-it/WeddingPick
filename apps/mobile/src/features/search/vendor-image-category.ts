import type { VendorCategory } from '@weddingpick/domain';
import type { VendorCategory as UIVendorCategory } from '@weddingpick/ui';

/**
 * 업종(`VendorCategory`, 핸드오프 v3.22 §13.6) → `VendorImage` 폴백 이미지 카테고리.
 *
 * `packages/ui`는 판단을 모르는 표시 전용 패키지라 domain을 import하지 않는다
 * (`vendor-image.tsx` 파일 머리말 참고) — 그래서 이 변환은 둘 다 아는 앱
 * 레이어에 둔다.
 *
 * v3.22가 더한 헤어변형 · 부케는 `packages/ui`의 폴백 집합에 아직 없다(폴백
 * 라벨 «○○ 기본»과 기본 이미지 규격이 컴포넌트 시트에서 안 나왔다). 그때까지
 * 가장 가까운 면으로 보낸다 —
 *
 *   hair    → makeup  같은 «스드메» 그룹의 미용 업종. 폴백 라벨이 «메이크업 기본»이
 *                     되지만 사진이 오면 그 사진이 이긴다(폴백은 사진 없을 때만).
 *   bouquet → etc     본식스냅 · 드레스 어느 쪽도 부케의 면이 아니다. 틀린 업종
 *                     이름을 적느니 중립인 «업체 기본»이 낫다.
 *
 * `packages/ui`가 두 업종을 받게 되면 이 두 줄만 지운다. 나머지는 1:1이고, 두
 * 타입이 따로 선언돼 있어 어느 한쪽이 어긋나면 여기서 컴파일이 깨진다.
 */
export function vendorImageCategory(category: VendorCategory): UIVendorCategory {
  switch (category) {
    case 'hair':
      return 'makeup';
    case 'bouquet':
      return 'etc';
    default:
      return category;
  }
}

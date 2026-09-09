import type { VendorDetail } from '@weddingpick/api-contract';

/**
 * 업체 상세 ⑦ «현재 혜택»(WP-VEND-001 layout 7 · 시안 09-core-loop #10a)에 그릴 것.
 *
 *   title  «이번 달 계약 시 앨범 업그레이드»  — 업체가 제공한 혜택 한 줄
 *   meta   «2026년 9월 30일까지 · 업체 제공»  — 기간과 출처. 기간을 모르면 출처만 적는다
 */
export type VendorBenefit = {
  title: string;
  meta: string;
};

/**
 * **지금은 언제나 null이다 — 서버에 혜택 자료가 없다.**
 *
 * `vendor_benefits` 같은 표가 없고(`packages/db/migrations` 0092까지), `vendorDetailSchema`에도
 * 혜택 칸이 없다. 계약에 칸부터 뚫어두고 늘 null을 채워 보내지 않는 이유는
 * `packages/api-contract/src/recommendations.ts`가 TOP3 카드에 적어둔 것과 같다 — 빈 칸을 받으면
 * 화면은 그 칸을 그리려 들고, 정책이 금지한 빈 회색 자리가 남는다.
 *
 * 그래서 «자리»는 이 함수 하나로 두고, 화면은 이 값이 null이면 섹션째 그리지 않는다
 * (SPEC §2 빈 섹션 규칙 · screens.json WP-VEND-001 states «혜택 있음·없음·만료»).
 * 서버가 혜택을 내려주기 시작하면 **이 함수 안만 고치면 된다**:
 *
 *   1. `vendorDetailSchema`에 `benefit`(제목 · 기간 · 출처 · 만료일)을 더한다.
 *   2. 만료된 혜택은 여기서 걸러 null로 만든다 — «만료» 상태는 카드가 아니라 «없음»이다.
 *   3. 화면은 그대로 둔다.
 */
export function vendorBenefit(_vendor: VendorDetail): VendorBenefit | null {
  return null;
}

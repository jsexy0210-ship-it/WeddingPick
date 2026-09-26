import { Redirect } from 'expo-router';

/**
 * 지출내역(WP-OUR-014b) 풀팝업은 지웠다 — 2026-09-26 대표 지시 「지출내역을 예산현황 목록과
 * 통/폐합한다. 이후 지출내역 풀팝업은 삭제한다」.
 *
 * 예산현황 카드의 업종 목록이 그 역할을 흡수했다(`features/wedding/budget-category-list.tsx` — 업종 줄
 * 아래 지출 건 · 출처 배지 · «확인 중» 줄 · 건마다 수정 · 삭제). 이 주소는 저장된 링크 · 알림을 위해
 * 남기고 예산 탭으로 돌려보낸다(CLAUDE.md «보이는 이름과 라우트를 함께 바꾸지 않는다» — 통합 ·
 * 리다이렉트로 보존).
 */
export default function ExpenseListRedirect() {
  return <Redirect href="/wedding?tab=budget" />;
}

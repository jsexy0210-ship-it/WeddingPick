/**
 * 연결관리 별칭 — 이 스택 안에 같은 화면을 둔다(`features/partner/routes.ts`). 화면은 하나다:
 * `wedding/partner.tsx`를 그대로 다시 내보낸다. 웨딩노트 스택에만 두면 여기서 누를 때 탭이 바뀌어
 * 밀어넣기 전환이 안 탔다(2026-09-26 대표 지시).
 */
export { default } from '../wedding/partner';

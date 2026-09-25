import { Redirect } from 'expo-router';

/**
 * 배우자 초대 안내 주소 — `/invite`(`INVITE_PAGE_PATH` · 2026-09-25 대표 지시).
 *
 * 「카카오로 초대하기」가 보내는 것은 이 주소 하나다. **초대 코드는 담지 않는다** — 카톡방의
 * 링크는 누구에게나 다시 전달될 수 있다. 카카오톡이 그리는 카드(OG)는 이 주소의 정적
 * HTML(`invite.html`)에 실린 값이고, 그 값은 관리자 「링크 미리보기 · 초대용」이다
 * (`scripts/apply-app-og-meta.mjs`가 export 뒤에 싣는다).
 *
 * 화면은 따로 그리지 않는다 — 앱 정본(`docs/design/React_Native`)에 초대 안내 화면이 없어
 * (`DESIGN_SOURCE_NOT_VERIFIED`) 새로 짓지 않고, 받은 코드 6자리를 넣는 기존 화면
 * (`/wedding/join`)으로 보낸다. 로그인하지 않았으면 루트가 로그인으로 먼저 보낸다.
 */
export default function InviteLanding() {
  return <Redirect href="/wedding/join" />;
}

import type { FastifyInstance } from 'fastify';

import type { AppContext } from '../context';
import * as faqAdmin from '../faq-admin';

/**
 * 자주 묻는 것 — 사용자 화면이 읽는 자리.
 *
 * **2026-09-16 대표 지시로 생겼다.** 그전까지 앱의 FAQ 화면 넷은 코드에 든
 * `FAQ_ITEMS`를 직접 들고 있었고, 관리자 화면에서 무엇을 고쳐도 사용자에게는 닿지
 * 않았다 — 「저장됨」이라고 적히고 화면은 그대로인 상태였다. 항목을 표로 내리면서
 * 읽는 쪽을 여기에 붙인다.
 *
 * **로그인이 없다.** FAQ는 로그인하지 않아도 보는 화면이고(「가격을 보려면 결제내역을
 * 등록해야 하나요」의 답이 그렇게 적고 있다), 내보내는 것은 누구에게나 같은 문구다.
 *
 * 관리자 쪽 다섯 라우트는 `routes/admin.ts`에 그대로 있다. 쓰기는 운영자 인증을 지나고
 * 이 자리는 읽기만 한다 — 두 자리를 한 라우트로 합치면 공개 조회에 운영자 권한 분기가
 * 들어가고, 그런 분기는 언젠가 한쪽으로 새어 비공개 항목을 내보낸다.
 */
export function registerFaqRoutes(app: FastifyInstance, context: AppContext): void {
  app.get('/v1/faq', async () => faqAdmin.publicList(context.pool));
}

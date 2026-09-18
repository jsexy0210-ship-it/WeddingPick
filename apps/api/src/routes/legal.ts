import type { FastifyInstance } from 'fastify';

import * as adminOps from '../admin-ops';
import type { AppContext } from '../context';
import { notFound } from '../errors';

/**
 * 약관 · 개인정보처리방침 · 마케팅 정보 수신 동의의 «공개된 판».
 *
 * **정본은 여전히 하나다.** CLAUDE.md의 「약관과 개인정보처리방침의 정본은
 * 웹사이트다」(2026-09-11 대표 지시)가 막는 것은 사본이 둘이 되는 것이고, 그
 * 위험은 그대로다 — 2026-09-09에 앱과 방침이 어긋났고 낡은 쪽을 사용자가 봤다.
 * 2026-09-16 지시로 바뀐 것은 그 하나가 코드(`apps/web/src/subpages.ts`)가 아니라
 * 표라는 것뿐이다. 웹이 여기서 읽어 그리고, 앱은 지금처럼 웹으로 내보낸다.
 *
 * **로그인이 없다.** 읽는 쪽이 브라우저가 아니라 정적 사이트 빌드(`apps/web`)라
 * 로그인할 수 없고, 내보내는 것은 어차피 공개 페이지에 그대로 실릴 글이라 감출
 * 것이 없다 — `routes/site-meta.ts`의 공개 조회와 같은 자리다.
 *
 * **초안은 나가지 않는다.** `publishedLegalDocument`가 공개된 판만 고른다.
 */
export function registerLegalRoutes(app: FastifyInstance, context: AppContext): void {
  app.get<{ Params: { doc: string } }>('/v1/legal/:doc', async (request) => {
    const doc = request.params.doc;

    if (!adminOps.isDocType(doc)) throw notFound('문서');

    const published = await adminOps.publishedLegalDocument(context.pool, doc);

    /*
     * 아직 공개한 판이 없는 것과 문서가 없는 것은 다르다. 404로 뭉뚱그리면 웹
     * 빌드가 「주소가 틀렸다」와 「아직 공개 전이다」를 구별하지 못한다.
     */
    return { document: published };
  });
}

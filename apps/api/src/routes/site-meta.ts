import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { currentUserId, requireOperatorUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError } from '../errors';
import * as siteMeta from '../site-meta';

/**
 * 링크 미리보기(OG 카드) 문구.
 *
 * 카카오톡에 주소를 붙이면 뜨는 카드다. 마케팅 문구처럼 자주 손대는 것인데 지금까지는
 * `spec/strings.ko.json`에 있어서 한 글자를 바꾸려면 코드를 고쳐 배포해야 했다.
 *
 * **공개 조회가 따로 있는 이유.** 웹은 정적 HTML 생성기라 빌드할 때 이 값을 한 번
 * 읽어 태그에 박는다. 읽는 쪽이 브라우저가 아니라 빌드라서 로그인이 없다.
 * 내보내는 것은 어차피 페이지 소스에 그대로 실릴 문구뿐이라 감출 것이 없다.
 */
const saveSchema = z.object({
  /* 빈 문자열은 「기본값으로 되돌린다」는 뜻이다. site-meta.ts의 save()가 처리한다. */
  ogTitle: z.string().max(120).nullish(),
  ogDescription: z.string().max(300).nullish(),
  ogImageUrl: z
    .string()
    .max(500)
    .nullish()
    .refine(
      (value) => !value?.trim() || /^https:\/\//.test(value.trim()),
      '이미지 주소는 https로 시작하는 절대 주소여야 해요. 크롤러는 상대 경로를 따라오지 않아요.'
    ),
  ogImageAlt: z.string().max(200).nullish(),
});

export function registerSiteMetaRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperatorUser(context) };

  app.get('/v1/site-meta', async () => siteMeta.effective(context.pool));

  app.get('/v1/admin/site-meta', auth, async () => siteMeta.adminView(context.pool));

  app.put('/v1/admin/site-meta', auth, async (request) => {
    const parsed = saveSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ApiError('invalid_request', parsed.error.issues[0]?.message ?? '잘못된 요청이에요.');
    }

    return siteMeta.save(context.pool, parsed.data, currentUserId(request));
  });

  /**
   * 「저장 후 반영하기」.
   *
   * 저장은 표를 바꿀 뿐이고 웹은 정적 HTML이라 다시 빌드해야 문구가 나간다. 여기서
   * 웹 서비스의 배포 훅을 당겨 그 빌드를 건다.
   *
   * **배포 훅을 쓰고 Render API 키를 쓰지 않는다.** API 키는 계정의 모든 서비스를
   * 건드릴 수 있어서, 인터넷에 열린 서버에 두기에는 너무 넓다. 배포 훅은 웹 서비스
   * 하나만 다시 배포하는 주소다.
   *
   * **`published_at`은 여기서 찍지 않는다.** 배포는 실패할 수 있고, 걸자마자
   * 「반영됨」으로 바꾸면 실패한 배포까지 반영된 것으로 보인다. 빌드가 실제로
   * `/v1/site-meta`를 읽어갈 때 찍는다.
   */
  app.post('/v1/admin/site-meta/publish', auth, async () => {
    const hook = process.env.RENDER_WEB_DEPLOY_HOOK?.trim();

    if (!hook) {
      /* 오류 코드는 계약에 정해진 것만 쓴다. 무엇이 빠졌는지는 메시지가 말한다. */
      throw new ApiError(
        'internal',
        '반영 통로가 아직 연결되지 않았어요. Render의 weddingpick-web 배포 훅 주소를 RENDER_WEB_DEPLOY_HOOK으로 넣어주세요.'
      );
    }

    const response = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(10_000) });

    if (!response.ok) {
      throw new ApiError('internal', `배포를 걸지 못했어요 — 응답 ${response.status}`);
    }

    return { started: true };
  });
}

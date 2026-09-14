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

/**
 * 올릴 수 있는 그림.
 *
 * 카카오톡·트위터가 읽는 형식만 받는다. svg는 받지 않는다 — 크롤러 대부분이 카드
 * 그림으로 쓰지 않고, 안에 스크립트를 담을 수 있어 우리 도메인에서 내보내기에 맞지 않다.
 */
const OG_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** 저장소 열쇠는 우리가 만든다. 화면이 준 열쇠를 그대로 믿으면 남의 파일을 가리킬 수 있다. */
const OG_IMAGE_PREFIX = 'site-meta/og-';

const OG_KEY_RE = /^site-meta\/og-\d+\.(png|jpg|webp)$/;

/** 요청이 들어온 origin. 올린 그림의 절대 주소를 만드는 데만 쓴다. */
function originOf(request: { protocol: string; hostname: string }): string {
  return `${request.protocol}://${request.hostname}`;
}

export function registerSiteMetaRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperatorUser(context) };

  app.get('/v1/site-meta', async (request) => siteMeta.effective(context.pool, originOf(request)));

  /**
   * 올린 카드 그림.
   *
   * **로그인이 없다.** 읽는 쪽이 카카오톡·페이스북의 크롤러라 로그인할 수 없고,
   * 내보내는 것은 어차피 공개 페이지의 카드에 실릴 그림이라 감출 것이 없다.
   *
   * 오래 캐시하게 둔다 — 주소에 `?v=`가 붙어 있어 새 그림은 새 주소로 나간다.
   */
  app.get('/v1/site-meta/og-image', async (_request, reply) => {
    const key = await siteMeta.ogImageKey(context.pool);

    if (!key) throw new ApiError('not_found', '올려 둔 카드 그림이 없어요.');

    const extension = key.slice(key.lastIndexOf('.') + 1);
    const mimeType =
      Object.entries(OG_IMAGE_TYPES).find(([, ext]) => ext === extension)?.[0] ?? 'image/png';

    return reply
      .type(mimeType)
      .header('cache-control', 'public, max-age=86400')
      .send(await context.storage.download(key));
  });

  app.get('/v1/admin/site-meta', auth, async (request) =>
    siteMeta.adminView(context.pool, originOf(request))
  );

  app.put('/v1/admin/site-meta', auth, async (request) => {
    const parsed = saveSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ApiError('invalid_request', parsed.error.issues[0]?.message ?? '잘못된 요청이에요.');
    }

    return siteMeta.save(context.pool, parsed.data, currentUserId(request), originOf(request));
  });

  /**
   * 그림을 올릴 자리를 받아 간다.
   *
   * 파일 본체는 이 서버를 지나지 않는다(`storage/port.ts`). 화면이 여기서 받은
   * 주소로 저장소에 직접 올린 다음, 아래 `PUT`으로 「그 열쇠를 쓰겠다」고 알린다.
   */
  app.post<{ Body: { mimeType?: string } }>(
    '/v1/admin/site-meta/og-image/upload-target',
    auth,
    async (request) => {
      const mimeType = request.body?.mimeType ?? '';
      const extension = OG_IMAGE_TYPES[mimeType];

      if (!extension) {
        throw new ApiError('invalid_request', 'PNG · JPG · WebP 그림만 올릴 수 있어요.');
      }

      return context.storage.createUploadTarget({
        storageKey: `${OG_IMAGE_PREFIX}${Date.now()}.${extension}`,
        mimeType,
        expiresInSeconds: 600,
      });
    }
  );

  app.put<{ Body: { storageKey?: string } }>(
    '/v1/admin/site-meta/og-image',
    auth,
    async (request) => {
      const storageKey = request.body?.storageKey?.trim() ?? '';

      /*
       * 우리가 만든 열쇠만 받는다. 화면이 준 글자를 그대로 담으면 남의 파일 —
       * 계약서 원본이 든 자리 — 를 카드 그림으로 내보낼 수 있다.
       */
      if (!OG_KEY_RE.test(storageKey)) {
        throw new ApiError('invalid_request', '올린 그림을 찾지 못했어요. 다시 올려주세요.');
      }

      /*
       * 올라왔는지 확인한 뒤에 적는다. 업로드가 중간에 끊겼는데 열쇠만 저장되면
       * 카드가 없는 그림을 가리키고, 크롤러는 그것을 조용히 버린다 — 화면에는
       * 「저장됨」이라고 적혀 있는 채로.
       */
      try {
        await context.storage.download(storageKey);
      } catch {
        throw new ApiError('invalid_request', '그림이 다 올라오지 않았어요. 다시 올려주세요.');
      }

      return siteMeta.attachOgImage(
        context.pool,
        storageKey,
        currentUserId(request),
        originOf(request)
      );
    }
  );

  app.delete('/v1/admin/site-meta/og-image', auth, async (request) =>
    siteMeta.clearOgImage(context.pool, currentUserId(request), originOf(request))
  );

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
   * 배포를 건 시각은 적지만 그것을 「반영됨」으로 부르지 않는다. 배포는 실패할 수
   * 있고 정적 사이트는 실패하면 옛 빌드를 계속 내보낸다 — 실제로 나갔는지는
   * 관리자 조회가 공개 페이지를 직접 읽어 말한다(`liveOgTitle`).
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

    await siteMeta.markPublishRequested(context.pool);

    return { started: true };
  });
}

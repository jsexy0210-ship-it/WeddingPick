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

/**
 * 저장소 열쇠는 우리가 만든다. 화면이 준 열쇠를 그대로 믿으면 남의 파일을 가리킬 수 있다.
 * 웹사이트 벌은 옛 모양(`site-meta/og-<시각>`)을 그대로 쓰고, 앱 · 초대용은 벌 이름을 넣는다.
 */
function ogImageKeyFor(kind: siteMeta.SiteMetaKind, extension: string): string {
  const scope = kind === siteMeta.DEFAULT_SITE_META_KIND ? '' : `${kind}-`;
  return `site-meta/og-${scope}${Date.now()}.${extension}`;
}

const OG_KEY_RE = /^site-meta\/og-(?:(?:app|invite)-)?\d+\.(png|jpg|webp)$/;

/**
 * 어느 벌인가 — `?kind=app|invite|website`. 없으면 웹사이트 벌이다(옛 호출과 같은 뜻).
 * 모르는 이름은 받지 않는다: 조용히 웹사이트 벌로 바꾸면 다른 벌의 값을 덮어쓴다.
 */
function kindOf(request: { query: unknown }): siteMeta.SiteMetaKind {
  const raw = (request.query as { kind?: unknown } | undefined)?.kind;
  const kind = siteMeta.parseSiteMetaKind(raw);
  if (!kind) throw new ApiError('invalid_request', '미리보기 종류는 app · invite · website 중 하나예요.');
  return kind;
}

/** 요청이 들어온 origin. 올린 그림의 절대 주소를 만드는 데만 쓴다. */
function originOf(request: { protocol: string; hostname: string }): string {
  return `${request.protocol}://${request.hostname}`;
}

export function registerSiteMetaRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperatorUser(context) };

  app.get('/v1/site-meta', async (request) =>
    siteMeta.effective(context.pool, originOf(request), kindOf(request))
  );

  /**
   * 올린 카드 그림.
   *
   * **로그인이 없다.** 읽는 쪽이 카카오톡·페이스북의 크롤러라 로그인할 수 없고,
   * 내보내는 것은 어차피 공개 페이지의 카드에 실릴 그림이라 감출 것이 없다.
   *
   * 오래 캐시하게 둔다 — 주소에 `?v=`가 붙어 있어 새 그림은 새 주소로 나간다.
   */
  app.get('/v1/site-meta/og-image', async (request, reply) => {
    const key = await siteMeta.ogImageKey(context.pool, kindOf(request));

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
    siteMeta.adminView(context.pool, originOf(request), kindOf(request))
  );

  app.put('/v1/admin/site-meta', auth, async (request) => {
    const kind = kindOf(request);
    const parsed = saveSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ApiError('invalid_request', parsed.error.issues[0]?.message ?? '잘못된 요청이에요.');
    }

    return siteMeta.save(context.pool, parsed.data, currentUserId(request), originOf(request), kind);
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
      const kind = kindOf(request);
      const mimeType = request.body?.mimeType ?? '';
      const extension = OG_IMAGE_TYPES[mimeType];

      if (!extension) {
        throw new ApiError('invalid_request', 'PNG · JPG · WebP 그림만 올릴 수 있어요.');
      }

      return context.storage.createUploadTarget({
        storageKey: ogImageKeyFor(kind, extension),
        mimeType,
        expiresInSeconds: 600,
      });
    }
  );

  app.put<{ Body: { storageKey?: string } }>(
    '/v1/admin/site-meta/og-image',
    auth,
    async (request) => {
      const kind = kindOf(request);
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
        originOf(request),
        kind
      );
    }
  );

  app.delete('/v1/admin/site-meta/og-image', auth, async (request) =>
    siteMeta.clearOgImage(context.pool, currentUserId(request), originOf(request), kindOf(request))
  );

  /**
   * 이전 관리자 번들과의 호환 경로. 배포 통로 폐기 후에는 외부 호출을 하지 않는다.
   * 설정 저장과 정적 사이트 배포는 별개이며, 반영 요청 시각도 변경하지 않는다.
   */
  app.post('/v1/admin/site-meta/publish', auth, async () => {
    throw new ApiError(
      'conflict',
      '사이트 자동 반영은 중단됐어요. 저장한 내용은 유지되며, 사이트 배포 후 반영돼요.',
      { reason: 'deployment_retired' }
    );
  });
}

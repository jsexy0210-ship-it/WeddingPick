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
/*
 * 길이 초과 문장을 한국어로 적는다. 아래 `PUT`이 첫 문장을 그대로 화면에 넘기는데, zod 기본
 * 문장은 영문(`Too big: expected string to have <=120 characters`)이라 관리자 모달에 그대로
 * 떴다(2026-09-26).
 */
const saveSchema = z.object({
  /* 빈 문자열은 「기본값으로 되돌린다」는 뜻이다. site-meta.ts의 save()가 처리한다. */
  ogTitle: z.string().max(120, '제목은 120자 안쪽으로 적어주세요.').nullish(),
  ogDescription: z.string().max(300, '설명은 300자 안쪽으로 적어주세요.').nullish(),
  ogImageUrl: z
    .string()
    .max(500, '그림 주소는 500자 안쪽으로 적어주세요.')
    .nullish()
    .refine(
      (value) => !value?.trim() || /^https:\/\//.test(value.trim()),
      '이미지 주소는 https로 시작하는 절대 주소여야 해요. 크롤러는 상대 경로를 따라오지 않아요.'
    ),
  ogImageAlt: z.string().max(200, '그림 설명은 200자 안쪽으로 적어주세요.').nullish(),
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

/**
 * 요청이 들어온 origin. 올린 그림의 절대 주소를 만드는 데만 쓴다.
 *
 * **`host`를 쓴다 — `hostname`이 아니다.** Fastify 5부터 `hostname`은 포트를 뺀다.
 * 운영(443 · Nginx가 `Host $host`를 넘긴다)에서는 둘이 같지만, 포트가 붙는 곳에서는
 * `http://localhost/v1/site-meta/og-image`처럼 **없는 주소**가 나가 관리자 미리보기의
 * 그림이 깨졌다(2026-09-26 로컬 재현).
 */
function originOf(request: { protocol: string; host: string }): string {
  return `${request.protocol}://${request.host}`;
}

/**
 * 한 장의 크기 상한. 카드 그림(1200×630)은 보통 수백 KB다.
 * 관리자 화면은 1MB를 넘는 그림을 올리기 전에 줄인다(`og-card.tsx`) — 운영 Nginx의
 * `client_max_body_size` 기본값이 1MB라서다. 이 값은 그 앞에서 서버가 지키는 마지막 선이다.
 */
export const OG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** 파일 첫 바이트가 말하는 형식. 이름표(Content-Type)만 믿으면 아무 파일이나 그림 자리에 담긴다. */
function sniffImageType(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function registerSiteMetaRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireOperatorUser(context) };

  /* 그림 본문을 그대로 받는다. 받는 형식은 `OG_IMAGE_TYPES`와 같다. */
  app.addContentTypeParser(
    Object.keys(OG_IMAGE_TYPES),
    { parseAs: 'buffer', bodyLimit: OG_IMAGE_MAX_BYTES },
    (_request, body, done) => done(null, body)
  );

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
   *
   * **지금 관리자 화면은 이 길을 쓰지 않는다** — 운영 저장소가 브라우저 `PUT`을 CORS로
   * 막아서다(아래 `/og-image/file`). 이미 배포된 옛 관리자 번들의 호출을 깨지 않으려고 남긴다.
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

  /**
   * 그림을 **이 서버를 거쳐** 올리고 곧바로 카드 그림으로 삼는다(2026-09-26).
   *
   * **왜 서명 URL(위 `upload-target`)을 쓰지 않나.** 운영 저장소(카카오 Object Storage)는
   * 브라우저 CORS가 프로젝트 ID가 든 전용 경로에서만 열려, 버킷 이름으로 만든 서명
   * URL로 보내는 브라우저 `PUT`은 preflight에서 막힌다. 문서 업로드가 같은 이유로
   * 이미 이 길로 옮겼다(e66dec7e · `docs/deployment.md` 「파일 저장소」). 관리자 화면만
   * 옛 길에 남아 있어서 「그림 올리기」가 `Failed to fetch`로 끝났다.
   *
   * 같은 origin(`/v1/…`)이라 CORS가 없고, 한 요청에서 올리기와 붙이기가 함께 끝난다 —
   * 반쯤 올라간 파일의 열쇠가 저장되는 틈이 없다.
   */
  app.put<{ Body: Buffer }>(
    '/v1/admin/site-meta/og-image/file',
    { ...auth, bodyLimit: OG_IMAGE_MAX_BYTES },
    async (request) => {
      const kind = kindOf(request);
      const declared = (request.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
      const bytes = request.body;

      if (!OG_IMAGE_TYPES[declared] || !Buffer.isBuffer(bytes)) {
        throw new ApiError('invalid_request', 'PNG · JPG · WebP 그림만 올릴 수 있어요.');
      }
      if (bytes.length === 0) {
        throw new ApiError('invalid_request', '그림 파일이 비어 있어요. 다시 골라주세요.');
      }

      /* 이름표가 아니라 내용으로 형식을 정한다. 둘이 다르면 받지 않는다. */
      const actual = sniffImageType(bytes);
      if (!actual || actual !== declared) {
        throw new ApiError('invalid_request', 'PNG · JPG · WebP 그림만 올릴 수 있어요.');
      }

      const storageKey = ogImageKeyFor(kind, OG_IMAGE_TYPES[actual]!);
      await context.storage.upload(storageKey, bytes, actual);

      return siteMeta.attachOgImage(
        context.pool,
        storageKey,
        currentUserId(request),
        originOf(request),
        kind
      );
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

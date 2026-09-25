import type { Pool } from 'pg';

import { SITE_ORIGIN } from '@weddingpick/domain';

import strings from '../../../spec/strings.ko.json';

/**
 * 링크 미리보기(OG 카드) 문구 — 세 벌(2026-09-25 대표 지시, 0436).
 *
 *   app      앱웹(`apps/mobile` web export) 주소가 싣는 카드
 *   invite   배우자 초대 안내 주소(`/invite`)가 싣는 카드 — 초대 코드는 담지 않는다
 *   website  웹사이트(`apps/web` 랜딩 · 하위 페이지)가 싣는 카드
 *
 * 세 벌은 서로의 값을 대신 쓰지 않는다. 한 벌에서 저장 · 그림 올리기 · 지우기를 해도
 * 다른 벌의 줄은 움직이지 않는다.
 *
 * 2026-09-10 사용자 요청 — 관리자가 직접 고치고 저장한다. 지금까지는 문구가
 * `spec/strings.ko.json`에 있어서 한 글자를 바꾸려면 코드를 고쳐 배포해야 했다.
 *
 * **저장하는 것은 «바꾼 것»뿐이다.** 손대지 않은 항목은 NULL로 두고 spec의 값을
 * 쓴다. 저장할 때 spec 값을 통째로 복사해 넣으면, 나중에 spec이 바뀌어도 표에 든
 * 낡은 사본이 계속 이긴다 — 무엇을 일부러 바꿨고 무엇이 기본값인지도 알 수 없게 된다.
 */
export const SITE_META_KINDS = ['app', 'invite', 'website'] as const;

export type SiteMetaKind = (typeof SITE_META_KINDS)[number];

/** 벌을 적지 않은 옛 호출(웹사이트 빌드 · 옛 관리자 번들)은 웹사이트 벌이다. */
export const DEFAULT_SITE_META_KIND: SiteMetaKind = 'website';

export function parseSiteMetaKind(value: unknown): SiteMetaKind | null {
  if (value === undefined || value === null || value === '') return DEFAULT_SITE_META_KIND;
  return (SITE_META_KINDS as readonly unknown[]).includes(value) ? (value as SiteMetaKind) : null;
}

export type SiteMeta = {
  ogTitle: string;
  ogDescription: string;
  /** 절대 주소이거나 null. null이면 웹이 저장소에 든 기본 그림을 쓴다. */
  ogImageUrl: string | null;
  ogImageAlt: string | null;
};

/** 관리자 화면이 「기본값으로 되돌리기」를 그릴 수 있도록 덮어쓴 항목을 함께 준다. */
export type SiteMetaAdminView = {
  kind: SiteMetaKind;
  effective: SiteMeta;
  defaults: SiteMeta;
  overrides: Partial<Record<keyof SiteMeta, string | null>>;
  updatedAt: string | null;
  /** 마지막으로 「반영하기」를 눌러 배포를 건 때. 배포가 끝난 때가 아니다. */
  publishRequestedAt: string | null;
  /**
   * **지금 사이트에 실제로 나가 있는 제목.**
   *
   * 저장 시각과 배포 시각을 비교해 「반영됨」이라고 말하지 않는다. 배포는 실패할 수
   * 있고 정적 사이트는 실패하면 옛 빌드를 계속 내보내므로, 시각만 보면 안 바뀐
   * 화면을 바뀐 것으로 읽는다. 그래서 공개 페이지를 직접 읽어 og:title을 꺼낸다.
   *
   * 못 읽으면 `null`이다 — 「기본값과 같다」가 아니라 「모른다」로 화면에 적는다.
   */
  liveOgTitle: string | null;
  /**
   * 지금 카드 그림이 어디서 온 것인지. 화면이 「올린 그림」과 「적어 둔 주소」를
   * 구분해 보여주고, 지우는 단추를 어느 쪽에 붙일지 고르는 근거다.
   */
  ogImageSource: 'upload' | 'url' | 'default';
};

type Row = {
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  og_image_key: string | null;
  og_image_alt: string | null;
  updated_at: Date | null;
  published_at: Date | null;
};

/**
 * 벌마다의 기본값. 앱웹은 `apps/mobile/src/features/social-meta.ts`, 웹사이트는
 * `apps/web/src/social-meta.ts`, 초대용은 `spec/strings.ko.json` `inviteShare`와 같은 값이다.
 */
export function defaults(kind: SiteMetaKind = DEFAULT_SITE_META_KIND): SiteMeta {
  const copy = strings.webLanding;

  if (kind === 'invite') {
    const invite = strings.inviteShare;
    return {
      ogTitle: invite.metaTitle,
      ogDescription: invite.metaDescription,
      ogImageUrl: null,
      ogImageAlt: invite.imageAlt,
    };
  }

  return {
    ogTitle: copy.metaTitle,
    ogDescription: copy.metaDescription,
    ogImageUrl: null,
    /* 그림에 적힌 글과 같아야 한다. 웹사이트는 apps/web의 ogImageAlt(), 앱웹은 social-meta.ts와 같다. */
    ogImageAlt: `${copy.brand} — ${(kind === 'app' ? copy.og.hero : copy.hero).split('\n').join(' ')}`,
  };
}

async function readRow(pool: Pool, kind: SiteMetaKind): Promise<Row | null> {
  const { rows } = await pool.query<Row>(
    `SELECT og_title, og_description, og_image_url, og_image_key, og_image_alt,
            updated_at, published_at
     FROM structured.site_meta WHERE kind = $1`,
    [kind]
  );

  return rows[0] ?? null;
}

/** 공개 조회 주소. 올린 그림은 이 경로가 내보낸다. */
export const OG_IMAGE_PATH = '/v1/site-meta/og-image';

/**
 * 올린 그림의 절대 주소.
 *
 * **`?v=`를 붙인다.** 경로가 고정이면 그림을 새로 올려도 크롤러는 캐시해 둔 옛
 * 그림을 계속 쓴다 — 주소가 같으니 다시 받을 이유가 없다. 저장 시각을 붙여 주소가
 * 바뀌게 하고, 그러면 웹을 다시 빌드해 새 주소가 태그에 실린다. 「저장」과 「반영」이
 * 다른 일인 것은 이 화면의 다른 항목과 같다.
 */
function uploadedImageUrl(origin: string, updatedAt: Date | null, kind: SiteMetaKind): string {
  const version = Math.floor((updatedAt ?? new Date()).getTime() / 1000);
  /* 웹사이트 벌은 벌 이름 없이 둔다 — 이미 나간 카드의 주소가 그대로 살아 있게. */
  const kindParam = kind === DEFAULT_SITE_META_KIND ? '' : `kind=${kind}&`;

  return `${origin}${OG_IMAGE_PATH}?${kindParam}v=${version}`;
}

function merge(row: Row | null, origin: string, kind: SiteMetaKind): SiteMeta {
  const base = defaults(kind);
  const uploaded = row?.og_image_key ? uploadedImageUrl(origin, row.updated_at, kind) : null;

  return {
    ogTitle: row?.og_title ?? base.ogTitle,
    ogDescription: row?.og_description ?? base.ogDescription,
    ogImageUrl: row?.og_image_url ?? uploaded ?? base.ogImageUrl,
    ogImageAlt: row?.og_image_alt ?? base.ogImageAlt,
  };
}

/**
 * 웹 빌드와 공개 조회가 읽는 값.
 *
 * `origin`은 **이 요청이 들어온 origin**이다. 올린 그림의 절대 주소를 만드는 데만
 * 쓴다 — 환경변수로 두면 값이 빠진 채 배포될 수 있고, 그때 카드에 실리는 것은
 * 「그림 없음」이 아니라 「없는 주소」다. 크롤러는 그것을 조용히 버린다.
 */
export async function effective(pool: Pool, origin: string, kind: SiteMetaKind = DEFAULT_SITE_META_KIND): Promise<SiteMeta> {
  return merge(await readRow(pool, kind), origin, kind);
}

export async function adminView(pool: Pool, origin: string, kind: SiteMetaKind = DEFAULT_SITE_META_KIND): Promise<SiteMetaAdminView> {
  const row = await readRow(pool, kind);

  return {
    kind,
    effective: merge(row, origin, kind),
    defaults: defaults(kind),
    overrides: {
      ogTitle: row?.og_title ?? null,
      ogDescription: row?.og_description ?? null,
      ogImageUrl: row?.og_image_url ?? null,
      ogImageAlt: row?.og_image_alt ?? null,
    },
    updatedAt: row?.updated_at?.toISOString() ?? null,
    publishRequestedAt: row?.published_at?.toISOString() ?? null,
    liveOgTitle: await liveOgTitle(kind),
    ogImageSource: row?.og_image_key ? 'upload' : row?.og_image_url ? 'url' : 'default',
  };
}

/**
 * 벌마다 실제로 카드를 싣는 공개 주소. 같은 443 origin에서 Nginx가 나눈다 —
 * `/`는 앱웹, `/invite`는 앱웹의 초대 안내 주소, `/website.html`은 웹사이트 랜딩이다.
 */
export const LIVE_PAGE_PATH: Record<SiteMetaKind, string> = {
  app: '/',
  invite: '/invite',
  website: '/website.html',
};

/**
 * 공개 사이트가 지금 내보내고 있는 og:title.
 *
 * 정적 HTML이라 태그가 소스에 그대로 있다. 읽지 못하면 `null`을 준다 — 사이트가
 * 자고 있거나 느린 것을 「바뀌지 않았다」로 단정하지 않는다.
 */
async function liveOgTitle(kind: SiteMetaKind): Promise<string | null> {
  try {
    const response = await fetch(`${SITE_ORIGIN}${LIVE_PAGE_PATH[kind]}`, { signal: AbortSignal.timeout(4_000) });

    if (!response.ok) return null;

    const html = await response.text();
    const found = /<meta property="og:title" content="([^"]*)"/.exec(html)?.[1];

    return found ? decodeAttribute(found) : null;
  } catch {
    return null;
  }
}

function decodeAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * 관리자가 저장한다.
 *
 * 빈 문자열은 **기본값으로 되돌리기**로 읽는다 — 화면에서 칸을 비우는 것이 「이 항목은
 * 정하지 않겠다」는 뜻이고, 그러면 spec의 값이 다시 이긴다. 표에 빈 문자열을 넣는 길은
 * 막아 두었다(0099 CHECK): 제목이 빈 카드는 실수일 가능성이 높다.
 */
export async function save(
  pool: Pool,
  input: Partial<Record<keyof SiteMeta, string | null>>,
  updatedBy: string | null,
  origin: string,
  kind: SiteMetaKind = DEFAULT_SITE_META_KIND
): Promise<SiteMetaAdminView> {
  const clean = (value: string | null | undefined): string | null => {
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
  };

  /*
   * **주소를 적으면 올려 둔 그림을 놓는다.** 그림의 출처는 하나뿐이고(0231 CHECK),
   * 둘이 함께 차면 화면과 빌드가 각자 다른 그림을 고른다. 주소 칸을 비워 저장하는
   * 것은 「이 항목은 정하지 않겠다」이므로 올려 둔 그림을 지우지 않는다 — 지우는
   * 것은 그림 쪽 단추가 한다.
   */
  await pool.query(
    `INSERT INTO structured.site_meta
       (kind, og_title, og_description, og_image_url, og_image_alt, updated_at, updated_by)
     VALUES ($6, $1, $2, $3, $4, now(), $5)
     ON CONFLICT (kind) DO UPDATE SET
       og_title = excluded.og_title,
       og_description = excluded.og_description,
       og_image_url = excluded.og_image_url,
       og_image_key = CASE WHEN excluded.og_image_url IS NULL
                           THEN structured.site_meta.og_image_key END,
       og_image_alt = excluded.og_image_alt,
       updated_at = now(),
       updated_by = excluded.updated_by`,
    [
      clean(input.ogTitle),
      clean(input.ogDescription),
      clean(input.ogImageUrl),
      clean(input.ogImageAlt),
      updatedBy,
      kind,
    ]
  );

  return adminView(pool, origin, kind);
}

/**
 * 올린 그림을 카드 그림으로 삼는다.
 *
 * 파일 본체는 이 서버를 지나지 않는다 — 관리자 화면이 서명 URL로 저장소에 직접
 * 올리고, 여기에는 그 열쇠만 온다(`storage/port.ts`의 설계와 같다). 주소 칸은
 * 함께 비운다: 그림의 출처는 하나뿐이다.
 */
export async function attachOgImage(
  pool: Pool,
  storageKey: string,
  updatedBy: string | null,
  origin: string,
  kind: SiteMetaKind = DEFAULT_SITE_META_KIND
): Promise<SiteMetaAdminView> {
  await pool.query(
    `INSERT INTO structured.site_meta (kind, og_image_key, og_image_url, updated_at, updated_by)
     VALUES ($3, $1, NULL, now(), $2)
     ON CONFLICT (kind) DO UPDATE SET
       og_image_key = excluded.og_image_key,
       og_image_url = NULL,
       updated_at = now(),
       updated_by = excluded.updated_by`,
    [storageKey, updatedBy, kind]
  );

  return adminView(pool, origin, kind);
}

/** 올린 그림을 치운다. 기본 그림(저장소에 든 weddingpick-og.png)으로 돌아간다. */
export async function clearOgImage(
  pool: Pool,
  updatedBy: string | null,
  origin: string,
  kind: SiteMetaKind = DEFAULT_SITE_META_KIND
): Promise<SiteMetaAdminView> {
  await pool.query(
    `UPDATE structured.site_meta
        SET og_image_key = NULL, updated_at = now(), updated_by = $1
      WHERE kind = $2`,
    [updatedBy, kind]
  );

  return adminView(pool, origin, kind);
}

/** 공개 조회가 내보낼 파일의 열쇠. 없으면 올려 둔 그림이 없다는 뜻이다. */
export async function ogImageKey(pool: Pool, kind: SiteMetaKind = DEFAULT_SITE_META_KIND): Promise<string | null> {
  const { rows } = await pool.query<{ og_image_key: string | null }>(
    'SELECT og_image_key FROM structured.site_meta WHERE kind = $1',
    [kind]
  );

  return rows[0]?.og_image_key ?? null;
}

/**
 * 「반영하기」를 눌러 배포를 걸었다고 적는다.
 *
 * **이것은 「반영됨」이 아니다.** 배포는 실패할 수 있고, 정적 사이트는 실패하면 옛
 * 빌드를 계속 내보낸다. 실제로 나갔는지는 `liveOgTitle`이 사이트를 읽어 말한다.
 */
export async function markPublishRequested(pool: Pool, kind: SiteMetaKind = DEFAULT_SITE_META_KIND): Promise<void> {
  await pool.query('UPDATE structured.site_meta SET published_at = now() WHERE kind = $1', [kind]);
}

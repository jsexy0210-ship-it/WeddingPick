import type { Pool } from 'pg';

import { SITE_ORIGIN } from '@weddingpick/domain';

import strings from '../../../spec/strings.ko.json';

/**
 * 링크 미리보기(OG 카드) 문구.
 *
 * 2026-09-10 사용자 요청 — 관리자가 직접 고치고 저장한다. 지금까지는 문구가
 * `spec/strings.ko.json`에 있어서 한 글자를 바꾸려면 코드를 고쳐 배포해야 했다.
 *
 * **저장하는 것은 «바꾼 것»뿐이다.** 손대지 않은 항목은 NULL로 두고 spec의 값을
 * 쓴다. 저장할 때 spec 값을 통째로 복사해 넣으면, 나중에 spec이 바뀌어도 표에 든
 * 낡은 사본이 계속 이긴다 — 무엇을 일부러 바꿨고 무엇이 기본값인지도 알 수 없게 된다.
 */
export type SiteMeta = {
  ogTitle: string;
  ogDescription: string;
  /** 절대 주소이거나 null. null이면 웹이 저장소에 든 기본 그림을 쓴다. */
  ogImageUrl: string | null;
  ogImageAlt: string | null;
};

/** 관리자 화면이 「기본값으로 되돌리기」를 그릴 수 있도록 덮어쓴 항목을 함께 준다. */
export type SiteMetaAdminView = {
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
};

type Row = {
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  og_image_alt: string | null;
  updated_at: Date | null;
  published_at: Date | null;
};

export function defaults(): SiteMeta {
  const copy = strings.webLanding;

  return {
    ogTitle: copy.metaTitle,
    ogDescription: copy.metaDescription,
    ogImageUrl: null,
    /* 그림에 적힌 글과 같아야 한다. apps/web의 ogImageAlt()와 같은 규칙이다. */
    ogImageAlt: `${copy.brand} — ${copy.hero.split('\n').join(' ')}`,
  };
}

async function readRow(pool: Pool): Promise<Row | null> {
  const { rows } = await pool.query<Row>(
    `SELECT og_title, og_description, og_image_url, og_image_alt, updated_at, published_at
     FROM structured.site_meta WHERE id = true`
  );

  return rows[0] ?? null;
}

function merge(row: Row | null): SiteMeta {
  const base = defaults();

  return {
    ogTitle: row?.og_title ?? base.ogTitle,
    ogDescription: row?.og_description ?? base.ogDescription,
    ogImageUrl: row?.og_image_url ?? base.ogImageUrl,
    ogImageAlt: row?.og_image_alt ?? base.ogImageAlt,
  };
}

/** 웹 빌드와 공개 조회가 읽는 값. */
export async function effective(pool: Pool): Promise<SiteMeta> {
  return merge(await readRow(pool));
}

export async function adminView(pool: Pool): Promise<SiteMetaAdminView> {
  const row = await readRow(pool);

  return {
    effective: merge(row),
    defaults: defaults(),
    overrides: {
      ogTitle: row?.og_title ?? null,
      ogDescription: row?.og_description ?? null,
      ogImageUrl: row?.og_image_url ?? null,
      ogImageAlt: row?.og_image_alt ?? null,
    },
    updatedAt: row?.updated_at?.toISOString() ?? null,
    publishRequestedAt: row?.published_at?.toISOString() ?? null,
    liveOgTitle: await liveOgTitle(),
  };
}

/**
 * 공개 사이트가 지금 내보내고 있는 og:title.
 *
 * 정적 HTML이라 태그가 소스에 그대로 있다. 읽지 못하면 `null`을 준다 — 사이트가
 * 자고 있거나 느린 것을 「바뀌지 않았다」로 단정하지 않는다.
 */
async function liveOgTitle(): Promise<string | null> {
  try {
    const response = await fetch(SITE_ORIGIN, { signal: AbortSignal.timeout(4_000) });

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
  updatedBy: string | null
): Promise<SiteMetaAdminView> {
  const clean = (value: string | null | undefined): string | null => {
    const trimmed = value?.trim();

    return trimmed ? trimmed : null;
  };

  await pool.query(
    `INSERT INTO structured.site_meta
       (id, og_title, og_description, og_image_url, og_image_alt, updated_at, updated_by)
     VALUES (true, $1, $2, $3, $4, now(), $5)
     ON CONFLICT (id) DO UPDATE SET
       og_title = excluded.og_title,
       og_description = excluded.og_description,
       og_image_url = excluded.og_image_url,
       og_image_alt = excluded.og_image_alt,
       updated_at = now(),
       updated_by = excluded.updated_by`,
    [
      clean(input.ogTitle),
      clean(input.ogDescription),
      clean(input.ogImageUrl),
      clean(input.ogImageAlt),
      updatedBy,
    ]
  );

  return adminView(pool);
}

/**
 * 「반영하기」를 눌러 배포를 걸었다고 적는다.
 *
 * **이것은 「반영됨」이 아니다.** 배포는 실패할 수 있고, 정적 사이트는 실패하면 옛
 * 빌드를 계속 내보낸다. 실제로 나갔는지는 `liveOgTitle`이 사이트를 읽어 말한다.
 */
export async function markPublishRequested(pool: Pool): Promise<void> {
  await pool.query('UPDATE structured.site_meta SET published_at = now() WHERE id = true');
}

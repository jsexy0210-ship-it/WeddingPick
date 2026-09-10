import type { Pool } from 'pg';

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
  publishedAt: string | null;
  /** 저장했지만 아직 웹 빌드에 실려 나가지 않았다. */
  pendingPublish: boolean;
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
  const updatedAt = row?.updated_at ?? null;
  const publishedAt = row?.published_at ?? null;

  return {
    effective: merge(row),
    defaults: defaults(),
    overrides: {
      ogTitle: row?.og_title ?? null,
      ogDescription: row?.og_description ?? null,
      ogImageUrl: row?.og_image_url ?? null,
      ogImageAlt: row?.og_image_alt ?? null,
    },
    updatedAt: updatedAt?.toISOString() ?? null,
    publishedAt: publishedAt?.toISOString() ?? null,
    pendingPublish: updatedAt !== null && (publishedAt === null || publishedAt < updatedAt),
  };
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
 * 웹 빌드가 이 문구를 실어 나갔다고 적는다.
 *
 * 배포를 건 시점이 아니라 **빌드가 실제로 읽어간 시점**에 찍어야 한다. 배포는 실패할 수
 * 있고, 걸자마자 「반영됨」으로 바꾸면 실패한 배포까지 반영된 것으로 보인다.
 */
export async function markPublished(pool: Pool): Promise<void> {
  await pool.query('UPDATE structured.site_meta SET published_at = now() WHERE id = true');
}

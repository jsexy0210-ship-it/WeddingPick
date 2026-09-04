/**
 * 웹이 화면에 실을 것을 어디서 가져오는가.
 *
 * **웹은 자기 숫자를 갖지 않는다.** 업체·금액·건수는 API에서 오고, 몇 건부터
 * 무엇을 보여줄지는 `@weddingpick/domain`이 정한다. 여기서 다시 판단하면 앱과
 * 웹이 같은 업체를 두고 다른 구간을 말하게 되고, 그때 어느 쪽이 맞는지 물어볼
 * 곳이 없어진다.
 *
 * 응답은 `@weddingpick/api-contract`의 스키마로 검사해서 받는다. 웹에서 타입을
 * 따로 적으면 API가 바뀌는 날 웹만 옛 모양을 믿는다.
 *
 * **API가 없으면 화면을 지어내지 않는다.** `WEDDINGPICK_API_URL`이 없거나 응답이
 * 오지 않으면 `null`을 주고, 화면은 그때 도메인이 정한 «아직 정보가 적어요»를
 * 그대로 적는다 — 빈 자리를 회색 판으로 뚫어두거나 예시 숫자를 채우지 않는다.
 */

import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@weddingpick/domain';
import {
  vendorDetailSchema,
  vendorRegionsResponseSchema,
  vendorSearchResponseSchema,
  type VendorDetail,
  type VendorSummary,
} from '@weddingpick/api-contract';

/** 홈에 세우는 업체 카드 수. 디자인의 3열 한 줄. */
const HOME_CARD_COUNT = 3;

/** API를 기다리는 한계. 빌드가 응답 없는 서버를 붙들고 있지 않게 한다. */
const TIMEOUT_MS = 10_000;

export const API_URL_ENV = 'WEDDINGPICK_API_URL';

/**
 * 우측 집계 기둥에 실을 것.
 *
 * **두 가지 중 지금 셀 수 있는 쪽을 쓴다.**
 *
 *   - `verified` — 확인된 정보 건수. 화면이 원하는 값이지만 이걸 세어 내려주는
 *     경로가 아직 없다. 업체를 한 쪽씩 받아 더하면 그건 그 쪽의 합이지 전체가
 *     아니고, 전체인 척하는 숫자가 가장 나쁘다.
 *   - `vendors` — 검색할 수 있는 업체 수. `GET /v1/vendors`의 `total`이 조건별로
 *     내려주는 값이라 오늘 그대로 셀 수 있다.
 *
 * 그래서 오늘은 `vendors`로 그린다. 집계 경로가 생기는 날 `verified`를 채우면
 * 화면은 고치지 않는다 — 라벨까지 이 타입이 들고 있다.
 */
export type SiteStats = {
  kind: 'verified' | 'vendors';
  title: string;
  total: string;
  rows: readonly { label: string; value: string }[];
};

export type SiteData = {
  /** 많이 확인된 곳. 확인된 계약이 많이 모인 순서로 온다. */
  vendors: readonly VendorSummary[];
  stats: SiteStats | null;
  /** 검색에 실제로 있는 시도. 없는 지역을 칩으로 걸지 않기 위해 받는다. */
  regions: readonly string[];
};

function apiBase(): string | null {
  const raw = process.env[API_URL_ENV]?.trim();

  return raw ? raw.replace(/\/+$/, '') : null;
}

/**
 * API 한 번 읽기.
 *
 * 실패를 던지지 않고 `null`로 돌린다 — 서버가 자다가 빌드가 멈추면 아무 화면도
 * 나오지 않고, 그건 «정보가 적은 화면»보다 나쁘다. 무엇이 없었는지는 적어 남긴다.
 */
async function read<T>(path: string, parse: (value: unknown) => T): Promise<T | null> {
  const base = apiBase();

  if (!base) return null;

  try {
    const response = await fetch(`${base}${path}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(`${path}: ${response.status}`);

      return null;
    }

    return parse(await response.json());
  } catch (error) {
    console.warn(`${path}: ${error instanceof Error ? error.message : '읽지 못했다'}`);

    return null;
  }
}

/** `1,399`. 숫자만 만들고 단위는 부르는 쪽이 붙인다. */
function count(value: number): string {
  return value.toLocaleString('ko-KR');
}

/** 집계 기둥의 제목에 쓰는 말. 셀 수 있는 것의 이름을 그대로 적는다. */
const TERMS_SEARCHABLE = '검색할 수 있는';

/**
 * 업종별로 몇 곳인지.
 *
 * 업종마다 한 번씩 묻는다. `limit=1`이라 목록은 받지 않고 `total`만 쓴다 —
 * 전체를 받아 세면 쪽마다 이어붙여야 하고, 세는 것은 서버가 이미 한다.
 */
async function loadStats(): Promise<SiteStats | null> {
  const counted = await Promise.all(
    VENDOR_CATEGORIES.map(async (category: VendorCategory) => {
      const found = await read(`/v1/vendors?category=${category}&limit=1`, (value) =>
        vendorSearchResponseSchema.parse(value)
      );

      return found ? { category, total: found.total } : null;
    })
  );

  const rows = counted.filter((row): row is { category: VendorCategory; total: number } => !!row);

  if (rows.length === 0) return null;

  const total = rows.reduce((sum, row) => sum + row.total, 0);

  if (total === 0) return null;

  return {
    kind: 'vendors',
    title: `${TERMS_SEARCHABLE} 업체`,
    total: `${count(total)}곳`,
    /* 없는 업종은 줄로 만들지 않는다. 0곳이 늘어선 표는 아직 없는 것을 있는 것처럼 보이게 한다. */
    rows: rows
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total)
      .map((row) => ({
        label: VENDOR_CATEGORY_LABEL[row.category],
        value: `${count(row.total)}곳`,
      })),
  };
}

/**
 * 홈에 필요한 것을 모아 온다.
 *
 * 정렬은 `data` — 확인된 계약이 많이 모인 순서다. 「많이 확인된 곳」이 이름 그대로
 * 되려면 이 정렬이어야 하고, 도메인이 «인기 순»을 만들지 않은 이유도 같다.
 */
export async function loadSiteData(): Promise<SiteData> {
  const [found, regions, stats] = await Promise.all([
    read(`/v1/vendors?sort=data&limit=${HOME_CARD_COUNT}`, (value) =>
      vendorSearchResponseSchema.parse(value)
    ),
    read('/v1/vendors/regions', (value) =>
      // 스키마로 검사한 뒤 이름만 남긴다. 이 화면은 시도 이름만 쓴다.
      vendorRegionsResponseSchema.parse(value).regions.map((region) => region.name)
    ),
    loadStats(),
  ]);

  return {
    /*
     * 광고 자리(`sponsored`)는 싣지 않는다. 자연 결과와 다른 배열로 오는 것을
     * 한 줄로 섞으면 배지를 못 본 사람에게 그건 그냥 검색 결과다(v2.0 E-1).
     * 광고 실운영 전환은 아직 오더 대기다.
     */
    vendors: found?.vendors ?? [],
    stats,
    regions: regions ?? [],
  };
}

/** 업체 한 곳. 상세 화면이 쓴다. 없으면 `null` — 없는 업체 화면을 만들지 않는다. */
export async function loadVendor(vendorId: string): Promise<VendorDetail | null> {
  return read(`/v1/vendors/${encodeURIComponent(vendorId)}`, (value) =>
    vendorDetailSchema.parse(value)
  );
}

/**
 * 상세 화면을 만들 업체.
 *
 * 쉼표로 이어 준다 — `WEDDINGPICK_WEB_VENDOR_IDS=id1,id2`. 어느 업체의 화면을
 * 미리 만들어 둘지는 빌드하는 쪽이 정하고, 웹이 업체를 고르지 않는다.
 */
export function vendorIdsToBuild(): readonly string[] {
  return (process.env.WEDDINGPICK_WEB_VENDOR_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

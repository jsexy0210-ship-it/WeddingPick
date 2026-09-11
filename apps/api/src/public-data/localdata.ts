import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';

/**
 * 지방행정 인허가 데이터(LOCALDATA)를 업체 목록으로 바꾼다.
 *
 * 전국 지자체가 올리는 인허가 자료라 업체 이름·주소·영업 상태가 공개돼 있다.
 * 특정 사이트를 긁어오지 않고 공개 자료만 쓴다 — 사업계획서 20번.
 *
 * 파일은 CP949로 내려온다. 컬럼 이름은 업종과 배포 시점에 따라 조금씩 달라서
 * 후보를 여러 개 두고 찾는다. 못 찾으면 실제 헤더를 알려주고 멈춘다 —
 * 엉뚱한 컬럼을 잡아 이름 대신 주소를 업체명으로 넣는 것보다 낫다.
 */

/** 컬럼 하나를 찾을 때 순서대로 시도하는 이름들. */
const COLUMN_ALIASES = {
  name: ['사업장명', '업소명', '상호명', '상호'],
  roadAddress: ['도로명전체주소', '도로명주소', '소재지도로명주소'],
  landAddress: ['소재지전체주소', '지번주소', '소재지주소'],
  status: ['영업상태명', '영업상태구분명'],
  detailStatus: ['상세영업상태명', '상세영업상태구분명'],
  closedAt: ['폐업일자'],
  licensedAt: ['인허가일자'],
  updatedAt: ['데이터갱신일자', '최종수정시점', '데이터갱신구분'],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

export type PublicVendor = {
  name: string;
  /** "서울특별시 강남구"까지. 주소 전체는 남기지 않는다 — 비교에 쓰는 건 지역이다. */
  region: string;
  address: string;
  /** 자료가 마지막으로 갱신된 날. 없으면 파일을 읽은 날. */
  lastVerifiedAt: string;
};

export class MissingColumnError extends Error {
  constructor(
    readonly column: ColumnKey,
    readonly headers: string[]
  ) {
    super(
      `'${COLUMN_ALIASES[column].join(' 또는 ')}' 컬럼을 찾지 못했다.\n` +
        `파일에 있는 컬럼: ${headers.join(', ')}`
    );
    this.name = 'MissingColumnError';
  }
}

function findColumn(headers: string[], key: ColumnKey, required = true): string | null {
  const found = COLUMN_ALIASES[key].find((alias) => headers.includes(alias));

  if (!found && required) {
    throw new MissingColumnError(key, headers);
  }

  return found ?? null;
}

/** 영업 중인 곳만 쓴다. 폐업한 업체를 비교 대상에 올리지 않는다. */
function isOperating(row: Record<string, string>, columns: Record<string, string | null>): boolean {
  const closed = columns.closedAt ? row[columns.closedAt]?.trim() : '';

  if (closed) {
    return false;
  }

  const status = [
    columns.detailStatus ? row[columns.detailStatus] : '',
    columns.status ? row[columns.status] : '',
  ]
    .filter(Boolean)
    .join(' ');

  // 자치단체마다 표기가 조금씩 다르다. 폐업·휴업·취소가 아니면 영업 중으로 본다.
  return !/폐업|휴업|취소|말소|직권/.test(status);
}

/**
 * 인허가 자료의 영업상태 열로 폐업·휴업을 가려낸다. `parsePublicCsv`가 쓴다 —
 * 컬럼 이름 후보(COLUMN_ALIASES)를 두 벌 두지 않으려고 여기 둔다.
 *
 * 상태 열이 아예 없는 파일(이천·제천 예식장 «현황»처럼 명단만 있는 자료)은
 * 폐업 신호가 없는 것이지 영업 중이 확인된 것도 아니다. 그래서 'unknown'으로
 * 돌려주고, 버릴지 남길지는 부르는 쪽이 정한다.
 */
export function operatingState(
  row: Record<string, string>,
  headers: string[]
): 'operating' | 'closed' | 'unknown' {
  const columns = {
    status: findColumn(headers, 'status', false),
    detailStatus: findColumn(headers, 'detailStatus', false),
    closedAt: findColumn(headers, 'closedAt', false),
  };

  if (!columns.status && !columns.detailStatus && !columns.closedAt) return 'unknown';

  return isOperating(row, columns) ? 'operating' : 'closed';
}

/** "서울특별시 강남구 도산대로 123" → "서울특별시 강남구" */
export function toRegion(address: string): string {
  const parts = address.trim().split(/\s+/);

  return parts.slice(0, 2).join(' ');
}

/** LOCALDATA 날짜는 "2026-05-16" 또는 "20260516"으로 온다. */
function toIsoDate(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '').slice(0, 8);

  if (digits.length !== 8) return null;

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/**
 * CP949 CSV를 업체 목록으로 바꾼다.
 *
 * 이름이나 주소가 비어 있는 행은 버린다. 인허가 자료에는 그런 행이 섞여 있고,
 * 이름 없는 업체는 매칭에 쓸 수 없다.
 */
export function parseLocaldataCsv(
  buffer: Buffer,
  options: { readAt?: Date } = {}
): { vendors: PublicVendor[]; skipped: number } {
  const text = iconv.decode(buffer, 'cp949');

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  }) as Record<string, string>[];

  if (rows.length === 0) {
    return { vendors: [], skipped: 0 };
  }

  const headers = Object.keys(rows[0]!).map((header) => header.trim());

  const columns = {
    name: findColumn(headers, 'name'),
    roadAddress: findColumn(headers, 'roadAddress', false),
    landAddress: findColumn(headers, 'landAddress', false),
    status: findColumn(headers, 'status', false),
    detailStatus: findColumn(headers, 'detailStatus', false),
    closedAt: findColumn(headers, 'closedAt', false),
    licensedAt: findColumn(headers, 'licensedAt', false),
    updatedAt: findColumn(headers, 'updatedAt', false),
  };

  if (!columns.roadAddress && !columns.landAddress) {
    throw new MissingColumnError('roadAddress', headers);
  }

  const readAt = (options.readAt ?? new Date()).toISOString().slice(0, 10);
  const vendors: PublicVendor[] = [];
  let skipped = 0;

  for (const row of rows) {
    const name = row[columns.name!]?.trim();
    const address =
      (columns.roadAddress ? row[columns.roadAddress]?.trim() : '') ||
      (columns.landAddress ? row[columns.landAddress]?.trim() : '') ||
      '';

    if (!name || !address || !isOperating(row, columns)) {
      skipped += 1;
      continue;
    }

    vendors.push({
      name,
      region: toRegion(address),
      address,
      lastVerifiedAt:
        toIsoDate(columns.updatedAt ? row[columns.updatedAt] : undefined) ?? readAt,
    });
  }

  return { vendors, skipped };
}

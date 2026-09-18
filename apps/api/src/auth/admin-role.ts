import type { Pool, PoolClient } from 'pg';

export type AdminRole = 'super' | 'operator' | 'viewer';

export function canWrite(role: AdminRole): boolean {
  return role === 'super' || role === 'operator';
}

const RANK: Record<AdminRole, number> = { viewer: 1, operator: 2, super: 3 };

export function atMost(given: AdminRole, mine: AdminRole): boolean {
  return RANK[given] <= RANK[mine];
}

/** 부트스트랩 설정의 단일 읽기 경로. 테스트와 운영 모두 호출 시점 값을 사용한다. */
export function bootstrapLoginId(): string | undefined {
  return process.env.ADMIN_LOGIN_ID?.trim() || undefined;
}

export function bootstrapPasswordHash(): string | undefined {
  return process.env.ADMIN_PASSWORD_HASH?.trim() || undefined;
}

/**
 * 기존 부트스트랩 호환용 원문 설정. DB 관리자 계정에는 적용하지 않는다.
 * 명시되어 있으면 해시보다 우선하며, 옛 해시 비밀번호를 추가로 허용하지 않는다.
 * 해시 전용으로 전환할 때는 ADMIN_PASSWORD를 제거해야 한다.
 */
export function bootstrapPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD?.trim() || undefined;
}

export type ResolvedAdmin = {
  role: AdminRole;
  stored: boolean;
};

/** 로그인 후와 관리자 API 관문에서 역할을 조회한다. 이 함수는 권한을 부여하지 않는다. */
export async function resolveAdmin(
  db: Pool | PoolClient,
  userId: string
): Promise<ResolvedAdmin | null> {
  const bootstrapId = bootstrapLoginId();
  const { rows } = await db.query<{
    role: AdminRole | null;
    disabled: boolean;
    is_operator: boolean;
    bootstrap_subject: boolean;
    active_supers: string;
  }>(
    `SELECT
       a.role AS role,
       EXISTS (
         SELECT 1 FROM structured.admin_accounts d
         WHERE d.user_id = u.id AND d.disabled_at IS NOT NULL
       ) AS disabled,
       u.is_operator,
       EXISTS (
         SELECT 1 FROM identity.identities i
         WHERE i.user_id = u.id AND i.provider = 'admin' AND i.subject = $2
       ) AS bootstrap_subject,
       (SELECT count(*) FROM structured.admin_accounts
        WHERE role = 'super' AND disabled_at IS NULL)::text AS active_supers
     FROM structured.users u
     LEFT JOIN structured.admin_accounts a
       ON a.user_id = u.id AND a.disabled_at IS NULL
     WHERE u.id = $1`,
    [userId, bootstrapId ?? null]
  );
  const row = rows[0];
  if (!row) return null;
  if (row.role) return { role: row.role, stored: true };
  // 비활성 DB 계정은 부트스트랩/기존 운영자 경로로 되살리지 않는다.
  if (row.disabled) return null;
  if (bootstrapId && row.bootstrap_subject && Number(row.active_supers) === 0) {
    return { role: 'super', stored: false };
  }
  if (row.is_operator) return { role: 'operator', stored: false };
  return null;
}

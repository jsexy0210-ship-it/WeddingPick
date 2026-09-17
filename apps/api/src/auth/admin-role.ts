import type { Pool, PoolClient } from 'pg';

/**
 * 관리자 콘솔 등급.
 *
 * 0102 이전에는 `structured.users.is_operator` 불리언 하나였다 — 켜져 있거나 꺼져
 * 있거나. 「보기만 하는 사람」을 만들 자리가 없어서, 콘솔을 열어 줄 수 있는 유일한
 * 방법이 모든 것을 할 수 있게 열어 주는 것이었다.
 */
export type AdminRole = 'super' | 'operator' | 'viewer';

/** 등급이 쓰기를 할 수 있는가. 뷰어만 못 한다. */
export function canWrite(role: AdminRole): boolean {
  return role === 'super' || role === 'operator';
}

/**
 * 등급의 높낮이. **만든 사람은 자기 등급보다 높은 등급을 줄 수 없다**(2026-09-10
 * 결정)를 숫자 비교 하나로 지키기 위한 것이다.
 */
const RANK: Record<AdminRole, number> = { viewer: 1, operator: 2, super: 3 };

export function atMost(given: AdminRole, mine: AdminRole): boolean {
  return RANK[given] <= RANK[mine];
}

/**
 * 부트스트랩 아이디. **읽는 자리는 여기 하나뿐이다.**
 *
 * 설정(`Config`)으로 옮겨 두었다가 되돌렸다 — 설정은 서버가 뜰 때 한 번 읽히는데
 * `admin-login.test.ts`는 시험마다 `process.env`를 갈아끼운다. 값이 두 곳에 있으면
 * 어느 쪽이 현행인지가 부르는 자리마다 달라진다.
 */
export function bootstrapLoginId(): string | undefined {
  return process.env.ADMIN_LOGIN_ID?.trim() || undefined;
}

export function bootstrapPasswordHash(): string | undefined {
  return process.env.ADMIN_PASSWORD_HASH?.trim() || undefined;
}

/**
 * 부트스트랩 **원문** 비밀번호(2026-09-10 대표 지시).
 *
 * 해시를 만들어 환경변수로 옮기는 두 단계가 「비밀번호를 바꾸고 바로 들어간다」를
 * 매번 막았다. `ADMIN_PASSWORD`에 원문을 넣으면 그것으로도 통과한다.
 *
 * **부트스트랩 자리에만 둔다.** 콘솔에서 만든 계정(`structured.admin_accounts`)은
 * 해시만 담고 여기 닿지 않는다 — 원문을 표에 넣으면 표를 읽을 수 있는 모두가
 * 모두의 비밀번호를 읽는다.
 *
 * 원문 쪽이 약하다는 것을 숨기지 않는다. 배포 대시보드를 볼 수 있는 사람은 그대로
 * 읽고, 해시는 읽어도 되돌릴 수 없다. `ADMIN_PASSWORD`를 지우면 곧바로 해시 방식으로
 * 돌아간다. **바꿀 때는 둘을 함께 손본다** — 하나만 맞아도 통과하므로 원문만 바꾸고
 * 옛 해시를 두면 옛 비밀번호가 계속 통한다.
 */
export function bootstrapPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD?.trim() || undefined;
}

export type ResolvedAdmin = {
  role: AdminRole;
  /**
   * 표에 줄이 있는 계정인가.
   *
   * 부트스트랩 계정과 CLI로 켠 옛 운영자는 `false`다 — 등급이 **파생된 것**이지
   * 부여된 것이 아니라는 뜻이고, 계정 관리 화면이 그 둘을 목록에 올리지 않는
   * 이유이기도 하다.
   */
  stored: boolean;
};

/**
 * 이 사람이 콘솔에서 무엇을 할 수 있는가. 못 하면 `null`.
 *
 * **로그인 경로는 이 함수를 부르지 않는다.** 「이 아이디의 주인인가」와 「이 사람이
 * 무엇을 할 수 있는가」는 다른 질문이고, 한 곳에서 둘 다 하면 그 한 곳이 뚫렸을 때
 * 권한도 함께 넘어간다(2026-09-10 결정 · 0100 주석과 같은 이유).
 *
 * 세 가지를 이 순서로 본다.
 *
 * 1. `admin_accounts`에 켜져 있는 줄이 있으면 그 등급이다.
 * 2. 꺼진 줄이 있으면 **거기서 끝난다** — 아래로 흘러내리면 끈 계정이 되살아난다.
 * 3. 줄이 없고, 이 사람이 환경변수 부트스트랩 아이디로 로그인했고, 켜져 있는
 *    슈퍼 관리자가 **DB에 하나도 없으면** 슈퍼 관리자로 본다. 아래 설명 참고.
 * 4. 줄이 없고 `is_operator`가 참이면 운영자다. CLI·워크플로로 켠 기존 운영자가
 *    0102 때문에 문 밖에 서게 되지 않도록 남긴다.
 */
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
       /*
        * 꺼진 계정이 있는가. 등급이 아니라 **이것**이 아래 흘러내림을 멈춘다 —
        * 이유는 아래 주석 참고.
        */
       EXISTS (
         SELECT 1 FROM structured.admin_accounts d
         WHERE d.user_id = u.id AND d.disabled_at IS NOT NULL
       ) AS disabled,
       u.is_operator,
       /*
        * 이 사람이 부트스트랩 아이디로 들어왔는가. 아이디 원문은 환경변수에만
        * 있고 질의 인자로만 오간다 — 코드에도 로그에도 적히지 않는다.
        */
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

  /*
   * **꺼진 계정은 여기서 끝난다.** 아래로 흘러내리게 두면 되살아날 길이 둘 남는다.
   *
   * `is_operator`는 콘솔 밖에서도 켤 수 있다(`.github/workflows/admin-operator.yml` ·
   * `retention-admin --operator`). 콘솔에서 끈 사람을 그 워크플로가 다시 켜면 꺼진
   * 계정이 운영자로 돌아온다 — 끈 사람은 껐다고 믿고 있다.
   *
   * 부트스트랩 쪽도 같다. 부트스트랩 아이디로 DB 계정을 만들었다가 껐다면, 그것은
   * 「이 계정을 그만 쓰겠다」는 뜻이지 「환경변수로 돌아가겠다」는 뜻이 아니다.
   *
   * 되살리는 길은 하나로 둔다 — 계정 관리에서 다시 켜는 것.
   */
  if (row.disabled) return null;

  /*
   * **환경변수 계정은 부트스트랩 전용이다**(2026-09-10 결정).
   *
   * 계정이 DB로 옮겨가면 `ADMIN_LOGIN_ID`와 역할이 겹친다. 지워 버리면 슈퍼 관리자를
   * 전부 꺼뜨린 날 아무도 못 들어가고, 그냥 두면 환경변수를 아는 사람이 등급 체계를
   * 우회한다. 그래서 **DB에 켜져 있는 슈퍼 관리자가 0명일 때만** 통한다.
   *
   * 여기서 줄을 만들지 않는 것이 중요하다. 만들면 「로그인이 권한을 준 것」이 된다.
   * 이 등급은 부여된 것이 아니라 환경 설정에서 **파생된 것**이고, 진짜 슈퍼 관리자가
   * 하나 생기는 순간 저절로 사라진다.
   */
  if (bootstrapId && row.bootstrap_subject && Number(row.active_supers) === 0) {
    return { role: 'super', stored: false };
  }

  if (row.is_operator) return { role: 'operator', stored: false };

  return null;
}

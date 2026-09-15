import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { hashAdminPassword } from '../auth/admin-password';
import { type AdminRole, atMost } from '../auth/admin-role';
import { currentAdminRole, currentUserId, requireSuperAdmin } from '../auth/plugin';
import type { AppContext } from '../context';
import { newEventId, recordDecision } from '../decisions';
import { ApiError, notFound } from '../errors';

/**
 * 관리자 계정 관리.
 *
 * 2026-09-10 사용자 요청 — 운영자가 직접 계정을 만들고, 실질 운영 권한과 단순 뷰어
 * 권한을 나눠 줄 수 있게 한다.
 *
 * ---------------------------------------------------------------------------
 * 여기가 「별도 경로」다
 * ---------------------------------------------------------------------------
 *
 * `POST /v1/admin/login`은 「이 아이디의 주인인가」까지만 한다. **권한을 주고 바꾸는
 * 일은 오직 여기서만** 일어난다(2026-09-10 결정). 로그인 경로가 권한까지 줄 수 있으면
 * 그 한 곳이 뚫렸을 때 권한도 함께 넘어간다.
 *
 * 그래서 이 파일의 라우트는 전부 `requireSuperAdmin` 뒤에 있다 — 읽기까지 포함해서.
 * 누가 관리자인지 아는 것부터가 권한을 노리는 첫걸음이다.
 *
 * ---------------------------------------------------------------------------
 * 비밀번호
 * ---------------------------------------------------------------------------
 *
 * 원문은 `hashAdminPassword`를 지나는 순간 버려진다. **응답에도 로그에도 감사기록에도
 * 돌아가지 않는다.** 첫 비밀번호를 서버가 만들어 화면에 한 번 보여주는 방식을 쓰지
 * 않는 이유가 여기 있다 — 만든 사람이 직접 입력하면 「한 번 보여주고 다시 못 본다」를
 * 지킬 필요 자체가 없어진다.
 */

/**
 * 아이디에 쓸 수 있는 글자.
 *
 * 좁게 잡는다. 공백과 대문자를 섞을 수 있으면 `boss`와 `Boss `가 다른 계정이 되고,
 * 목록에서 눈으로는 같아 보인다.
 */
const LOGIN_ID = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9._-]+$/, '아이디는 영문 소문자·숫자·. _ - 만 쓸 수 있어요.');

/**
 * 비밀번호 길이.
 *
 * 최소 12자. 관리자 콘솔은 인터넷에 열려 있고, 여기 뚫리면 콘솔 전체가 넘어간다.
 * 상한은 scrypt에 아주 긴 값을 밀어 넣어 서버를 늦추는 것을 막는다.
 */
const PASSWORD = z.string().min(12).max(200);

const ROLE = z.enum(['super', 'operator', 'viewer']);

const createSchema = z.object({
  loginId: LOGIN_ID,
  password: PASSWORD,
  role: ROLE,
});

const roleSchema = z.object({ role: ROLE });

type AccountRow = {
  id: string;
  user_id: string;
  login_id: string;
  role: AdminRole;
  disabled_at: Date | null;
  created_by_login_id: string | null;
  created_at: Date;
};

function toView(row: AccountRow) {
  return {
    id: row.id,
    loginId: row.login_id,
    role: row.role,
    disabled: row.disabled_at !== null,
    createdBy: row.created_by_login_id,
    createdAt: row.created_at.toISOString(),
  };
}

const SELECT_ACCOUNTS = `
  SELECT a.id, a.user_id, a.login_id, a.role, a.disabled_at, a.created_at,
         maker.login_id AS created_by_login_id
  FROM structured.admin_accounts a
  LEFT JOIN structured.admin_accounts maker ON maker.user_id = a.created_by
`;

export function registerAdminAccountRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireSuperAdmin(context) };

  app.get('/v1/admin/accounts', auth, async (request) => {
    const { rows } = await context.pool.query<AccountRow>(
      `${SELECT_ACCOUNTS} ORDER BY a.disabled_at IS NOT NULL, a.created_at`
    );

    /*
     * 지금 보고 있는 사람이 표에 없을 수 있다 — 부트스트랩 계정이거나 CLI로 켠 옛
     * 운영자다. 화면이 그 사실을 말해 줄 수 있게 함께 보낸다.
     *
     * `viewerAccountId`는 「나머지 전체를 뷰어로」(일괄 내리기)가 자기 자신을
     * 골라내는 데 쓴다 — 화면이 서버에 다시 묻지 않고 이미 받은 목록에서 거른다.
     */
    const me = currentUserId(request);

    return {
      accounts: rows.map(toView),
      viewerIsStored: rows.some((row) => row.user_id === me),
      viewerAccountId: rows.find((row) => row.user_id === me)?.id ?? null,
    };
  });

  app.post('/v1/admin/accounts', auth, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ApiError('invalid_request', parsed.error.issues[0]?.message ?? '입력을 확인해주세요.');
    }

    const { loginId, password, role } = parsed.data;

    /*
     * **자기 등급보다 높은 등급을 줄 수 없다**(2026-09-10 결정). 지금은 이 라우트가
     * 슈퍼 전용이라 늘 통과하지만, 적어 두지 않으면 나중에 운영자에게 계정 생성을
     * 열어 주는 날 운영자가 슈퍼를 찍어낼 수 있게 된다.
     */
    if (!atMost(role, currentAdminRole(request))) {
      throw new ApiError('forbidden', '자기 등급보다 높은 등급은 줄 수 없어요.');
    }

    const client = await context.pool.connect();

    try {
      await client.query('BEGIN');

      const { rows: taken } = await client.query(
        'SELECT 1 FROM structured.admin_accounts WHERE login_id = $1',
        [loginId]
      );

      if (taken[0]) {
        throw new ApiError('conflict', '이미 있는 아이디예요.');
      }

      /*
       * **이 아이디로 이미 로그인한 적이 있을 수 있다.** 부트스트랩 관리자
       * (`ADMIN_LOGIN_ID`)가 그 예다 — 로그인마다 `signIn`이 `identity.identities`에
       * (provider='admin', subject=그 아이디) 줄을 만들어 둔다. 그 신원을 무시하고
       * 새 사람을 또 만들면 `identities`의 (provider, subject) 유일 키에 걸려
       * INSERT가 그대로 죽는다 — 화면에는 「서버 오류」만 뜨고 원인이 안 보인다.
       *
       * **있는 신원을 그대로 쓴다.** 같은 사람이 「부트스트랩으로 임시 슈퍼」에서
       * 「표에 저장된 진짜 슈퍼」가 되는 것이지, 새 사람이 생기는 것이 아니다.
       */
      const { rows: existingIdentity } = await client.query<{ user_id: string }>(
        `SELECT user_id FROM identity.identities WHERE provider = 'admin' AND subject = $1`,
        [loginId]
      );

      let userId = existingIdentity[0]?.user_id;

      if (userId) {
        const { rows: alreadyLinked } = await client.query(
          'SELECT 1 FROM structured.admin_accounts WHERE user_id = $1',
          [userId]
        );

        if (alreadyLinked[0]) {
          throw new ApiError('conflict', '이 아이디는 이미 다른 관리자 계정과 연결돼 있어요.');
        }
      } else {
        const { rows: users } = await client.query<{ id: string }>(
          'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
        );
        userId = users[0]!.id;

        /*
         * 신원도 함께 만든다. 이게 없으면 로그인 때 `signIn`이 계정을 새로 파고, 방금
         * 만든 등급과 이어지지 않은 빈 계정으로 들어간다.
         */
        await client.query(
          `INSERT INTO identity.identities (user_id, provider, subject) VALUES ($1, 'admin', $2)`,
          [userId, loginId]
        );
      }

      /*
       * **가입 절차를 지난 것으로 둔다.** 관리자 계정에는 동의 화면이 없다 — 쓰지
       * 않는 화면을 지나게 하려고 관리자를 사용자 온보딩으로 보낼 수는 없다. 이걸
       * 비워 두면 `structured.active_users`에 뜨지 않아, 관문이 「가입이 끝나지
       * 않았다」며 자기 콘솔에서 돌려보낸다.
       *
       * 나이 확인도 함께 적는다. `activated_only_when_old_enough`가 통과 표시 없는
       * 활성 계정을 막기 때문이다 — 관리자는 사람이 만들어 주는 계정이라 확인한
       * 사람이 있고, 언제 확인했는지를 남긴다(seed-demo의 `ACTIVE_OPERATOR`와 같은 꼴).
       *
       * **이미 활성인 계정은 건드리지 않는다**(`COALESCE`, admin-login.ts와 같은 꼴).
       * 재사용한 신원은 부트스트랩 로그인 때 이미 활성화됐을 수 있다 — 그 시각을
       * 다시 지금으로 밀 이유가 없다.
       */
      await client.query(
        `UPDATE structured.users
         SET age_gate = 'passed',
             age_checked_at = COALESCE(age_checked_at, now()),
             age_verified = true,
             age_verified_at = COALESCE(age_verified_at, now()),
             activated_at = COALESCE(activated_at, now())
         WHERE id = $1`,
        [userId]
      );

      const { rows } = await client.query<AccountRow>(
        `INSERT INTO structured.admin_accounts (user_id, login_id, password_hash, role, created_by)
         VALUES ($1, $2, $3, $4::admin_role, $5)
         RETURNING id, user_id, login_id, role, disabled_at, created_at, null::text AS created_by_login_id`,
        /* 원문은 이 줄에서 해시가 되고 그대로 버려진다. */
        [userId, loginId, hashAdminPassword(password), role, currentUserId(request)]
      );

      await recordAccountDecision(client, request, rows[0]!.id, 'create', role);

      await client.query('COMMIT');

      return reply.status(201).send(toView(rows[0]!));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.patch('/v1/admin/accounts/:id/role', auth, async (request) => {
    const parsed = roleSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ApiError('invalid_request', '등급을 확인해주세요.');
    }

    if (!atMost(parsed.data.role, currentAdminRole(request))) {
      throw new ApiError('forbidden', '자기 등급보다 높은 등급은 줄 수 없어요.');
    }

    return await change(request, 'grade', parsed.data.role);
  });

  app.patch('/v1/admin/accounts/:id/disabled', auth, async (request) => {
    const parsed = z.object({ disabled: z.boolean() }).safeParse(request.body);

    if (!parsed.success) {
      throw new ApiError('invalid_request', '켤지 끌지를 알려주세요.');
    }

    return await change(request, parsed.data.disabled ? 'disable' : 'enable', null);
  });

  /**
   * 나머지 전체를 뷰어로 내린다(2026-09-15 대표 지시 — 「나머지 계정은 싹다
   * 테스트(조회만 가능)으로 변경해」).
   *
   * 한 번에 여러 계정을 바꿀 필요가 있어서 `change()`(계정 하나)와 따로 둔다.
   * **`change()`의 「다른 슈퍼 관리자는 못 건드린다」 규칙을 여기서는 적용하지
   * 않는다** — 그 규칙은 등급이 같은 슈퍼끼리 서로 먼저 누르는 경주를 막는
   * 것이고, 이 라우트는 정반대로 「지금 나 하나로 모은다」는 의도된 일괄 조작이다.
   *
   * **그래도 마지막 슈퍼 보호는 그대로 산다.** 내가 표에 저장된 계정이면 여기서
   * 빼서 최소 하나는 슈퍼로 남고, 내가 부트스트랩(표에 없음)이면 전부 뷰어가 될
   * 수 있는데 그 경우 0102의 DB 트리거(`keep_one_super_admin`)가 마지막 줄에서
   * 막아 트랜잭션 전체가 롤백된다 — **먼저 「관리자 추가」로 진짜 슈퍼를 만들고
   * 나서 이 단추를 눌러야 하는 이유다.**
   */
  app.post('/v1/admin/accounts/demote-others', auth, async (request) => {
    const me = currentUserId(request);
    const client = await context.pool.connect();

    try {
      await client.query('BEGIN');

      /*
       * **DB 트리거에 맡기지 않고 미리 본다.** 트리거(`keep_one_super_admin`)는
       * 「지금 표에 활성 슈퍼가 0명인가」만 본다 — 어느 행을 고쳤는지는 안 본다.
       * 그래서 내가 표에 저장된 활성 슈퍼가 아니면, **그 사실 자체가 이미 표
       * 전체에 활성 슈퍼가 0명이라는 뜻**이다(부트스트랩은 그때만 슈퍼로 보인다,
       * `auth/admin-role.ts`). 그 상태에서는 이 화면의 어느 행을 고쳐도 — 슈퍼가
       * 아닌 운영자 하나를 뷰어로 내리는 것조차 — 트리거가 raw 예외로 막는다.
       * 화면에는 「서버 오류」로만 뜨므로, 여기서 먼저 친절하게 막는다.
       */
      const { rows: viewerIsActiveSuper } = await client.query(
        `SELECT 1 FROM structured.admin_accounts WHERE user_id = $1 AND role = 'super' AND disabled_at IS NULL`,
        [me]
      );

      if (!viewerIsActiveSuper[0]) {
        throw new ApiError(
          'conflict',
          '지금 이 화면은 표에 저장된 슈퍼 관리자가 아니에요. 관리자 추가로 먼저 진짜 슈퍼 관리자를 만든 뒤 나머지를 내려주세요.'
        );
      }

      const { rows: targets } = await client.query<{ id: string; login_id: string }>(
        `SELECT id, login_id FROM structured.admin_accounts
         WHERE user_id <> $1 AND disabled_at IS NULL AND role <> 'viewer'
         FOR UPDATE`,
        [me]
      );

      for (const target of targets) {
        await client.query(
          `UPDATE structured.admin_accounts SET role = 'viewer', updated_at = now() WHERE id = $1`,
          [target.id]
        );
        await recordAccountDecision(client, request, target.id, 'grade', 'viewer');
      }

      await client.query('COMMIT');

      return { changed: targets.map((t) => t.login_id) };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  /**
   * 등급 변경과 켜고 끄기가 지켜야 할 것이 같아서 한 곳에 둔다.
   *
   * **슈퍼 관리자는 스스로를 지킨다.**
   *
   * - 남이 슈퍼 관리자를 내리거나 끌 수 없다. 슈퍼가 여럿일 때 서로를 내릴 수 있으면,
   *   먼저 누르는 쪽이 이긴다 — 그건 등급이 아니라 경주다.
   * - 마지막 슈퍼 관리자는 **자기 자신도** 내릴 수 없다. 그러면 아무도 계정 관리에
   *   들어갈 수 없다. 여기서 막고, 0102의 트리거가 한 번 더 막는다(라우트는 하나 더
   *   생길 수 있고, psql로 직접 고치는 날도 온다).
   */
  async function change(
    request: FastifyRequest,
    step: 'grade' | 'disable' | 'enable',
    role: AdminRole | null
  ) {
    const { id } = request.params as { id: string };

    if (!z.string().uuid().safeParse(id).success) {
      throw notFound('관리자 계정');
    }

    const client = await context.pool.connect();

    try {
      await client.query('BEGIN');

      /*
       * **줄을 잠그고 나서 센다.** 잠그지 않으면 마지막 슈퍼 둘이 동시에 자기를
       * 내릴 때 둘 다 「나 말고 하나 더 있다」를 보고 둘 다 내려간다.
       */
      const { rows } = await client.query<AccountRow & { user_id: string }>(
        `SELECT a.id, a.user_id, a.login_id, a.role, a.disabled_at, a.created_at,
                null::text AS created_by_login_id
         FROM structured.admin_accounts a WHERE a.id = $1 FOR UPDATE`,
        [id]
      );

      const target = rows[0];

      if (!target) {
        throw notFound('관리자 계정');
      }

      const me = currentUserId(request);
      const mine = target.user_id === me;

      if (target.role === 'super' && !mine) {
        throw new ApiError('forbidden', '다른 슈퍼 관리자의 등급과 상태는 바꿀 수 없어요.');
      }

      const stillSuper =
        step === 'grade' ? role === 'super' : step === 'disable' ? false : target.role === 'super';

      if (target.role === 'super' && !stillSuper && (await lastSuper(client, target.id))) {
        /*
         * **누가 막았는지를 같이 말한다**(2026-09-15 대표 지시 — 「누가 그 마지막
         * 슈퍼인지를 같이 보여줘라」). 지금 보는 사람이 표에 없는 부트스트랩
         * 계정이면 그 사실도 함께 적는다 — 「나도 슈퍼인데 왜 막히냐」는 바로
         * 이 경우이고, 자신이 아직 표에 저장되지 않았다는 것이 답이다.
         */
        const { rows: viewerStored } = await client.query(
          'SELECT 1 FROM structured.admin_accounts WHERE user_id = $1',
          [me]
        );
        const viewerNote = viewerStored[0]
          ? ''
          : ' 지금 이 화면은 환경변수(부트스트랩) 계정으로 열려 있어서 표에 저장된 슈퍼로 세지 않아요 — 관리자 추가로 먼저 진짜 계정을 만드세요.';

        throw new ApiError(
          'conflict',
          `${target.login_id} 계정이 지금 표에 저장된 유일한 슈퍼 관리자예요. 다른 슈퍼 관리자를 먼저 만들어야 바꿀 수 있어요.${viewerNote}`
        );
      }

      const { rows: changed } = await client.query<AccountRow>(
        step === 'grade'
          ? `UPDATE structured.admin_accounts
             SET role = $2::admin_role, updated_at = now() WHERE id = $1
             RETURNING id, user_id, login_id, role, disabled_at, created_at, null::text AS created_by_login_id`
          : `UPDATE structured.admin_accounts
             SET disabled_at = $2, updated_at = now() WHERE id = $1
             RETURNING id, user_id, login_id, role, disabled_at, created_at, null::text AS created_by_login_id`,
        [id, step === 'grade' ? role : step === 'disable' ? new Date() : null]
      );

      await recordAccountDecision(client, request, id, step, role ?? target.role);

      await client.query('COMMIT');

      return toView(changed[0]!);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

/** 이 계정 말고 켜져 있는 슈퍼 관리자가 없는가. */
async function lastSuper(
  client: Parameters<typeof recordDecision>[0],
  exceptId: string
): Promise<boolean> {
  const { rows } = await client.query<{ others: string }>(
    `SELECT count(*)::text AS others FROM structured.admin_accounts
     WHERE role = 'super' AND disabled_at IS NULL AND id <> $1`,
    [exceptId]
  );

  return Number(rows[0]!.others) === 0;
}

/**
 * 누가 언제 누구에게 했는지 남긴다.
 *
 * **표를 새로 만들지 않는다.** `structured.audit_log`는 없고, 감사 기록 화면
 * (`admin/audit-log.tsx` → `GET /v1/admin/audit-log`)이 실제로 읽는 것은
 * `structured.decisions`다. 거기에 남기면 화면이 그대로 보여준다.
 *
 * 그 표가 이 일에 맞는 이유가 하나 더 있다 — `evidence_refs`가 `{kind, id}` 꼴만
 * 통과시킨다. **비밀번호가 새어 들어갈 자리가 구조적으로 없다.**
 */
async function recordAccountDecision(
  client: Parameters<typeof recordDecision>[0],
  request: { userId?: string },
  accountId: string,
  step: 'create' | 'grade' | 'disable' | 'enable',
  role: AdminRole
): Promise<void> {
  await recordDecision(client, {
    eventId: newEventId(),
    workflow: 'admin_account',
    step,
    subjectKind: 'admin_account',
    subjectId: accountId,
    decider: { kind: 'human', userId: request.userId! },
    /*
     * 무엇을 했는가. 등급을 정하는 일(만들기·바꾸기)은 **그 등급**을 남긴다 —
     * 「만들었다」만 남으면 어느 등급으로 만들었는지 나중에 알 수 없다.
     */
    decision: step === 'create' || step === 'grade' ? role : step,
    reasonCode: `admin_account_${step}`,
    evidence: [],
  });
}

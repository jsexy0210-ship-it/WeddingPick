import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { sameId, verifyAdminPassword } from '../auth/admin-password';
import { bootstrapLoginId, bootstrapPasswordHash, resolveAdmin } from '../auth/admin-role';
import { signIn } from '../auth/sessions';
import type { AppContext } from '../context';
import { ApiError } from '../errors';

/**
 * 관리자 로그인.
 *
 * **사용자 로그인과 다른 길이다.** v3.25가 사용자 화면을 카카오 하나로 정했지만
 * 관리자는 예외로 둔다(2026-09-10 사용자 결정) — 카카오 계정에 운영 권한을 매달면
 * 그 계정을 잃었을 때 권한을 회수할 방법이 카카오 쪽에 있게 된다.
 *
 * **원문 비밀번호는 어디에도 없다.** DB에 있는 것도 환경변수에 있는 것도 소금과
 * 해시뿐이다.
 *
 * **로그인이 곧 권한은 아니다.** 여기서 하는 일은 「이 사람이 그 아이디의 주인인가」
 * 까지다(2026-09-10 결정). 등급을 주고 바꾸는 일은 계정 관리 경로
 * (`routes/admin-accounts.ts`)에서만 일어난다 — 라우트가 권한까지 줄 수 있으면
 * 이 한 곳이 뚫렸을 때 권한도 함께 넘어간다. 이 파일은 `admin_accounts`에 한 줄도
 * 쓰지 않는다.
 *
 * ---------------------------------------------------------------------------
 * 계정이 둘 있는 곳에서 온다
 * ---------------------------------------------------------------------------
 *
 * 0102가 계정을 DB로 옮긴 뒤로 아이디는 두 곳에 있을 수 있다.
 *
 * 1. `structured.admin_accounts` — 운영자가 콘솔에서 만든 계정. 꺼진 계정은 없는
 *    것과 같다.
 * 2. `ADMIN_LOGIN_ID` · `ADMIN_PASSWORD_HASH` — **부트스트랩 전용**. DB에 켜져
 *    있는 슈퍼 관리자가 하나도 없을 때만 통한다. 모두를 잠가버려도 되살릴 길을
 *    남기되, 평소에는 환경변수를 아는 사람이 등급 체계를 우회하지 못하게 한다.
 *
 * 부트스트랩 계정이 「슈퍼 관리자로 보이는」 것은 이 라우트가 아니라 관문
 * (`auth/admin-role.ts`)이 정한다. 여기서는 신원만 세우고 지나간다.
 */
const loginSchema = z.object({
  id: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

/**
 * 틀린 시도를 세어 늦춘다.
 *
 * 이 경로는 인터넷에 열려 있고 아이디는 하나뿐이라, 아무 제한이 없으면 비밀번호를
 * 기계로 밀어볼 수 있다. 프로세스 안에 두는 것이라 재시작하면 지워지고 서버가 여럿이면
 * 각자 센다 — 완전한 방어가 아니라 **속도를 죽이는 것**이 목적이다.
 *
 * 성공하면 지운다. 맞는 비밀번호를 아는 사람이 앞사람의 실패 때문에 기다릴 이유는 없다.
 */
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPTS_BEFORE_DELAY = 5;
const MAX_DELAY_MS = 8_000;

const attempts = new Map<string, { count: number; first: number }>();

function recordFailure(key: string): void {
  const now = Date.now();

  /*
   * **넣기 전에 지난 것을 치운다.** 치우지 않으면 실패한 주소마다 줄이 하나씩
   * 남고 지워지지 않는다 — 성공해야만 지워지는데, 밀어보는 쪽은 성공하지 않는다.
   * 주소를 바꿔 가며 두드리면 그것이 그대로 메모리가 된다.
   */
  for (const [seenKey, seenAt] of attempts) {
    if (now - seenAt.first > ATTEMPT_WINDOW_MS) attempts.delete(seenKey);
  }

  const seen = attempts.get(key);

  if (!seen || now - seen.first > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });

    return;
  }

  seen.count += 1;
}

function delayFor(key: string): number {
  const seen = attempts.get(key);

  if (!seen || Date.now() - seen.first > ATTEMPT_WINDOW_MS) return 0;
  if (seen.count < ATTEMPTS_BEFORE_DELAY) return 0;

  return Math.min(MAX_DELAY_MS, 2 ** (seen.count - ATTEMPTS_BEFORE_DELAY) * 500);
}

/**
 * 부트스트랩 계정이 지금 쓸 수 있는가.
 *
 * **DB에 켜져 있는 슈퍼 관리자가 하나라도 있으면 `null`이다.** 그 순간부터 환경변수
 * 계정은 없는 것과 같이 굴고, 위의 대조는 아이디부터 실패한다 — 그래도 응답은
 * 「아이디 또는 비밀번호가 맞지 않아요」 하나뿐이라, 밖에서는 이 길이 열려 있는지
 * 닫혀 있는지 알 수 없다.
 */
async function bootstrapCandidate(
  context: AppContext
): Promise<{ id: string; hash: string } | null> {
  const adminLoginId = bootstrapLoginId();
  const adminPasswordHash = bootstrapPasswordHash();

  if (!adminLoginId || !adminPasswordHash) return null;

  const { rows } = await context.pool.query<{ supers: string }>(
    `SELECT count(*)::text AS supers FROM structured.admin_accounts
     WHERE role = 'super' AND disabled_at IS NULL`
  );

  if (Number(rows[0]!.supers) > 0) return null;

  return { id: adminLoginId, hash: adminPasswordHash };
}

export function registerAdminLoginRoutes(app: FastifyInstance, context: AppContext): void {
  app.post('/v1/admin/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ApiError('invalid_request', '아이디와 비밀번호를 입력해주세요.');
    }

    const key = request.ip;
    const wait = delayFor(key);

    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

    /*
     * DB 계정을 먼저 본다. 꺼진 계정은 조건에서 빠지므로 해시를 찾지 못하고, 아래
     * 대조가 실패한다 — 끈 사람에게 「꺼졌다」고 알려줄 이유도 없다.
     */
    const { rows: stored } = await context.pool.query<{ login_id: string; password_hash: string }>(
      `SELECT login_id, password_hash FROM structured.admin_accounts
       WHERE login_id = $1 AND disabled_at IS NULL`,
      [parsed.data.id]
    );

    const bootstrap = stored[0] ? null : await bootstrapCandidate(context);

    const expectedId = stored[0]?.login_id ?? bootstrap?.id;
    const expectedHash = stored[0]?.password_hash ?? bootstrap?.hash;

    /*
     * **아이디가 틀려도 비밀번호를 끝까지 대조한다.** 아이디에서 바로 돌아오면 응답
     * 시간만으로 「이 아이디는 있다」를 알 수 있다. scrypt 한 번은 어차피 치른다.
     */
    const idOk = sameId(parsed.data.id, expectedId);
    const passwordOk = await verifyAdminPassword(parsed.data.password, expectedHash);

    if (!idOk || !passwordOk) {
      recordFailure(key);
      request.log.warn({ ip: key }, '관리자 로그인 실패');

      /* 무엇이 틀렸는지 말하지 않는다 — 아이디를 맞춰보는 데 쓰인다. */
      throw new ApiError('unauthenticated', '아이디 또는 비밀번호가 맞지 않아요.');
    }

    attempts.delete(key);

    const session = await signIn(
      context.pool,
      { provider: 'admin', subject: expectedId!, profile: {} },
      context.config.sessionTtlDays,
      context.config.operatorSessionTtlDays
    );

    /*
     * **관리자 계정을 활성으로 표시한다.**
     *
     * `requireOperatorUser`는 권한을 보기 전에 `activated`를 먼저 본다. 그 값은
     * `structured.active_users` 뷰가 정하고, 뷰는 `activated_at IS NOT NULL`인
     * 사람만 담는다. 그 시각은 **소비자가 가입 동의를 끝낼 때** 찍힌다
     * (v3.13 §N-2 — 소셜 로그인 성공만으로 서비스를 쓰게 하지 않는다).
     *
     * 관리자는 그 절차를 거치지 않는다. 그래서 로그인은 되는데 관리자 API가 전부
     * 403으로 막혔고, 화면은 그 403을 「다시 로그인」으로 읽어 로그인으로 되돌렸다 —
     * **들어갔다가 튕겨 나온다**(2026-09-10 사용자 보고 · #175).
     *
     * §N-2가 막으려는 것은 「소셜 로그인만 한 대기 계정」이다. 이 경로는 그것이
     * 아니다 — 아이디와 비밀번호를 아는 사람만 여기 닿고, 그 자격은 운영자가 직접
     * 심는다. 소비자 동의 관문의 대상이 아니다.
     *
     * `age_gate`도 함께 채운다 — `activated_only_when_old_enough` 제약이
     * `activated_at IS NULL OR age_gate = 'passed'`를 요구하고, `age_check_has_time`이
     * 그 짝으로 `age_checked_at`을 요구한다. 셋을 한 번에 맞추지 않으면 제약에서
     * 막힌다.
     *
     * 이미 활성인 계정은 건드리지 않는다(`COALESCE`) — 다시 로그인할 때마다
     * 가입 시각이 밀리면 「언제부터 쓴 계정인가」에 답할 수 없게 된다.
     *
     * **이것은 권한이 아니다.** 「이 계정이 쓸 수 있는 상태인가」까지이고, 콘솔에서
     * 무엇을 할 수 있는지는 아래 `resolveAdmin`이 따로 정한다(0102).
     */
    await context.pool.query(
      `UPDATE structured.users
          SET age_gate = 'passed',
              age_checked_at = COALESCE(age_checked_at, now()),
              activated_at = COALESCE(activated_at, now())
        WHERE id = $1
          AND activated_at IS NULL`,
      [session.userId]
    );

    /*
     * 아이디와 비밀번호는 맞지만 등급이 없을 수 있다 — 계정이 꺼졌거나, 부트스트랩
     * 아이디인데 이미 슈퍼 관리자가 생겨서 그 길이 닫혔거나.
     *
     * **여기서 등급을 주지 않는다.** 무엇이 부족한지만 말한다.
     */
    const admin = await resolveAdmin(context.pool, session.userId);

    if (!admin) {
      throw new ApiError('forbidden', '이 계정에는 관리자 권한이 없어요.');
    }

    return reply.status(201).send({
      token: session.token,
      userId: session.userId,
      role: admin.role,
      expiresAt: session.expiresAt.toISOString(),
    });
  });
}

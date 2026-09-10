import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { sameId, verifyAdminPassword } from '../auth/admin-password';
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
 * **원문 비밀번호는 저장소에 없다.** 서버가 아는 것은 `ADMIN_LOGIN_ID`와
 * `ADMIN_PASSWORD_HASH` 둘뿐이고, 뒤의 것은 소금과 해시만 담는다.
 *
 * **로그인이 곧 권한은 아니다.** 여기서 하는 일은 「이 사람이 그 아이디의 주인인가」
 * 까지다. 운영 권한(`is_operator`)은 CLI로만 켠다 — 라우트가 권한까지 줄 수 있으면
 * 이 한 곳이 뚫렸을 때 권한도 함께 넘어간다.
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

export function registerAdminLoginRoutes(app: FastifyInstance, context: AppContext): void {
  app.post('/v1/admin/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ApiError('invalid_request', '아이디와 비밀번호를 입력해주세요.');
    }

    const key = request.ip;
    const wait = delayFor(key);

    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

    const expectedId = process.env.ADMIN_LOGIN_ID?.trim();
    const expectedHash = process.env.ADMIN_PASSWORD_HASH?.trim();

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
     * 관리자는 그 절차를 거치지 않는다. 그래서 로그인은 되는데(로그인은
     * `is_operator`만 본다) 관리자 API가 전부 403으로 막혔고, 화면은 그 403을
     * 「다시 로그인」으로 읽어 로그인으로 되돌렸다 — **들어갔다가 튕겨 나온다**
     * (2026-09-10 사용자 보고).
     *
     * §N-2가 막으려는 것은 「소셜 로그인만 한 대기 계정」이다. 이 경로는 그것이
     * 아니다 — `ADMIN_LOGIN_ID`와 `ADMIN_PASSWORD_HASH`를 아는 사람만 여기 닿고,
     * 그 자격은 운영자가 직접 심는다. 소비자 동의 관문의 대상이 아니다.
     *
     * `age_gate`도 함께 채운다 — `activated_only_when_old_enough` 제약이
     * `activated_at IS NULL OR age_gate = 'passed'`를 요구하고, `age_check_has_time`이
     * 그 짝으로 `age_checked_at`을 요구한다. 셋을 한 번에 맞추지 않으면 제약에서
     * 막힌다.
     *
     * 이미 활성인 계정은 건드리지 않는다(`COALESCE`) — 다시 로그인할 때마다
     * 가입 시각이 밀리면 「언제부터 쓴 계정인가」에 답할 수 없게 된다.
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

    const { rows } = await context.pool.query<{ is_operator: boolean }>(
      'SELECT is_operator FROM structured.users WHERE id = $1',
      [session.userId]
    );

    if (!rows[0]?.is_operator) {
      /*
       * 계정은 생겼지만 아직 운영 권한이 없다. **여기서 켜 주지 않는다** — 이 경로가
       * 권한까지 줄 수 있으면 뚫렸을 때 권한도 함께 넘어간다. 무엇을 해야 하는지는
       * 말해 준다. 계정 id를 함께 주는 것은 그 명령에 필요한 값이기 때문이다.
       */
      throw new ApiError(
        'forbidden',
        `이 계정에는 아직 운영 권한이 없어요. 서버에서 "npm run retention --workspace @weddingpick/api -- --operator ${session.userId}"를 한 번 실행해주세요.`
      );
    }

    return reply.status(201).send({
      token: session.token,
      userId: session.userId,
      expiresAt: session.expiresAt.toISOString(),
    });
  });
}

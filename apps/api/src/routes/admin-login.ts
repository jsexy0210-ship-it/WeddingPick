import { createHash } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { sameId, verifyAdminPassword } from '../auth/admin-password';
import {
  bootstrapLoginId,
  bootstrapPassword,
  bootstrapPasswordHash,
  resolveAdmin,
} from '../auth/admin-role';
import { signIn, signOut } from '../auth/sessions';
import type { AppContext } from '../context';
import { ApiError } from '../errors';

/**
 * 관리자 ID/PW 인증. DB 계정이 있으면 환경변수로 우회하지 않는다.
 * 부트스트랩은 활성 슈퍼 관리자가 없을 때만 허용한다.
 * ADMIN_PASSWORD를 명시하면 그것만, 없으면 ADMIN_PASSWORD_HASH를 사용한다.
 * 권한을 부여하거나 변경하는 일은 이 경로에서 하지 않는다.
 */
const loginSchema = z.object({
  id: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

const ATTEMPTS_BEFORE_DELAY = 5;
const MAX_DELAY_MS = 8_000;

/**
 * 로그인 ID와 네트워크 식별자를 원문으로 저장하지 않는다.
 *
 * ID만 쓰면 제3자가 그 ID를 반복 실패시켜 정상 관리자를 함께 지연시키는 계정 잠금
 * DoS가 쉬워지고, IP만 쓰면 한 사무실/NAT의 정상 관리자들이 서로의 실패를 떠안는다.
 * 둘을 묶되 DB에는 해시만 남긴다. 로그인 ID 대조 자체는 기존 sameId 규칙(대소문자
 * 포함)을 그대로 쓴다.
 */
export function networkIdFor(request: FastifyRequest): string {
  /*
   * Kakao Nginx는 X-Real-IP를 $remote_addr로 덮어쓰고 API 포트는 host loopback에만
   * publish한다. 반면 X-Forwarded-For는 클라이언트가 앞 값을 심을 수 있으므로
   * trustProxy=true의 request.ip를 보안 식별자로 단독 신뢰하지 않는다.
   *
   * 테스트/로컬처럼 X-Real-IP가 없는 경우에만 request.ip로 되돌아간다.
   */
  const realIp = request.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    const trimmed = realIp.trim();
    if (trimmed && trimmed.length <= 128 && !trimmed.includes(',')) return trimmed;
  }
  return request.ip;
}

function attemptKey(loginId: string, networkId: string): string {
  return createHash('sha256').update(loginId).update('\0').update(networkId).digest('hex');
}

/**
 * 현재 확정된 실패 횟수만 읽는다.
 *
 * 진행 중인 인증 요청은 실패가 아니다. 미리 count를 올리면 정상 성공 요청 자체가
 * 제한 상태를 만들고, 성공/실패 완료 순서와 DB 상태가 어긋난다.
 */
async function currentFailureCount(context: AppContext, key: string): Promise<number> {
  await context.pool.query(
    `DELETE FROM structured.admin_login_attempts
      WHERE window_started_at <= now() - interval '15 minutes'
         OR updated_at <= now() - interval '15 minutes'`
  );

  const { rows } = await context.pool.query<{ failure_count: number }>(
    `SELECT failure_count
       FROM structured.admin_login_attempts
      WHERE attempt_key = $1`,
    [key]
  );

  return rows[0]?.failure_count ?? 0;
}

function delayForFailures(failureCount: number): number {
  if (failureCount < ATTEMPTS_BEFORE_DELAY) return 0;
  return Math.min(MAX_DELAY_MS, 2 ** (failureCount - ATTEMPTS_BEFORE_DELAY) * 500);
}

/**
 * 인증 실패가 확정된 시점에만 원자적으로 기록한다.
 *
 * 동시 실패는 ON CONFLICT가 같은 키를 직렬화하므로 증가분을 잃지 않는다. 반대로
 * 성공 완료 후 늦게 끝난 실패는 성공의 DELETE 다음에 새 row를 만들기 때문에
 * 자연스럽게 남는다.
 */
async function recordFailure(context: AppContext, key: string): Promise<void> {
  await context.pool.query(
    `INSERT INTO structured.admin_login_attempts AS current
       (attempt_key, failure_count, window_started_at, updated_at)
     VALUES ($1, 1, now(), now())
     ON CONFLICT (attempt_key) DO UPDATE
       SET failure_count = CASE
             WHEN current.window_started_at <= now() - interval '15 minutes'
               THEN 1
             ELSE current.failure_count + 1
           END,
           window_started_at = CASE
             WHEN current.window_started_at <= now() - interval '15 minutes'
               THEN now()
             ELSE current.window_started_at
           END,
           updated_at = now()`,
    [key]
  );
}

async function clearAttempts(context: AppContext, key: string): Promise<void> {
  await context.pool.query(
    'DELETE FROM structured.admin_login_attempts WHERE attempt_key = $1',
    [key]
  );
}

async function bootstrapCandidate(
  context: AppContext
): Promise<{ id: string; hash?: string; plain?: string } | null> {
  const id = bootstrapLoginId();
  const hash = bootstrapPasswordHash();
  const plain = bootstrapPassword();
  // 원문만 설정한 환경도 지원한다. 기존에는 해시가 없으면 여기서 차단됐다.
  if (!id || (!hash && !plain)) return null;

  const { rows } = await context.pool.query<{ supers: string }>(
    `SELECT count(*)::text AS supers FROM structured.admin_accounts
     WHERE role = 'super' AND disabled_at IS NULL`
  );
  if (rows[0]?.supers !== '0') return null;
  return { id, hash, plain };
}

export function registerAdminLoginRoutes(app: FastifyInstance, context: AppContext): void {
  app.post('/v1/admin/login', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('Pragma', 'no-cache');
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) throw new ApiError('invalid_request', '아이디와 비밀번호를 입력해주세요.');

    const key = attemptKey(parsed.data.id, networkIdFor(request));
    const failureCount = await currentFailureCount(context, key);
    const wait = delayForFailures(failureCount);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

    // 비활성 계정도 조회한다. 같은 ID의 환경변수 계정으로 돌아가지 못하게 한다.
    const { rows: stored } = await context.pool.query<{
      login_id: string;
      password_hash: string;
      disabled: boolean;
    }>(
      `SELECT login_id, password_hash, disabled_at IS NOT NULL AS disabled
       FROM structured.admin_accounts WHERE login_id = $1`,
      [parsed.data.id]
    );
    const account = stored[0];
    const bootstrap = account ? null : await bootstrapCandidate(context);
    const expectedId = account?.login_id ?? bootstrap?.id;
    const expectedHash = account?.password_hash ?? bootstrap?.hash;
    const expectedPlain = account ? undefined : bootstrap?.plain;
    const idOk = sameId(parsed.data.id, expectedId);
    const passwordOk = await verifyAdminPassword(parsed.data.password, expectedHash, expectedPlain);

    if (!idOk || !passwordOk || account?.disabled) {
      await recordFailure(context, key);
      request.log.warn('관리자 로그인 실패');
      throw new ApiError('unauthenticated', '아이디 또는 비밀번호가 맞지 않아요.');
    }

    const session = await signIn(
      context.pool,
      { provider: 'admin', subject: expectedId!, profile: {} },
      context.config.sessionTtlDays,
      context.config.operatorSessionTtlDays
    );

    try {
      // 관리자는 소비자 동의 화면을 거치지 않는다. 기존 활성 시각은 유지한다.
      await context.pool.query(
        `UPDATE structured.users
            SET age_gate = 'passed',
                age_checked_at = COALESCE(age_checked_at, now()),
                age_verified = true,
                age_verified_at = COALESCE(age_verified_at, now()),
                activated_at = COALESCE(activated_at, now())
          WHERE id = $1 AND activated_at IS NULL`,
        [session.userId]
      );
      const admin = await resolveAdmin(context.pool, session.userId);
      if (!admin) throw new ApiError('forbidden', '이 계정에는 관리자 권한이 없어요.');

      // 세션 발급과 권한 확인까지 성공한 로그인만 실패 이력을 지운다.
      await clearAttempts(context, key);

      return reply.status(201).send({
        token: session.token,
        userId: session.userId,
        role: admin.role,
        expiresAt: session.expiresAt.toISOString(),
      });
    } catch (error) {
      // 권한 확인/활성화 실패로 반환하지 못한 세션을 활성 상태로 남기지 않는다.
      try {
        await signOut(context.pool, session.token);
      } catch (cleanupError) {
        request.log.error({ err: cleanupError }, '미발급 관리자 세션 폐기 실패');
      }
      throw error;
    }
  });
}

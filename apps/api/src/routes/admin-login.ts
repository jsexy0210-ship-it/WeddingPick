import type { FastifyInstance } from 'fastify';
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

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPTS_BEFORE_DELAY = 5;
const MAX_DELAY_MS = 8_000;
// 프로세스 재시작 시 초기화되며 서버 여러 대에서 공유되지 않는다.
const attempts = new Map<string, { count: number; first: number }>();

function recordFailure(key: string): void {
  const now = Date.now();
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
  if (!seen || Date.now() - seen.first > ATTEMPT_WINDOW_MS || seen.count < ATTEMPTS_BEFORE_DELAY) return 0;
  return Math.min(MAX_DELAY_MS, 2 ** (seen.count - ATTEMPTS_BEFORE_DELAY) * 500);
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

    const key = request.ip;
    const wait = delayFor(key);
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
      recordFailure(key);
      request.log.warn({ ip: key }, '관리자 로그인 실패');
      throw new ApiError('unauthenticated', '아이디 또는 비밀번호가 맞지 않아요.');
    }
    attempts.delete(key);

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

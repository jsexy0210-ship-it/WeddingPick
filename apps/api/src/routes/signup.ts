import { completeSignupRequestSchema, type SignupState } from '@weddingpick/api-contract';
import {
  AGE_BLOCKED_NOTICE,
  CONSENT_ITEMS,
  MINIMUM_AGE,
  REQUIRED_CONSENTS,
  canActivate,
  consentVersion,
  missingRequiredConsents,
  type ConsentItem,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireSignup } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError } from '../errors';

/**
 * 가입 완료. 통합정책 v3.13 §3.5.
 *
 * 여기만 `requireSignup`을 단다 — 아직 활성화되지 않은 계정이 부를 수 있는 유일한
 * 자리다. 다른 모든 경로는 `requireUser`가 막는다.
 *
 * 만 14세 확인은 로그인 화면의 체크박스 하나다. 생년월일을 받지 않으므로 여기서도
 * 날짜를 세지 않는다 — `body.ageVerified`가 그 확인의 전부다.
 */
export function registerSignupRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireSignup(context) };

  async function loadState(userId: string): Promise<SignupState> {
    const { rows } = await context.pool.query<{
      age_verified: boolean;
      activated_at: Date | null;
    }>('SELECT age_verified, activated_at FROM structured.users WHERE id = $1', [userId]);

    const user = rows[0];

    if (!user) throw new ApiError('not_found', '계정을 찾을 수 없습니다.');

    const consents = await context.pool.query<{
      item: string;
      terms_version: string;
      granted_at: Date;
    }>(
      'SELECT item, terms_version, granted_at FROM structured.active_consents WHERE user_id = $1',
      [userId]
    );

    const granted = consents.rows.map((row) => ({ item: row.item, version: row.terms_version }));

    return {
      activated: user.activated_at !== null,
      ageVerified: user.age_verified,
      minimumAge: MINIMUM_AGE,
      items: CONSENT_ITEMS.map((item) => {
        const match = consents.rows.find(
          (row) => row.item === item.key && row.terms_version === item.version
        );

        return {
          item: item.key,
          label: item.label,
          required: item.required,
          version: item.version,
          grantedAt: match?.granted_at.toISOString() ?? null,
        };
      }),
      missingRequired: missingRequiredConsents(granted),
    };
  }

  app.get('/v1/me/signup', auth, async (request) => await loadState(currentUserId(request)));

  app.post('/v1/me/signup', auth, async (request) => {
    const userId = currentUserId(request);
    const body = completeSignupRequestSchema.parse(request.body);

    const client = await context.pool.connect();

    try {
      await client.query('BEGIN');

      /*
       * 체크하지 않고 왔으면 계정을 만들지 않는다. 로그인 화면이 이미 막지만
       * (버튼이 비활성이거나 WP-AUTH-010으로 보낸다), 여기서도 한 번 더
       * 막는다 — 화면을 거치지 않고 이 요청만 직접 부르는 경로를 남기지 않는다.
       * `age_gate`·`age_checked_at`(0046)도 함께 채운다 — 그 위의 제약
       * (`activated_only_when_old_enough`)이 여전히 그 컬럼을 본다.
       */
      if (!body.ageVerified) {
        await client.query('ROLLBACK');

        // 세션도 끊는다. 확인하지 않은 계정이 토큰을 들고 돌아다닐 이유가 없다.
        await context.pool.query(
          'UPDATE identity.sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
          [userId]
        );

        throw new ApiError('forbidden', AGE_BLOCKED_NOTICE);
      }

      await client.query(
        `UPDATE structured.users
         SET age_verified = true, age_verified_at = now(),
             age_gate = 'passed', age_checked_at = now()
         WHERE id = $1`,
        [userId]
      );

      /*
       * 받은 항목만 적는다. 선택 항목을 대신 켜주지 않는다(§N-2) — 켜주면 그
       * 동의는 사용자가 한 것이 아니다.
       */
      for (const item of new Set(body.consents as ConsentItem[])) {
        const definition = CONSENT_ITEMS.find((candidate) => candidate.key === item);

        if (!definition) continue;

        await client.query(
          `INSERT INTO structured.user_consents (user_id, item, terms_version, is_required)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [userId, item, definition.version, definition.required]
        );
      }

      const granted = REQUIRED_CONSENTS.filter((item) =>
        (body.consents as ConsentItem[]).includes(item)
      ).map((item) => ({ item, version: consentVersion(item) }));

      const check = canActivate({ ageVerified: true, granted });

      if (!check.ok) {
        /* 필수 동의가 빠졌다. 받은 동의는 그대로 두고 활성화만 하지 않는다. */
        await client.query('COMMIT');

        throw new ApiError('invalid_request', check.reason);
      }

      await client.query(
        'UPDATE structured.users SET activated_at = coalesce(activated_at, now()) WHERE id = $1',
        [userId]
      );

      await client.query('COMMIT');
    } catch (error) {
      if (error instanceof ApiError) throw error;

      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return await loadState(userId);
  });
}

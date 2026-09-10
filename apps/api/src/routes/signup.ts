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
 * 만 14세 확인은 **로그인 때 끝난다** — 카카오 연령대의 아래끝으로 본다
 * (`auth/age-range.ts`). 생년월일을 받지 않으므로 여기서도 날짜를 세지 않고,
 * 그때 적어둔 `structured.users.age_verified`가 확인의 전부다.
 *
 * **요청 본문의 `ageVerified`는 보지 않는다.** 앱은 그 자리에 늘 `true`를 넣고
 * (v3.24가 체크박스를 없앤 뒤로 넣을 다른 값이 없다), 이 요청만 직접 부르는
 * 쪽은 무엇이든 넣을 수 있다. 클라이언트가 말한 것이 아니라 서버가 확인한 것을
 * 본다.
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
       * 나이 확인이 끝나지 않았으면 계정을 살리지 않는다.
       *
       * **보는 것은 서버가 적어둔 값이다.** 예전에는 요청 본문의 `ageVerified`를
       * 봤는데, 그건 클라이언트가 보내는 값이고 앱은 그 자리에 늘 `true`를
       * 넣는다(`setup.tsx` — v3.24가 체크박스를 없앤 뒤로 넣을 다른 값이 없다).
       * 즉 이 관문은 **아무도 막지 못하는 상태**였다. 지금은 로그인 때 카카오
       * 연령대로 확인하고 `markAgeVerified`가 적어둔 `age_verified`를 본다 —
       * 클라이언트가 무엇을 보내든 바뀌지 않는다.
       *
       * `age_gate`·`age_checked_at`(0046)도 함께 채운다 — 그 위의 제약
       * (`activated_only_when_old_enough`)이 여전히 그 컬럼을 본다.
       */
      const verified = await client.query<{ age_verified: boolean }>(
        'SELECT age_verified FROM structured.users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (!verified.rows[0]?.age_verified) {
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
         SET age_verified_at = COALESCE(age_verified_at, now()),
             age_gate = 'passed', age_checked_at = COALESCE(age_checked_at, now())
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

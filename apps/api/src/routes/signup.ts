import { completeSignupRequestSchema, type SignupState } from '@weddingpick/api-contract';
import {
  AGE_BLOCKED_NOTICE,
  CONSENT_ITEMS,
  MINIMUM_AGE,
  REQUIRED_CONSENTS,
  canActivate,
  consentVersion,
  isOldEnough,
  missingRequiredConsents,
  type AgeGateResult,
  type ConsentItem,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireSignup } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError } from '../errors';

/**
 * 가입 완료. 통합정책 v3.13 §N.
 *
 * 여기만 `requireSignup`을 단다 — 아직 활성화되지 않은 계정이 부를 수 있는 유일한
 * 자리다. 다른 모든 경로는 `requireUser`가 막는다.
 *
 * **생년월일은 세어보고 버린다.** 정책 §N-3이 남기라고 한 것은 약관 판·항목·
 * 필수 여부·동의 일시뿐이다. 나이를 알기 위해 받은 값을 남겨두면, 그때부터
 * 우리는 필요 없는 개인정보를 들고 있는 서비스가 된다.
 */
export function registerSignupRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireSignup(context) };

  async function loadState(userId: string): Promise<SignupState> {
    const { rows } = await context.pool.query<{
      age_gate: AgeGateResult;
      activated_at: Date | null;
    }>('SELECT age_gate, activated_at FROM structured.users WHERE id = $1', [userId]);

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
      ageGate: user.age_gate,
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
    const oldEnough = isOldEnough(body.birthDate, new Date());

    const client = await context.pool.connect();

    try {
      await client.query('BEGIN');

      /*
       * 판정을 먼저 적는다. 막힌 계정은 되돌리지 않는다 — 생년월일을 몇 번이고
       * 다시 넣어보며 통과할 때까지 시도하는 문을 열어두지 않는다.
       *
       * 그래서 이 요청이 통과했는지가 아니라 **적히고 난 결과**를 보고 갈라진다.
       * 요청만 보면, 한 번 막힌 계정이 옳은 날짜를 들고 다시 오면 통과한다.
       */
      const updated = await client.query<{ age_gate: AgeGateResult }>(
        `UPDATE structured.users
         SET age_gate = CASE WHEN age_gate = 'blocked' THEN 'blocked'
                             WHEN $2 THEN 'passed'
                             ELSE 'blocked' END::age_gate_result,
             age_checked_at = now()
         WHERE id = $1
         RETURNING age_gate`,
        [userId, oldEnough]
      );

      const ageGate = updated.rows[0]?.age_gate ?? 'blocked';

      if (ageGate !== 'passed') {
        await client.query('COMMIT');

        // 세션도 끊는다. 막힌 계정이 토큰을 들고 돌아다닐 이유가 없다.
        await context.pool.query(
          'UPDATE identity.sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
          [userId]
        );

        throw new ApiError('forbidden', AGE_BLOCKED_NOTICE);
      }

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

      const check = canActivate({ ageGate, granted });

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

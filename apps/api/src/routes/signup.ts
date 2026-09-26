import {
  LEGACY_SIGNUP_ITEMS,
  completeSignupRequestSchema,
  type SignupState,
} from '@weddingpick/api-contract';
import {
  ACTIVATION_CONSENTS,
  AGE_UNVERIFIED_NOTICE,
  CONSENT_ITEMS,
  MINIMUM_AGE,
  canActivate,
  consentVersion,
  missingRequiredConsents,
  type ConsentItem,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireSignup } from '../auth/plugin';
import type { AppContext } from '../context';
import { publishedVersionIds } from '../legal-version';
import { ApiError } from '../errors';

/**
 * 가입 완료. 통합정책 v3.13 §3.5.
 *
 * 여기만 `requireSignup`을 단다 — 아직 활성화되지 않은 계정이 부를 수 있는 유일한
 * 자리다. 다른 모든 경로는 `requireUser`가 막는다.
 *
 * **만 14세 확인은 여기서 하지 않는다.** 로그인(`POST /v1/auth/sessions`)이 이미
 * 했고, 그 결과가 DB의 `age_verified`에 있다. 이 라우트는 그 값을 **읽어서 관문을
 * 지킬 뿐** 새로 켜지 않는다.
 *
 * 예전에는 `body.ageVerified`를 봤는데, 앱은 그 자리에 늘 `true`를 넣었다
 * (`apps/mobile/src/app/setup.tsx`). 즉 그 관문은 아무도 막지 못했다 —
 * 자기 신고를 관문으로 쓰면 관문이 아니라 통과 버튼이다(2026-09-10).
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
    const missing = missingRequiredConsents(granted);

    const agreements = CONSENT_ITEMS.map((item) => {
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
    });

    return {
      activated: user.activated_at !== null,
      ageVerified: user.age_verified,
      minimumAge: MINIMUM_AGE,
      /* 옛 앱이 아는 셋만 — 새 항목이 섞이면 옛 앱이 응답을 거절한다(api-contract signup.ts). */
      items: agreements.filter((item) =>
        (LEGACY_SIGNUP_ITEMS as readonly string[]).includes(item.item)
      ),
      agreements,
      /* 옛 앱이 아는 항목만 — 새 항목이 섞이면 옛 앱이 응답 전체를 거절한다(api-contract signup.ts). */
      missingRequired: missing.filter((item) => (LEGACY_SIGNUP_ITEMS as readonly string[]).includes(item)),
      missingAgreements: missing,
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
       * **서버가 확인한 값만 본다.** 요청 본문이 아니라 DB다 — 본문의
       * `ageVerified`는 앱이 늘 `true`로 채우던 자리라 관문 노릇을 못 했다.
       *
       * `FOR UPDATE`로 잠근다. 아래에서 같은 행의 `activated_at`을 올리므로,
       * 판정과 활성화 사이에 다른 요청이 그 행을 바꾸는 자리를 남기지 않는다.
       */
      const { rows } = await client.query<{ age_verified: boolean }>(
        'SELECT age_verified FROM structured.users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      const ageVerified = rows[0]?.age_verified ?? false;

      if (!ageVerified) {
        await client.query('ROLLBACK');

        // 세션도 끊는다. 확인하지 않은 계정이 토큰을 들고 돌아다닐 이유가 없다.
        await context.pool.query(
          'UPDATE identity.sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
          [userId]
        );

        /*
         * 미달로 확인된 것이 아니라 확인 자체가 없는 상태다. 여기까지 온 계정은
         * 로그인이 관문을 지키기 전에 만들어진 것뿐이다 — 다시 로그인하면
         * 로그인이 판정한다.
         */
        throw new ApiError('age_unverified', AGE_UNVERIFIED_NOTICE);
      }

      /*
       * 옛 칸(`age_gate`·`age_checked_at`, 0046)을 맞춰둔다. 확인 자체는 로그인이
       * 이미 적었고 여기서 다시 켜지 않는다 — `COALESCE`로 처음 확인한 시점을
       * 지키는 이유가 그것이다. 그래도 이 줄을 두는 것은 그 위의 제약
       * (`activated_only_when_old_enough`)이 아래 활성화 직전에 `age_gate`를 보기
       * 때문이다. 지금 도달할 수 있는 상태에서는 로그인이 이미 'passed'로 만들어
       * 두지만, 옛 칸을 보는 제약이 남아 있는 한 활성화 직전에 한 번 맞추는 편이
       * 안전하다.
       */
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
       *
       * v3.29 약관 동의 여덟 칸이 전부 여기로 온다(2026-09-26 대표 감사 8). 항목마다
       * 판(`terms_version`) · 필수 여부 · 공개된 글(`terms_version_id`)이 한 줄씩 남는다.
       * 필수 다섯 중 하나라도 빠지면 아래 `canActivate`가 거절한다(2026-09-26 대표 결정
       * 「강제한다」). 받은 동의는 그래도 남긴다 — 사용자가 한 동의다.
       */
      /*
       * **한 번에 적는다**(2026-09-26 대표 지시 — 약관 동의 → 온보딩 대기 감축). 전에는 항목마다
       * «공개된 판» 조회 + INSERT를 차례로 해 여덟 항목에 왕복 열네 번이었다. 앱은 이 응답을
       * 받아야 온보딩으로 넘어가므로 그 왕복이 그대로 화면 대기였다. 뜻은 같다 — 항목마다
       * 판 · 필수 여부 · 가리키는 공개 판이 한 줄씩 남고, 이미 있는 줄은 그대로 둔다.
       */
      const definitions = [...new Set(body.consents as ConsentItem[])]
        .map((item) => CONSENT_ITEMS.find((candidate) => candidate.key === item))
        .filter((definition): definition is (typeof CONSENT_ITEMS)[number] => definition !== undefined);

      if (definitions.length > 0) {
        const versionIds = await publishedVersionIds(client, definitions.map((definition) => definition.key));

        await client.query(
          `INSERT INTO structured.user_consents
             (user_id, item, terms_version, is_required, terms_version_id)
           SELECT $1, rows.item, rows.terms_version, rows.is_required, rows.terms_version_id
           FROM unnest($2::text[], $3::text[], $4::boolean[], $5::uuid[])
             AS rows(item, terms_version, is_required, terms_version_id)
           ON CONFLICT DO NOTHING`,
          [
            userId,
            definitions.map((definition) => definition.key),
            definitions.map((definition) => definition.version),
            definitions.map((definition) => definition.required),
            definitions.map((definition) => versionIds.get(definition.key) ?? null),
          ]
        );
      }

      const granted = ACTIVATION_CONSENTS.filter((item) =>
        (body.consents as ConsentItem[]).includes(item)
      ).map((item) => ({ item, version: consentVersion(item) }));

      const check = canActivate({ ageVerified, granted });

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

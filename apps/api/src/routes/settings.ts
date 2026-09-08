import { updateSettingsRequestSchema } from '@weddingpick/api-contract';
import { PAYMENT_CONSENT_VERSION } from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError } from '../errors';

type SettingsRow = {
  push_enabled: boolean;
  price_change_enabled: boolean;
  consent_at: Date | null;
  wedding_date: Date | null;
  region: string | null;
  display_name: string | null;
  spouse_linked: boolean;
};

/**
 * 설정. 디자인 핸드오프 19번.
 *
 * **행이 없으면 켜진 것으로 본다.** 로그인한 모든 사람에게 미리 설정 행을 만들지
 * 않기 위해서다 — 만들어두면 회원 수만큼 쓸모없는 행이 쌓이고, 기본값을 바꾸려면
 * 그 행들을 전부 손봐야 한다.
 */
export function registerSettingsRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  async function load(userId: string) {
    const { rows } = await context.pool.query<SettingsRow>(
      `SELECT
         coalesce(s.push_enabled, true) AS push_enabled,
         coalesce(s.price_change_enabled, true) AS price_change_enabled,
         c.granted_at AS consent_at,
         w.wedding_date,
         w.region,
         u.display_name,
         coalesce(w.owner_user_id IS NOT NULL AND w.partner_user_id IS NOT NULL, false)
           AS spouse_linked
       FROM structured.users u
       LEFT JOIN structured.notification_settings s ON s.user_id = u.id
       LEFT JOIN structured.active_payment_consents c ON c.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT wedding_date, region, owner_user_id, partner_user_id
         FROM structured.weddings
         WHERE owner_user_id = u.id OR partner_user_id = u.id
         ORDER BY created_at LIMIT 1
       ) w ON true
       WHERE u.id = $1`,
      [userId]
    );

    const row = rows[0];

    return {
      userId,
      pushEnabled: row?.push_enabled ?? true,
      priceChangeEnabled: row?.price_change_enabled ?? true,
      paymentConsent: row?.consent_at != null,
      paymentConsentAt: row?.consent_at?.toISOString() ?? null,
      weddingDate: row?.wedding_date ? row.wedding_date.toISOString().slice(0, 10) : null,
      region: row?.region ?? null,
      spouseLinked: row?.spouse_linked ?? false,
      displayName: row?.display_name ?? null,
    };
  }

  app.get('/v1/me/settings', auth, async (request) => await load(currentUserId(request)));

  app.put('/v1/me/settings', auth, async (request) => {
    const userId = currentUserId(request);
    const body = updateSettingsRequestSchema.parse(request.body);

    /*
     * 보낸 값만 바꾼다. 스위치 하나를 눌렀는데 다른 하나가 기본값으로 되돌아가면
     * 사용자는 자기가 무엇을 눌렀는지 믿을 수 없게 된다.
     */
    await context.pool.query(
      `INSERT INTO structured.notification_settings (user_id, push_enabled, price_change_enabled)
       VALUES ($1, coalesce($2, true), coalesce($3, true))
       ON CONFLICT (user_id) DO UPDATE
         SET push_enabled = coalesce($2, structured.notification_settings.push_enabled),
             price_change_enabled =
               coalesce($3, structured.notification_settings.price_change_enabled),
             updated_at = now()`,
      [userId, body.pushEnabled ?? null, body.priceChangeEnabled ?? null]
    );

    return await load(userId);
  });

  /**
   * 결제인증 동의. 핸드오프 10번 — **최초 1회만.**
   *
   * 두 번 눌러도 한 번만 남는다. 부분 유니크 색인이 그걸 지키므로 여기서는
   * 조용히 지나간다 — 이미 동의한 사람에게 오류를 띄울 이유가 없다.
   */
  app.post('/v1/me/payment-consent', auth, async (request) => {
    const userId = currentUserId(request);

    await context.pool.query(
      `INSERT INTO structured.payment_consents (user_id, consent_version)
       VALUES ($1, $2)
       ON CONFLICT (user_id) WHERE revoked_at IS NULL DO NOTHING`,
      [userId, PAYMENT_CONSENT_VERSION]
    );

    return await load(userId);
  });

  /**
   * 철회. 핸드오프 19번.
   *
   * 지우지 않고 철회 시각을 적는다 — 언제 동의했고 언제 철회했는지는 나중에
   * 물어볼 수 있는 질문이고, 덮어쓰면 답할 수 없다.
   *
   * **이미 낸 자료를 여기서 지우지 않는다.** 그건 다른 일이고(내 제보 내역에서
   * 지운다), 철회 한 번으로 남의 통계에서 조용히 빠지면 그건 철회가 아니라
   * 되돌리기다.
   */
  app.delete('/v1/me/payment-consent', auth, async (request) => {
    const userId = currentUserId(request);

    const { rowCount } = await context.pool.query(
      `UPDATE structured.payment_consents SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );

    if (rowCount === 0) {
      throw new ApiError('conflict', '아직 동의하지 않으셨습니다.');
    }

    return await load(userId);
  });
}

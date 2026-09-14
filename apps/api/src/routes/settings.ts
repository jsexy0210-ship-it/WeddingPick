import { updateSettingsRequestSchema } from '@weddingpick/api-contract';
import {
  DOCUMENT_CONSENT_VERSION,
  MARKETING_CONSENT_ITEM,
  PAYMENT_CONSENT_VERSION,
  consentVersion,
  isRequiredConsent,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError } from '../errors';

type SettingsRow = {
  push_enabled: boolean;
  price_change_enabled: boolean;
  night_push_enabled: boolean;
  marketing_consent_at: Date | null;
  consent_at: Date | null;
  document_consent_at: Date | null;
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
         coalesce(s.night_push_enabled, false) AS night_push_enabled,
         m.granted_at AS marketing_consent_at,
         c.granted_at AS consent_at,
         d.granted_at AS document_consent_at,
         w.wedding_date,
         w.region,
         u.display_name,
         coalesce(w.owner_user_id IS NOT NULL AND w.partner_user_id IS NOT NULL, false)
           AS spouse_linked
       FROM structured.users u
       LEFT JOIN structured.notification_settings s ON s.user_id = u.id
       LEFT JOIN structured.active_payment_consents c ON c.user_id = u.id
       LEFT JOIN structured.active_document_consents d ON d.user_id = u.id
       LEFT JOIN LATERAL (
         /*
          * 마케팅 알림 스위치의 원본. 불리언 한 칸이 아니라 동의 이력을 본다 —
          * 법적 동의 항목이라 켠 시각과 끈 시각에 답할 수 있어야 한다.
          *
          * 판(terms_version)이 바뀌면 같은 항목의 동의가 여러 줄이 될 수 있어
          * 가장 최근 것을 고른다. 철회한 줄은 뷰에 없다.
          */
         SELECT granted_at
         FROM structured.active_consents
         WHERE user_id = u.id AND item = $2
         ORDER BY granted_at DESC
         LIMIT 1
       ) m ON true
       LEFT JOIN LATERAL (
         SELECT wedding_date, region, owner_user_id, partner_user_id
         FROM structured.weddings
         WHERE owner_user_id = u.id OR partner_user_id = u.id
         ORDER BY created_at LIMIT 1
       ) w ON true
       WHERE u.id = $1`,
      [userId, MARKETING_CONSENT_ITEM]
    );

    const row = rows[0];

    return {
      userId,
      pushEnabled: row?.push_enabled ?? true,
      priceChangeEnabled: row?.price_change_enabled ?? true,
      /* 다른 스위치와 달리 기본이 꺼짐이다. 시안 13-my-sub WP-MY-007. */
      nightPushEnabled: row?.night_push_enabled ?? false,
      marketingEnabled: row?.marketing_consent_at != null,
      marketingConsentAt: row?.marketing_consent_at?.toISOString() ?? null,
      paymentConsent: row?.consent_at != null,
      paymentConsentAt: row?.consent_at?.toISOString() ?? null,
      documentConsent: row?.document_consent_at != null,
      documentConsentAt: row?.document_consent_at?.toISOString() ?? null,
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
      `INSERT INTO structured.notification_settings
         (user_id, push_enabled, price_change_enabled, night_push_enabled)
       VALUES ($1, coalesce($2, true), coalesce($3, true), coalesce($4, false))
       ON CONFLICT (user_id) DO UPDATE
         SET push_enabled = coalesce($2, structured.notification_settings.push_enabled),
             price_change_enabled =
               coalesce($3, structured.notification_settings.price_change_enabled),
             night_push_enabled =
               coalesce($4, structured.notification_settings.night_push_enabled),
             updated_at = now()`,
      [
        userId,
        body.pushEnabled ?? null,
        body.priceChangeEnabled ?? null,
        body.nightPushEnabled ?? null,
      ]
    );

    /*
     * 마케팅 알림은 동의 이력에 적는다. 나머지 스위치와 저장하는 자리가 다르다 —
     * 법적 동의 항목이라 **켠 시각과 끈 시각이 남아야** 하고, 불리언 한 칸은
     * 마지막 상태만 남기고 그 답을 지운다.
     *
     * 가입 때 쓰는 표(`user_consents`, 0046)를 그대로 쓴다. 알림 설정용 표를 따로
     * 만들면 같은 동의가 두 곳에 생기고, 둘이 어긋나면 어느 쪽이 «동의했다»인지
     * 답할 수 없다.
     */
    if (body.marketingEnabled != null) {
      await (body.marketingEnabled
        ? context.pool.query(
            `INSERT INTO structured.user_consents (user_id, item, terms_version, is_required)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [
              userId,
              MARKETING_CONSENT_ITEM,
              consentVersion(MARKETING_CONSENT_ITEM),
              isRequiredConsent(MARKETING_CONSENT_ITEM),
            ]
          )
        : /* 지우지 않고 철회 시각을 적는다. 판이 여럿이면 살아 있는 것을 모두 내린다. */
          context.pool.query(
            `UPDATE structured.user_consents SET withdrawn_at = now()
             WHERE user_id = $1 AND item = $2 AND withdrawn_at IS NULL`,
            [userId, MARKETING_CONSENT_ITEM]
          ));
    }

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
  /**
   * 견적서 업로드 동의. 결제인증과 같은 모양이다 — **최초 1회만.**
   *
   * 따로 받는 이유는 읽어가는 것도 쓰는 곳도 다르기 때문이다. 하나로 묶으면
   * Pick 인증만 하고 싶은 사람이 견적서 전송까지 동의하게 된다.
   */
  app.post('/v1/me/document-consent', auth, async (request) => {
    const userId = currentUserId(request);

    await context.pool.query(
      `INSERT INTO structured.document_consents (user_id, consent_version)
       VALUES ($1, $2)
       ON CONFLICT (user_id) WHERE revoked_at IS NULL DO NOTHING`,
      [userId, DOCUMENT_CONSENT_VERSION]
    );

    return await load(userId);
  });

  /** 견적서 동의 철회. 결제인증 철회와 같다 — 지우지 않고 철회 시각을 적는다. */
  app.delete('/v1/me/document-consent', auth, async (request) => {
    const userId = currentUserId(request);

    const { rowCount } = await context.pool.query(
      `UPDATE structured.document_consents SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );

    if (rowCount === 0) {
      throw new ApiError('conflict', '아직 동의하지 않으셨습니다.');
    }

    return await load(userId);
  });

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

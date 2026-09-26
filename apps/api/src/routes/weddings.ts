import {
  completeSetupRequestSchema,
  createWeddingRequestSchema,
  displayNameRequestSchema,
} from '@weddingpick/api-contract';
import {
  MEMBER_TIER_LABEL,
  PREPARATION_CATEGORIES,
  PREPARATION_GROUPS,
  WEDDING_DATE_HINT,
  allMissionsDone,
  budgetBracketCeiling,
  canAddCandidate,
  checkDisplayName,
  isSelectableWeddingDate,
  manualDecisionCategory,
  tierOf,
  type MembershipFacts,
  type PreparationGroupKey,
  type VendorCategory,
  type WeddingBudgetBracket,
  isWeddingStyle,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';

import { assertWeddingAccess } from '../access';
import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { withTransaction } from '../db';
import { ApiError, notFound } from '../errors';

type WeddingRow = {
  id: string;
  wedding_date: Date | null;
  owner_user_id: string;
  partner_user_id: string | null;
  prepared_categories: VendorCategory[];
  created_at: Date;
  partner_joined_at: Date | null;
};

async function loadDetail(context: AppContext, weddingId: string, viewerId: string) {
  const { rows } = await context.pool.query<WeddingRow>(
    /* enum 배열은 드라이버가 문자열 '{a,b}'로 준다 — text[]로 바꿔 읽는다. */
    `SELECT id, wedding_date, owner_user_id, partner_user_id, prepared_categories::text[] AS prepared_categories,
            created_at, partner_joined_at
     FROM structured.weddings WHERE id = $1`,
    [weddingId]
  );

  const row = rows[0];

  if (!row) {
    throw notFound('웨딩');
  }

  /*
   * 배우자의 개인정보는 내려보내지 않는다. 이용약관 제5조.
   *
   * 누가 누구인지는 이름이 아니라 isMe로 구분한다 — 상대의 이름을 보여주려면 그 사람의
   * 개인정보를 꺼내야 한다.
   */
  const members: { role: 'owner' | 'partner'; joinedAt: string; isMe: boolean }[] = [
    {
      role: 'owner',
      joinedAt: row.created_at.toISOString(),
      isMe: row.owner_user_id === viewerId,
    },
  ];

  if (row.partner_user_id) {
    members.push({
      role: 'partner',
      joinedAt: (row.partner_joined_at ?? row.created_at).toISOString(),
      isMe: row.partner_user_id === viewerId,
    });
  }

  return {
    id: row.id,
    weddingDate: row.wedding_date ? row.wedding_date.toISOString().slice(0, 10) : null,
    partnerLinked: row.partner_user_id !== null,
    preparedCategories: row.prepared_categories,
    createdAt: row.created_at.toISOString(),
    members,
  };
}

/**
 * 지금 로그인한 사람의 상태 한 벌.
 *
 * `/v1/me`와 `/v1/me/setup`이 **같은 함수를 쓴다**. 계약이 두 경로에 같은 모양을
 * 적어둔 이상, 만드는 곳도 하나여야 한다 — 따로 적으면 한쪽이 필드를 빠뜨려도
 * 서버는 조용하고, 앱이 응답을 검증하다 처음 깨진다.
 */
async function loadCurrentUser(context: AppContext, userId: string) {
  const { rows } = await context.pool.query<{
    id: string | null;
    wedding_date: Date | null;
    region: string | null;
    prepared_categories: VendorCategory[] | null;
    setup_completed_at: Date | null;
    budget_amount: string | null;
    budget_bracket: WeddingBudgetBracket | null;
    display_name: string | null;
    partner_display_name: string | null;
    spouse_linked: boolean;
    has_payment_proof: boolean;
    has_pick: boolean;
    has_compared: boolean;
    style_tags: string[] | null;
  }>(
    `SELECT
       w.id,
       w.wedding_date,
       w.region,
       w.style_tags::text[] AS style_tags,
       /* enum 배열은 드라이버가 문자열 '{a,b}'로 준다 — text[]로 바꿔 읽는다. */
       w.prepared_categories::text[] AS prepared_categories,
       w.setup_completed_at,
       w.budget_amount,
       w.budget_bracket,
       u.display_name,
       /*
        * 배우자의 «부를 이름». 원본 문서·개인정보는 연결해도 공유하지 않지만(약관
        * 제5조) 부를 이름은 서로 부르라고 정한 값이다 — 웨딩일정 홈이
        * «지영님과 준호님이 함께 준비하고 있어요»라고 적는다(v3.16).
        */
       (SELECT p.display_name FROM structured.users p
         WHERE p.id = CASE WHEN w.owner_user_id = u.id THEN w.partner_user_id ELSE w.owner_user_id END)
         AS partner_display_name,
       coalesce(w.owner_user_id IS NOT NULL AND w.partner_user_id IS NOT NULL, false)
         AS spouse_linked,
       EXISTS (
         SELECT 1 FROM structured.usable_payment_proofs p WHERE p.reporter_user_id = u.id
       ) AS has_payment_proof,
       EXISTS (
         SELECT 1 FROM structured.vendor_candidates c WHERE c.wedding_id = w.id
       ) AS has_pick,
       /* 비교할 수 있는 상태가 아니라 실제로 비교한 사실이다(0044). */
       EXISTS (
         SELECT 1 FROM structured.comparisons x WHERE x.wedding_id = w.id
       ) AS has_compared
     FROM structured.users u
     LEFT JOIN LATERAL (
       SELECT id, wedding_date, region, prepared_categories, style_tags, setup_completed_at,
              budget_amount, budget_bracket, owner_user_id, partner_user_id
       FROM structured.weddings
       WHERE owner_user_id = u.id OR partner_user_id = u.id
       ORDER BY created_at LIMIT 1
     ) w ON true
     WHERE u.id = $1`,
    [userId]
  );

  const row = rows[0];
  const weddingDate = row?.wedding_date ? row.wedding_date.toISOString().slice(0, 10) : null;
  const displayName = row?.display_name ?? null;
  const region = row?.region ?? null;
  /*
   * bigint는 드라이버가 문자열로 준다. 결혼 예산은 자바스크립트 정수 한계보다
   * 한참 작아서 수로 바꿔도 값이 흐려지지 않는다 — 계약도 수로 적혀 있다.
   */
  const budgetAmount =
    row?.budget_amount === null || row?.budget_amount === undefined
      ? null
      : Number(row.budget_amount);
  const budgetBracket = row?.budget_bracket ?? null;
  const preparedCategories = row?.prepared_categories ?? [];

  const facts = {
    // 이 함수를 부르는 두 경로가 모두 로그인을 요구한다. 여기까지 왔으면 로그인한 사람이다.
    loggedIn: true,
    spouseLinked: row?.spouse_linked ?? false,
    hasPaymentProof: row?.has_payment_proof ?? false,
    /*
     * 설정을 마쳤는가는 setup_completed_at(0088)으로 판단한다. v3.19부터 예식일 ·
     * 지역 · 준비 현황 · 예산이 전부 «미정»일 수 있어(취향만 필수) 값의 유무로는
     * 알 수 없다 — 값을 조건에 넣으면 미정인 사람이 온보딩에 영영 붙잡힌다.
     * auth/sessions.ts · routes/rewards.ts도 같은 컬럼을 본다.
     */
    weddingSet: (row?.setup_completed_at ?? null) !== null,
    hasPick: row?.has_pick ?? false,
    hasCompared: row?.has_compared ?? false,
  };

  const tier = tierOf(facts);

  return {
    userId,
    weddingId: row?.id ?? null,
    displayName,
    weddingDate,
    region,
    preparedCategories,
    budgetBracket,
    budgetAmount,
    /*
     * 앱이 이 값 하나로 첫 화면을 정한다. 값들을 따로 보고 판단하게 두면
     * 어느 화면은 날짜만 보고 어느 화면은 지역만 보게 된다.
     *
     * **이름은 여기 들어가지 않는다.** v3.10 §3이 닉네임을 최초 필수입력에서
     * 뺐다 — 이름이 없다고 첫 화면에 다시 붙잡아두면 그게 강제 가입이다.
     */
    setupComplete: facts.weddingSet,
    styleTags: (row?.style_tags ?? []).filter(isWeddingStyle),
    spouseLinked: facts.spouseLinked,
    partnerDisplayName: facts.spouseLinked ? (row?.partner_display_name ?? null) : null,
    hasPaymentProof: facts.hasPaymentProof,
    hasPick: facts.hasPick,
    hasCompared: facts.hasCompared,
    /*
     * 등급은 서버가 정한다. 앱이 세 값으로 계산하게 두면 화면마다 조건을 다시
     * 적게 되고, 언젠가 한 곳이 어긋나 같은 사람이 화면에 따라 다른 등급으로 보인다.
     */
    tier,
    tierLabel: MEMBER_TIER_LABEL[tier],
  };
}

/**
 * 준비 현황(3/5)에서 고른 곳을 Pick에 담고 그 업종의 **결정**으로 남긴다.
 *
 * - 2026-09-26 대표 지시 「3/5에서 업체를 선택했다면 Pick 담은 곳에도 들어가야 한다」 —
 *   목록에서 고른 업체는 `vendor_candidates`에 담는다.
 * - 같은 날 두 번째 지시 「결정으로 넣는다」 — 그 업체를 업체의 업종 결정
 *   (`category_decisions`)으로도 남긴다. 결정은 Pick한 곳이어야 하므로(0041
 *   `decision_is_a_pick`) 담기가 먼저다.
 * - 같은 날 「직접입력하는 방법 고안하라」 — 우리 목록에 없어 이름을 적은 곳은 업체가 없어
 *   담기 없이 결정만 남긴다(0440 `manual_name`). 카드가 업종 여럿을 덮으므로 묶음의 첫
 *   업종에 한 번만 적는다(`manualDecisionCategory`).
 *
 * **설정 저장과 같은 트랜잭션이다.** 앱이 저장 뒤에 담기 · 결정을 따로 부르면 둘 사이에서
 * 끊겼을 때 «설정은 끝났는데 Pick은 비어 있는» 상태가 남고, 온보딩은 다시 열리지 않으니
 * 사용자가 되돌릴 길이 없다. 새 계정은 이 요청이 웨딩을 만들기 전까지 웨딩 id도 없다.
 * 그래서 여기서 한 번에 하고, 하나라도 못 하면 설정까지 통째로 되돌린다.
 *
 * - **다시 보내도 겹치지 않는다** — 담기는 `(wedding_id, vendor_id)`, 결정은
 *   `(wedding_id, category)` 유일 제약에 `DO NOTHING`.
 * - **이미 있는 결정은 덮지 않는다.** 배우자가 먼저 정한 업종이면 그 결정이 남고, 고른
 *   업체는 후보로만 담긴다. 담은 사람도 바꾸지 않는다.
 * - 업종은 업체가 정한다. 준비 순서 밖(«기타» · 더는 고르지 않는 업종)은 받지 않는다 —
 *   Pick 묶음(웨딩홀 · 스드메 · 본식 · 예물 · 신혼)에 들어갈 자리가 없다.
 * - 같은 요청에 준비 현황(`preparedCategories`)을 보냈으면 고른 곳의 업종이 그 안에 있어야
 *   한다. 골랐는데 그 카드가 «결정 완료»가 아니면 홈과 Pick이 서로 다른 말을 한다.
 * - 카드 하나(묶음 하나)에 한 곳 — 업체 둘, 업체와 직접 입력이 한 묶음에 오면 받지 않는다.
 * - 상한(30곳)은 담기 경로와 같은 말로 막는다. 트리거 예외는 사람이 읽을 말이 아니다.
 *   직접 입력은 후보가 아니라 상한에 들지 않는다.
 */
async function recordPreparedChoices(
  client: PoolClient,
  weddingId: string,
  userId: string,
  vendorIds: readonly string[],
  manual: readonly { group: PreparationGroupKey; name: string }[],
  /** 같은 요청의 준비 현황. 안 보냈으면 null — 그때는 업종이 준비 순서 안인지만 본다. */
  prepared: readonly VendorCategory[] | null
): Promise<void> {
  if (vendorIds.length === 0 && manual.length === 0) return;

  const vendors = await client.query<{ id: string; category: VendorCategory }>(
    `SELECT id, category::text AS category FROM structured.vendors WHERE id = ANY($1::uuid[])`,
    [vendorIds]
  );

  if (vendors.rows.length !== vendorIds.length) {
    throw notFound('업체');
  }

  if (vendors.rows.some((row) => !PREPARATION_CATEGORIES.includes(row.category))) {
    throw new ApiError('invalid_request', '준비 현황에 넣을 수 없는 업체예요.');
  }

  const manualRows = manual.map((one) => ({ ...one, category: manualDecisionCategory(one.group) }));
  const chosen = [
    ...vendors.rows.map((row) => row.category),
    ...manualRows.map((row) => row.category),
  ];

  if (prepared !== null && chosen.some((category) => !prepared.includes(category))) {
    throw new ApiError('invalid_request', '고른 업체의 업종이 준비 현황에 없어요.');
  }

  /* 카드 하나에 한 곳 — 묶음이 겹치면 어느 쪽이 그 카드의 결정인지 말할 수 없다. */
  const groupOf = (category: VendorCategory) =>
    PREPARATION_GROUPS.find((group) => group.categories.includes(category))?.key;
  const groups = chosen.map(groupOf);

  if (new Set(groups).size !== groups.length) {
    throw new ApiError('invalid_request', '준비 현황 카드 하나에는 한 곳만 고를 수 있어요.');
  }

  if (vendorIds.length > 0) {
    const counted = await client.query<{ total: string; fresh: string }>(
      `SELECT (SELECT count(*) FROM structured.vendor_candidates WHERE wedding_id = $1) AS total,
              (SELECT count(*) FROM unnest($2::uuid[]) AS picked(vendor_id)
                WHERE NOT EXISTS (
                  SELECT 1 FROM structured.vendor_candidates c
                  WHERE c.wedding_id = $1 AND c.vendor_id = picked.vendor_id)) AS fresh`,
      [weddingId, vendorIds]
    );
    const total = Number(counted.rows[0]!.total);
    const fresh = Number(counted.rows[0]!.fresh);

    /* 마지막 한 곳을 담기 직전의 수로 묻는다 — 담기 경로(`canAddCandidate`)와 같은 판정이다. */
    const check = canAddCandidate({ currentCount: total + fresh - 1 });

    if (fresh > 0 && !check.ok) {
      throw new ApiError('invalid_request', check.reason);
    }

    /*
     * 이미 담긴 곳은 아예 INSERT에 넣지 않는다. 상한 트리거(`enforce_candidate_limit`)는
     * BEFORE INSERT라 `ON CONFLICT DO NOTHING`으로 걸러질 행에도 먼저 돈다 — 29곳 담긴
     * 웨딩이 이미 담은 곳을 다시 보내도 막히게 된다. `ON CONFLICT`는 배우자와 동시에
     * 담는 경합만 받는다.
     */
    await client.query(
      `INSERT INTO structured.vendor_candidates (wedding_id, vendor_id, added_by)
       SELECT $1, picked.vendor_id, $3 FROM unnest($2::uuid[]) AS picked(vendor_id)
       WHERE NOT EXISTS (
         SELECT 1 FROM structured.vendor_candidates c
         WHERE c.wedding_id = $1 AND c.vendor_id = picked.vendor_id)
       ON CONFLICT (wedding_id, vendor_id) DO NOTHING`,
      [weddingId, vendorIds, userId]
    );
  }

  /*
   * 결정 — 업체는 업체의 업종에, 직접 입력은 묶음의 첫 업종에. 그 업종에 결정이 이미
   * 있으면(배우자가 먼저 정했거나 같은 요청을 다시 보냈거나) 그대로 둔다.
   */
  const decisions = [
    ...vendors.rows.map((row) => ({ category: row.category, vendorId: row.id, name: null })),
    ...manualRows.map((row) => ({ category: row.category, vendorId: null, name: row.name })),
  ];

  await client.query(
    `INSERT INTO structured.category_decisions (wedding_id, category, vendor_id, manual_name, decided_by)
     SELECT $1, d.category::vendor_category, d.vendor_id, d.manual_name, $5
     FROM unnest($2::text[], $3::uuid[], $4::text[]) AS d(category, vendor_id, manual_name)
     ON CONFLICT (wedding_id, category) DO NOTHING`,
    [
      weddingId,
      decisions.map((one) => one.category),
      decisions.map((one) => one.vendorId),
      decisions.map((one) => one.name),
      userId,
    ]
  );
}

export function registerWeddingRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get('/v1/me', auth, async (request) =>
    loadCurrentUser(context, currentUserId(request))
  );

  /**
   * 초기 설정 — 5개 질문(핸드오프 v3.19~v3.22 · SPEC §13.6). 1~4(예식일 · 지역 ·
   * 준비 현황 · 예산)를 한 번에 받는다. 5/5 취향은 `/v1/me/taste`다.
   *
   * 이름은 받지 않는다. v3.10이 닉네임을 최초 필수입력에서 뺐다. 부를 이름은
   * `/v1/me/display-name`으로 나중에 정한다.
   *
   * **미정을 억지로 받지 않는다.** 예식일 · 지역은 null(«아직 정하지 않았어요»),
   * 준비 현황은 빈 배열(«아직 시작 전이에요»), 예산은 `unknown`(«아직 모르겠어요»).
   * 그래서 «설정을 마쳤다»는 값의 유무가 아니라 setup_completed_at(0088)에 적는다.
   *
   * 예산과 준비 현황은 키를 안 보내면 **건드리지 않는다** — `아직 모르겠어요`를
   * 고른 것과 이 화면을 다시 열지 않은 것이 같은 결과가 되면 안 된다. 명시적인
   * null(예산) · 빈 배열(준비 현황)만 되돌린다.
   *
   * `budget_amount`는 여기서 직접 받지 않는다. 지출 화면의 «예산 대비»가 숫자
   * 하나를 쓰므로 구간의 상한값을 서버가 파생해서 채운다(budgetBracketCeiling).
   *
   * 웨딩이 없으면 여기서 만든다. "먼저 웨딩을 만드세요"라고 할 자리가 아니다 —
   * 사용자에게 웨딩은 만드는 것이 아니라 이미 있는 것이다.
   *
   * 준비 현황에서 업체까지 골랐으면(`preparedVendorIds`) 같은 트랜잭션에서 Pick에 담고
   * 결정으로 남긴다. 직접 입력한 곳(`preparedManualVendors`)은 결정만 남긴다
   * (`recordPreparedChoices`). 안 보내면 Pick도 결정도 그대로다.
   */
  app.post('/v1/me/setup', auth, async (request) => {
    const userId = currentUserId(request);
    const body = completeSetupRequestSchema.parse(request.body);

    // 결혼식은 미래다. 오늘과 과거는 고를 수 없다(핸드오프 3번). null은 «아직 정하지 않았어요»다.
    if (body.weddingDate !== null && !isSelectableWeddingDate(body.weddingDate)) {
      throw new ApiError('invalid_request', WEDDING_DATE_HINT);
    }

    const region = body.region === null ? null : body.region.trim();
    /* 구간을 아예 안 보냈는가. null을 보낸 것(`아직 모르겠어요`)과 구분해야 한다. */
    const bracketGiven = 'budgetBracket' in body;
    const bracket = body.budgetBracket ?? null;
    const budget = bracket === null ? null : budgetBracketCeiling(bracket);
    /* 준비 현황도 같다 — 안 보내면 그대로, 빈 배열은 «아직 시작 전이에요». 같은 업종을 두 번 보내도 한 번만 적는다. */
    const preparedGiven = body.preparedCategories !== undefined;
    const prepared = [...new Set(body.preparedCategories ?? [])];
    /* 스타일(5/5 · v3.22)도 같다 — 안 보내면 그대로. 최소 1 · 개수 제한 없음(2026-09-26)은 계약이 지킨다. */
    const stylesGiven = body.styleTags !== undefined;
    const styles = [...new Set(body.styleTags ?? [])];
    /* 준비 현황에서 고른 업체(2026-09-26). 같은 곳을 두 번 보내도 한 번만 담는다. */
    const preparedVendorIds = [...new Set(body.preparedVendorIds ?? [])];
    /* 준비 현황에서 직접 입력한 곳(2026-09-26). 계약이 앞뒤 공백을 뗐다. */
    const preparedManual = body.preparedManualVendors ?? [];

    await withTransaction(context.pool, async (client) => {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM structured.weddings
         WHERE owner_user_id = $1 OR partner_user_id = $1
         ORDER BY created_at LIMIT 1`,
        [userId]
      );

      let weddingId = existing.rows[0]?.id;

      if (weddingId) {
        await client.query(
          `UPDATE structured.weddings
           SET wedding_date = $2,
               region = $3,
               budget_bracket = CASE WHEN $4::boolean THEN $5::wedding_budget_bracket ELSE budget_bracket END,
               budget_amount = CASE WHEN $4::boolean THEN $6::bigint ELSE budget_amount END,
               prepared_categories = CASE WHEN $7::boolean THEN $8::vendor_category[] ELSE prepared_categories END,
               style_tags = CASE WHEN $9::boolean THEN $10::wedding_style[] ELSE style_tags END,
               setup_completed_at = coalesce(setup_completed_at, now())
           WHERE id = $1`,
          [weddingId, body.weddingDate, region, bracketGiven, bracket, budget, preparedGiven, prepared, stylesGiven, styles]
        );
      } else {
        const created = await client.query<{ id: string }>(
          `INSERT INTO structured.weddings
             (owner_user_id, wedding_date, region, budget_bracket, budget_amount, prepared_categories, style_tags, setup_completed_at)
           VALUES ($1, $2, $3, $4::wedding_budget_bracket, $5::bigint, $6::vendor_category[], $7::wedding_style[], now())
           RETURNING id`,
          [userId, body.weddingDate, region, bracket, budget, prepared, styles]
        );

        weddingId = created.rows[0]!.id;
      }

      await recordPreparedChoices(
        client,
        weddingId,
        userId,
        preparedVendorIds,
        preparedManual,
        preparedGiven ? prepared : null
      );
    });

    /*
     * 저장한 뒤 상태를 다시 읽어 돌려준다. 계약이 이 경로의 응답도 `/v1/me`와 같은
     * 모양이라고 적어뒀다 — 여기서 몇 칸만 손으로 채우면 앱이 검증에서 깨진다.
     */
    return loadCurrentUser(context, userId);
  });

  /**
   * 부를 이름. MY에서 정한다.
   *
   * 최소 온보딩에서 뺀 값이라 이 경로가 없으면 이름을 정할 방법이 아예 없어진다.
   * 비우는 것도 허용한다 — 한 번 적었다고 영영 못 지우게 할 이유가 없다.
   */
  app.post('/v1/me/display-name', auth, async (request) => {
    const userId = currentUserId(request);
    const body = displayNameRequestSchema.parse(request.body);
    const displayName = body.displayName === null ? null : body.displayName.trim();

    if (displayName !== null) {
      const check = checkDisplayName(displayName);

      if (!check.ok) {
        throw new ApiError('invalid_request', check.reason);
      }
    }

    await context.pool.query(
      `UPDATE structured.users SET display_name = $2, display_name_user_set = true WHERE id = $1`,
      [userId, displayName]
    );

    return { displayName };
  });

  app.post('/v1/weddings', auth, async (request, reply) => {
    const userId = currentUserId(request);
    const body = createWeddingRequestSchema.parse(request.body ?? {});

    const { rows } = await context.pool.query<{ id: string }>(
      'INSERT INTO structured.weddings (owner_user_id, wedding_date) VALUES ($1, $2) RETURNING id',
      [userId, body.weddingDate ?? null]
    );

    return reply.status(201).send(await loadDetail(context, rows[0]!.id, userId));
  });

  app.get<{ Params: { weddingId: string } }>('/v1/weddings/:weddingId', auth, async (request) => {
    const userId = currentUserId(request);
    await assertWeddingAccess(context.pool, request.params.weddingId, userId);

    return loadDetail(context, request.params.weddingId, userId);
  });

  /**
   * 지도용 Pick 업체 목록.
   *
   * 좌표가 없는 업체는 지도에 찍을 수 없어 제외한다. 목록은 그대로 뜬다.
   * `picked` = 해당 업종에서 결정된 업체인지 여부.
   */
  app.get<{ Params: { weddingId: string } }>(
    '/v1/weddings/:weddingId/map-vendors',
    auth,
    async (request) => {
      const userId = currentUserId(request);
      const { weddingId } = request.params;
      await assertWeddingAccess(context.pool, weddingId, userId);

      const [{ rows }, { rows: decisionRows }] = await Promise.all([
        context.pool.query<{
          vendor_id: string;
          vendor_name: string;
          category: string;
          lat: number;
          lng: number;
          address: string | null;
        }>(
          `SELECT c.vendor_id, v.name AS vendor_name, v.category, v.lat, v.lng, v.address
           FROM structured.vendor_candidates c
           JOIN structured.vendors v ON v.id = c.vendor_id
           WHERE c.wedding_id = $1
             AND v.lat IS NOT NULL
             AND v.lng IS NOT NULL
           ORDER BY c.added_at`,
          [weddingId]
        ),
        context.pool.query<{ vendor_id: string }>(
          /* 직접 입력한 결정(0440)은 업체가 없어 지도에 설 자리가 없다. */
          'SELECT vendor_id FROM structured.category_decisions WHERE wedding_id = $1 AND vendor_id IS NOT NULL',
          [weddingId]
        ),
      ]);

      const decidedIds = new Set(decisionRows.map((r) => r.vendor_id));

      return {
        vendors: rows.map((row) => ({
          vendorId: row.vendor_id,
          vendorName: row.vendor_name,
          category: row.category,
          lat: row.lat,
          lng: row.lng,
          address: row.address ?? '',
          picked: decidedIds.has(row.vendor_id),
        })),
      };
    }
  );

  /**
   * 내 등급·미션 현황.
   *
   * `/v1/me`는 전체 프로필이고, 이 경로는 등급·미션에만 집중한다. 클라이언트가
   * 홈이나 혜택 화면에서 전체 프로필을 다시 내려받지 않아도 된다.
   */
  app.get('/v1/me/membership', auth, async (request) => {
    const userId = currentUserId(request);
    const current = await loadCurrentUser(context, userId);

    const facts: MembershipFacts = {
      loggedIn: true,
      weddingSet: current.setupComplete,
      hasPick: current.hasPick,
      hasCompared: current.hasCompared,
      spouseLinked: current.spouseLinked,
      hasPaymentProof: current.hasPaymentProof,
    };

    return {
      tier: current.tier,
      tierLabel: current.tierLabel,
      allMissionsDone: allMissionsDone(facts),
      missions: {
        weddingSet: facts.weddingSet,
        hasPick: facts.hasPick,
        hasCompared: facts.hasCompared,
        spouseLinked: facts.spouseLinked,
        hasPaymentProof: facts.hasPaymentProof,
      },
    };
  });
}

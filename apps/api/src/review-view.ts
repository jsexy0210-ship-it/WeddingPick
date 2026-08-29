import {
  CHECKLIST_CAPTION,
  aspectsFor,
  computeUsageScore,
  evaluationModeFor,
  isCollecting,
  needsAttentionColor,
  scoreChecklist,
  type ChecklistAnswer,
  type VendorCategory,
} from '@weddingpick/domain';
import type { Pool } from 'pg';

/**
 * 업체의 이용점수.
 *
 * 관문은 `structured.scored_reviews` 하나다 — 게시 중이고 확인된 후기만 그 뷰에
 * 들어온다. 여기서 조건을 다시 쓰지 않는 것이 중요하다. 두 군데에 적으면 언젠가
 * 한쪽만 바뀌고, 그때 미인증 후기가 점수에 섞인다(서비스정책서 5번).
 *
 * 상세 화면과 후기 목록이 같은 함수를 쓴다. 같은 업체를 두 화면에서 보다가 점수가
 * 다르면 둘 다 못 믿게 된다.
 */
export async function loadUsageScore(pool: Pool, vendorId: string, category: VendorCategory) {
  const { rows } = await pool.query<{
    overall: number;
    verification: 'payment' | 'contract' | 'usage';
    aspects: { aspect: string; rating: number }[] | null;
  }>(
    `SELECT s.overall, s.verification,
            (SELECT json_agg(json_build_object('aspect', a.aspect, 'rating', a.rating))
             FROM structured.review_aspects a WHERE a.review_id = s.id) AS aspects
     FROM structured.scored_reviews s
     WHERE s.vendor_id = $1`,
    [vendorId]
  );

  const score = computeUsageScore(
    rows.map((row) => ({
      verification: row.verification,
      overall: row.overall,
      aspects: Object.fromEntries((row.aspects ?? []).map((a) => [a.aspect, a.rating])),
    }))
  );

  if (!score.available) {
    return score;
  }

  /*
   * 업종이 방식을 정한다. 결정사는 체크리스트, 나머지는 별점.
   *
   * 두 배열을 나눠 내보내는 이유는 4.2점과 78%가 다른 것을 재기 때문이다.
   * 한 배열에 넣으면 화면이 같은 막대로 그리고, 읽는 사람은 같은 것으로 읽는다.
   */
  if (evaluationModeFor(category) === 'checklist') {
    const answers = await pool.query<{ item: string; answer: ChecklistAnswer }>(
      `SELECT a.item, a.answer
       FROM structured.review_checklist_answers a
       JOIN structured.scored_reviews s ON s.id = a.review_id
       WHERE s.vendor_id = $1`,
      [vendorId]
    );

    const checklist = scoreChecklist(category, answers.rows);

    return {
      available: true as const,
      average: score.average,
      count: score.count,
      aspects: [],
      checklist: checklist.map((item) => ({
        ...item,
        // 표본이 모자란 100%는 정보가 아니다. 숫자 대신 "수집 중"으로 나간다.
        collecting: isCollecting(item),
        needsAttention: needsAttentionColor(item),
      })),
      caption: CHECKLIST_CAPTION,
    };
  }

  /*
   * 업종 목록을 돌면서 이름을 붙인다. 목록에 없는 항목은 내보내지 않는다 — 화면에
   * 내부 키가 그대로 뜨는 것보다 한 줄 빠지는 편이 낫다. 순서도 목록 순서를 따른다.
   */
  return {
    available: true as const,
    average: score.average,
    count: score.count,
    aspects: aspectsFor(category).flatMap((aspect) => {
      const average = score.byAspect[aspect.key];

      return average === undefined ? [] : [{ key: aspect.key, label: aspect.label, average }];
    }),
    checklist: [],
    caption: null,
  };
}

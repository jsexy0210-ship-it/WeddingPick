-- Pick 최종 결정. 통합정책 v3.2 §6~7.
--
-- Pick의 상태 흐름은 `Pick → 비교 → 공동결정 → 최종 결정 → 준비 완료`다. 앞의
-- 셋은 후보를 들고 있는 동안의 일이라 vendor_candidates가 이미 담고 있고,
-- **최종 결정은 다른 종류의 사실**이라 따로 둔다 — "이 업종은 여기로 정했다"는
-- 후보 한 줄의 속성이 아니라 웨딩과 업종에 붙는 결론이다.
--
-- 따로 두면 얻는 것: 기본키가 (wedding_id, category)라 **한 업종에 결정이 둘일
-- 수 없다.** 후보 줄에 `decided` 깃발을 세우는 방식이었다면 둘을 동시에 세울 수
-- 있고, 그때 어느 쪽이 진짜인지 아무도 모른다.

CREATE TABLE structured.category_decisions (
  wedding_id uuid NOT NULL REFERENCES structured.weddings (id) ON DELETE CASCADE,
  category vendor_category NOT NULL,
  vendor_id uuid NOT NULL REFERENCES structured.vendors (id) ON DELETE CASCADE,

  decided_at timestamptz NOT NULL DEFAULT now(),
  /** 누가 눌렀는지. 배우자와 함께 정하는 일이라 누가 눌렀는지가 남아야 한다. */
  decided_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,

  PRIMARY KEY (wedding_id, category),

  /*
   * **Pick하지 않은 곳을 결정할 수 없다.**
   *
   * vendor_candidates의 UNIQUE (wedding_id, vendor_id)를 가리킨다. 그래서 결정은
   * 반드시 후보 중에서 나오고, 후보에서 빼면 결정도 함께 사라진다 — 담아두지도
   * 않은 곳으로 정해져 있는 상태가 생기지 않는다.
   */
  CONSTRAINT decision_is_a_pick
    FOREIGN KEY (wedding_id, vendor_id)
    REFERENCES structured.vendor_candidates (wedding_id, vendor_id)
    ON DELETE CASCADE
);

CREATE INDEX category_decisions_vendor_idx ON structured.category_decisions (vendor_id);

COMMENT ON TABLE structured.category_decisions IS
  '업종별 최종 결정. 기본키가 (웨딩, 업종)이라 한 업종에 결정이 둘일 수 없다(v3.2 §6).';

/*
 * 업종별 준비 상태. v3.2 §7이 정한 세 가지.
 *
 *   준비 전 / 후보 Pick 중 / 결정 완료
 *
 * 저장하지 않고 계산한다 — Pick을 담고 빼고 결정할 때마다 달라지는 값이라,
 * 저장해두면 낡는다. 파기 일정을 뷰로 둔 것과 같은 이유다(0018).
 */
CREATE VIEW structured.wedding_preparation AS
SELECT w.id AS wedding_id,
       c.category,
       count(p.vendor_id) AS pick_count,
       d.vendor_id AS decided_vendor_id,
       CASE
         WHEN d.vendor_id IS NOT NULL THEN 'decided'
         WHEN count(p.vendor_id) > 0 THEN 'picking'
         ELSE 'before'
       END AS state
FROM structured.weddings w
CROSS JOIN unnest(enum_range(NULL::vendor_category)) AS c (category)
LEFT JOIN structured.vendor_candidates p
       ON p.wedding_id = w.id
      AND p.vendor_id IN (SELECT id FROM structured.vendors v WHERE v.category = c.category)
LEFT JOIN structured.category_decisions d
       ON d.wedding_id = w.id AND d.category = c.category
GROUP BY w.id, c.category, d.vendor_id;

COMMENT ON VIEW structured.wedding_preparation IS
  '업종별 준비 상태(준비 전/후보 Pick 중/결정 완료). 저장하지 않고 계산한다 — Pick이 바뀔 때마다 달라지는 값이다.';

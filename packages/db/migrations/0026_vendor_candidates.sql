-- 후보 저장. 사업계획서 v3 8번의 COMPARE 영역.
--
-- 비교 기능은 있었는데 담아둘 곳이 없었다 — 볼 때마다 업체를 다시 찾아 골라야 했다.
-- 결혼 준비는 몇 달에 걸친 일이고, 그 사이에 앱을 몇 번이나 껐다 켠다.
--
-- **웨딩에 매단다. 사람이 아니라.** 배우자가 담은 곳을 내가 보고, 내가 담은 곳을
-- 배우자가 본다 — 사업계획서 12번의 공동 의사결정이 그 말이다. 사람에 매달면
-- 각자 다른 목록을 들고 같은 이야기를 하게 된다.

CREATE TABLE structured.vendor_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES structured.weddings (id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES structured.vendors (id) ON DELETE CASCADE,

  /*
   * 누가 담았는지. 지우는 데 쓰지 않는다 — 배우자도 지울 수 있다.
   *
   * 화면에서 "배우자가 담은 곳"을 구분해 보여주려고 남긴다. 둘이 각자 담은 것을
   * 구분하지 않으면, 상대가 마음에 들어 한 곳인지 내가 담아둔 곳인지 모르게 된다.
   */
  added_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,

  /** 왜 담았는지. 몇 달 뒤에 보면 이유를 잊는다. */
  note text CHECK (note IS NULL OR length(btrim(note)) > 0),

  added_at timestamptz NOT NULL DEFAULT now(),

  -- 같은 업체를 두 번 담을 수 없다. 목록에 같은 이름이 두 번 나오면 지운 줄 안다.
  UNIQUE (wedding_id, vendor_id)
);

COMMENT ON TABLE structured.vendor_candidates IS
  '후보 업체. 사람이 아니라 웨딩에 매단다 — 배우자와 같은 목록을 봐야 같은 이야기를 할 수 있다.';

CREATE INDEX vendor_candidates_wedding_idx
  ON structured.vendor_candidates (wedding_id, added_at DESC);

/*
 * 한 웨딩에 담을 수 있는 수의 상한.
 *
 * 담는 데 제한을 두는 이유는 저장 공간이 아니라 **비교가 안 되기 때문이다.**
 * 스무 곳을 담아두면 그건 후보가 아니라 검색 결과 사본이고, 고르는 일을 도와주지
 * 못한다. 한 업종에 그렇게 많은 곳을 진지하게 견주는 사람은 없다.
 */
CREATE FUNCTION structured.enforce_candidate_limit() RETURNS trigger AS $$
DECLARE
  current_count integer;
BEGIN
  SELECT count(*) INTO current_count
  FROM structured.vendor_candidates
  WHERE wedding_id = NEW.wedding_id;

  IF current_count >= 30 THEN
    RAISE EXCEPTION '후보는 30곳까지 담을 수 있다';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendor_candidates_limit
  BEFORE INSERT ON structured.vendor_candidates
  FOR EACH ROW EXECUTE FUNCTION structured.enforce_candidate_limit();

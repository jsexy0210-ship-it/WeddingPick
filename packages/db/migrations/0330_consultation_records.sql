-- 상담 녹음에서 뽑은 것을 담는다.
--
-- 2026-09-14 대표님 요청 — 음성 업로드 → 웨딩 상담 판별 → 업종 판별 → 구조화 →
-- 사용자 검토 → 저장.
--
-- **방문노트(`visit_notes`)와 합치지 않는다.** 손으로 적은 것과 뽑아낸 것은 신뢰도가
-- 다르다. 한 표에 담으면 「사람이 적었나 뽑아냈나」를 칸 하나로 가려야 하고, 그 칸이
-- 비었을 때 어느 쪽인지 표가 말하지 못한다. 확정되면 이쪽에서 방문노트 한 줄을 만든다.
--
-- **제안금액은 가격 통계에 넣지 않는다.** `visit_notes.quoted_amount`와 같은 규칙이다 —
-- 그 자리에서 들은 값이지 계약가가 아니다. `comparable_quotes`·`usable_payment_proofs`
-- 어디에도 들어가지 않는다.

-- ---------------------------------------------------------------------------
-- 상담기록
-- ---------------------------------------------------------------------------

CREATE TABLE structured.consultation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id uuid NOT NULL REFERENCES structured.weddings (id) ON DELETE CASCADE,
  created_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,

  vendor_id uuid REFERENCES structured.vendors (id) ON DELETE SET NULL,
  /** 업체를 못 찾아도 적을 수 있어야 한다. 상담은 계약보다 먼저다. */
  vendor_label text,

  /* 1차 판정 ------------------------------------------------------------ */

  /** SUPPORTED_WEDDING_CONSULTATION · UNSUPPORTED_WEDDING_CONSULTATION · NOT_WEDDING_CONSULTATION */
  status text NOT NULL CHECK (status IN (
    'SUPPORTED_WEDDING_CONSULTATION',
    'UNSUPPORTED_WEDDING_CONSULTATION',
    'NOT_WEDDING_CONSULTATION'
  )),
  /**
   * 상담 분류. **업종(`vendors.category`)과 다른 목록이다** — 아이폰스냅 · 본식영상 ·
   * 예복 셋은 여기에만 있다(2026-09-14 대표 결정 P-1). 그래서 enum으로 묶지 않는다.
   */
  category text CHECK (category IS NULL OR category <> ''),
  confidence numeric(4, 3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),

  /* 뽑아낸 것 ------------------------------------------------------------ */

  /**
   * 업종마다 칸이 스무 개에서 서른 개다. **열로 펴지 않는다** — 열네 종이면 300개가
   * 넘고, 한 종을 고칠 때마다 마이그레이션이 생긴다. 열로 두는 것은 어느 업종에나
   * 있고 검색·통계에 쓰는 값뿐인데, 지금은 그런 값이 없다.
   */
  common jsonb NOT NULL DEFAULT '{}'::jsonb,
  category_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_data jsonb NOT NULL DEFAULT '{}'::jsonb,

  /* 사용자 확인 ---------------------------------------------------------- */

  /**
   * 사용자가 보고 고친 뒤 눌렀는가. **모델이 뽑은 값은 확정이 아니다**(요청 §6) —
   * 확인 전 기록은 화면에서 「확인 필요」로 서고 방문노트를 만들지 않는다.
   */
  confirmed_at timestamptz,

  /* 원본 ---------------------------------------------------------------- */

  /**
   * 녹음 원본의 저장소 열쇠. **지우면 NULL이 된다.**
   *
   * 열쇠가 남아 있는 줄이 곧 「아직 안 지운 것」이다. 따로 깃발을 두지 않는 이유는
   * 깃발과 실제가 어긋날 수 있기 때문이다 — 지웠다고 적어두고 안 지운 자리가 생긴다.
   */
  audio_key text CHECK (audio_key IS NULL OR audio_key <> ''),
  audio_seconds integer CHECK (audio_seconds IS NULL OR audio_seconds > 0),
  /**
   * 이 시각까지는 지워야 한다. 사용자가 결과를 확인하지 않아도 지운다.
   *
   * 「끝나면 지운다」만 두면 **확인 안 한 파일이 영원히 남는 자리**가 된다.
   * 처리방침 제2항에 적은 24시간이 이 칸이다.
   */
  audio_delete_by timestamptz,
  audio_deleted_at timestamptz,

  /* 어떻게 읽었나 -------------------------------------------------------- */

  model text,
  /** 음성 토큰은 따로 센다 — 글자와 합치면 비용이 3분의 1로 잡힌다. */
  audio_tokens integer CHECK (audio_tokens IS NULL OR audio_tokens >= 0),
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  /** 무엇에 동의하고 올렸는지. 문구가 바뀌면 예전 동의는 그 새 내용의 동의가 아니다. */
  consent_version text NOT NULL,
  /** 뽑는 규칙이 바뀌면 올린다. 옛 판으로 뽑은 줄을 나중에 골라낼 수 있어야 한다. */
  schema_version integer NOT NULL DEFAULT 1,

  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  /*
   * 열쇠가 남아 있는데 「지웠다」고 적힌 줄을 막는다.
   *
   * 그 둘이 함께 있으면 어느 쪽이 사실인지 표가 말하지 못하고, 파기 작업은
   * 「지운 것」으로 읽어 건너뛴다 — 안 지운 녹음이 조용히 남는 자리다.
   */
  CONSTRAINT consultation_audio_delete_consistent
    CHECK (audio_key IS NULL OR audio_deleted_at IS NULL),
  /* 웨딩이 아니라고 판정한 것에 업종이 붙어 있으면 안 된다. */
  CONSTRAINT consultation_category_matches_status CHECK (
    status = 'SUPPORTED_WEDDING_CONSULTATION' OR category IS NULL
  )
);

COMMENT ON TABLE structured.consultation_records IS
  '상담 녹음에서 뽑은 것. 제안금액은 계약가가 아니라 그 자리에서 들은 값이라 가격 통계에 쓰지 않는다.';
COMMENT ON COLUMN structured.consultation_records.audio_key IS
  '녹음 원본의 저장소 열쇠. 지우면 NULL이 된다 — 열쇠가 남은 줄이 곧 아직 안 지운 것이다.';
COMMENT ON COLUMN structured.consultation_records.audio_delete_by IS
  '이 시각까지는 지운다. 사용자가 확인하지 않아도 지운다 — 처리방침 제2항의 24시간.';

CREATE INDEX consultation_records_wedding_idx
  ON structured.consultation_records (wedding_id, created_at DESC);

/*
 * 아직 안 지운 원본을 찾는 색인. **파기 작업이 이것만 본다.**
 *
 * 부분 색인이라 이미 지운 줄은 들어오지 않는다 — 시간이 지날수록 이 색인은 작아지고,
 * 파기가 밀렸을 때만 커진다. 커진 것이 곧 경보다.
 */
CREATE INDEX consultation_records_pending_delete_idx
  ON structured.consultation_records (audio_delete_by)
  WHERE audio_key IS NOT NULL;

-- 이벤트 보상. 최종통합정책 v2.0 I장.
--
-- 친구초대 3,000원 · 홍보인증 2,000원. I-3이 자동지급 흐름을 정했지만, **돈을
-- 실제로 보내는 수단이 아직 없다.** 그래서 여기까지가 자동이다 —
--
--   조건확인 → 어뷰징검사 → 지급판정 → 한도확인 → (지급) → 기록
--                                                    ↑ 사람이 한다
--
-- 없는 것을 있는 척하지 않는다. 지급 대상이 됐다는 것과 지급됐다는 것을 다른
-- 상태로 두고, 화면은 각각 다른 말을 한다.

-- ---------------------------------------------------------------------------
-- 초대 코드
-- ---------------------------------------------------------------------------
--
-- 배우자 초대(0024)와 다른 코드다. 그쪽은 일회성이고 만료되며 한 사람만 받는다 —
-- 우리 웨딩에 들어오는 문이라 그렇다. 친구초대는 여러 사람이 쓰는 내 이름표라
-- 만료도 재발급도 없다. 한 표에 합치면 둘 중 하나가 틀린 규칙을 갖게 된다.

CREATE TABLE structured.referral_codes (
  user_id uuid PRIMARY KEY REFERENCES structured.users (id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE structured.referral_codes IS
  '친구초대 코드. 배우자 초대 코드와 다르다 — 만료도 재발급도 없는 내 이름표다.';

-- ---------------------------------------------------------------------------
-- 초대 기록
-- ---------------------------------------------------------------------------

CREATE TABLE structured.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  /*
   * 초대받은 사람. **한 사람은 한 번만 초대받는다.**
   *
   * 여러 코드를 돌려 쓰면 한 계정이 여러 사람에게 보상을 만들어준다. UNIQUE가
   * 그 문을 닫는다 — 코드 입력 화면에서 거르는 것만으로는 동시에 두 번 눌리는
   * 경우가 남는다.
   */
  invited_user_id uuid NOT NULL UNIQUE REFERENCES structured.users (id) ON DELETE CASCADE,

  joined_at timestamptz NOT NULL DEFAULT now(),
  /** 첫 유효 결제인증을 낸 때. 이게 있어야 보상 조건이 찬다(I-1 · K-7). */
  qualified_at timestamptz,

  -- 자기 코드를 자기가 넣을 수 없다. 이건 화면이 아니라 표가 막는다.
  CONSTRAINT referral_is_not_self CHECK (inviter_user_id <> invited_user_id)
);

CREATE INDEX referrals_inviter_idx ON structured.referrals (inviter_user_id, joined_at DESC);

COMMENT ON COLUMN structured.referrals.qualified_at IS
  '초대받은 사람의 첫 유효 결제인증 시각. 가입만으로는 보상하지 않는다(v2.0 K-7).';

-- ---------------------------------------------------------------------------
-- 홍보인증
-- ---------------------------------------------------------------------------
--
-- I-2는 "공개 게시물 URL 자동검증"이라고 적었다. **우리는 그 글을 열어보지
-- 않는다** — 남의 사이트를 긁지 않기로 했고, 열어봐도 그 글이 이 사람 것인지는
-- 알 수 없다. 규칙이 볼 수 있는 것(주소 꼴·중복·같은 사람 반복)만 자동으로 보고,
-- 글이 실제로 올라가 있는지는 사람이 확인한다.

CREATE TABLE structured.promotion_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  url text NOT NULL CHECK (url ~ '^https://'),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- 같은 글을 두 사람이 낼 수 없다. 복붙을 표가 막는다.
  UNIQUE (url)
);

CREATE INDEX promotion_submissions_user_idx
  ON structured.promotion_submissions (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 보상 원장
-- ---------------------------------------------------------------------------

CREATE TYPE reward_kind AS ENUM ('referral', 'promotion');

/*
 * 지급 대상이 된 것과 지급된 것은 다른 상태다.
 *
 * 하나로 두면 화면이 "3,000원을 받았어요"라고 적게 되고, 아직 아무도 돈을
 * 보내지 않았다면 그건 거짓말이다.
 */
CREATE TYPE reward_status AS ENUM ('earned', 'held', 'paid', 'blocked');

CREATE TABLE structured.reward_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES structured.users (id) ON DELETE CASCADE,
  kind reward_kind NOT NULL,
  amount_krw integer NOT NULL CHECK (amount_krw > 0),

  status reward_status NOT NULL DEFAULT 'earned',
  /** 왜 이 상태인지. 세는 코드다 — 같은 이유가 몇 번 났는지 알려면. */
  reason_code text NOT NULL CHECK (length(btrim(reason_code)) > 0),

  /** 무엇 때문에 생긴 보상인지. 초대 한 건 또는 홍보 글 한 건. */
  referral_id uuid UNIQUE REFERENCES structured.referrals (id) ON DELETE CASCADE,
  promotion_id uuid UNIQUE REFERENCES structured.promotion_submissions (id) ON DELETE CASCADE,

  decided_at timestamptz,
  decided_by uuid REFERENCES structured.users (id) ON DELETE SET NULL,
  decision_note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  /*
   * 보상 하나는 근거 하나에서 온다. 둘 다 비면 근거 없는 지급이고, 둘 다 차면
   * 어느 쪽으로 센 것인지 알 수 없다.
   */
  CONSTRAINT grant_has_exactly_one_source
    CHECK ((referral_id IS NULL) <> (promotion_id IS NULL)),
  CONSTRAINT grant_source_matches_kind
    CHECK ((kind = 'referral') = (referral_id IS NOT NULL)),

  /*
   * 끝난 상태에는 사람이 남는다. 지급도 차단도 사람이 하는 일이다 — 조건이
   * 찼다는 판정까지가 자동이고, 그 뒤는 아직 손이다.
   *
   * 각 제약이 한 가지만 지킨다. 0032에서 배운 것이다.
   */
  CONSTRAINT reward_decision_is_dated
    CHECK ((status IN ('earned', 'held')) = (decided_at IS NULL)),
  CONSTRAINT reward_decision_names_the_person
    CHECK ((decided_at IS NULL) = (decided_by IS NULL))
);

CREATE INDEX reward_grants_user_idx ON structured.reward_grants (user_id, created_at DESC);
CREATE INDEX reward_grants_open_idx ON structured.reward_grants (kind, created_at)
  WHERE status IN ('earned', 'held');

COMMENT ON TABLE structured.reward_grants IS
  '보상 원장. 지급 대상이 된 것(earned)과 지급된 것(paid)은 다른 상태다 — 하나로 두면 화면이 거짓말을 하게 된다.';
COMMENT ON COLUMN structured.reward_grants.status IS
  'earned=조건 충족·지급 대기, held=사람 확인 필요, paid=지급 완료, blocked=지급하지 않음.';

/*
 * 지급하면 되는 것.
 *
 * held는 여기 없다 — 한도를 넘었거나 어뷰징이 의심되는 건은 사람이 따로 본다
 * (I-3: 비정상 패턴·예산 초과·한도 초과만 차단하거나 위로 보낸다).
 */
CREATE VIEW structured.payable_rewards AS
SELECT g.id, g.user_id, g.kind, g.amount_krw, g.reason_code, g.created_at
FROM structured.reward_grants g
WHERE g.status = 'earned';

COMMENT ON VIEW structured.payable_rewards IS
  '조건이 차서 지급하면 되는 보상. 한도 초과·어뷰징 의심(held)은 여기 오지 않는다.';

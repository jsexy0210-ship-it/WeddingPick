-- 운영자가 직접 등록·수정·삭제하는 자주 묻는 것.
--
-- 2026-09-11 대표 지시 — 「FAQ, 약관 방침, 링크 미리보기 등 운영자가 직접 조작이
-- 가능해야한다」.
--
-- **화면은 이미 있었고 서버가 없었다.** `routes/admin.ts`의 FAQ 다섯 라우트는
-- 등록만 돼 있고 GET은 빈 배열, POST는 임의 id, 나머지는 204만 돌려줬다 — 저장
-- 단추가 눌리고 아무것도 남지 않았다. 담을 표가 이것이다.
--
-- **코드의 FAQ를 여기로 복사하지 않는다.** `packages/domain/src/faq.ts`의 항목은
-- 답 안에 공개 기준 건수를 계산해 넣는다(`DISCLOSURE_THRESHOLDS`). 그 문장을 글자로
-- 복사해 두면 기준이 바뀌는 날 표에 든 사본이 옛 수를 말하고, 문장이라서 아무도
-- 고장으로 보지 않는다 — faq.ts가 「건수를 글에 박아두지 않는다」고 적어 둔 이유다.
-- 그래서 조회는 **코드 항목과 이 표를 겹쳐** 돌려준다. 코드 항목은 잠긴 채로 보이고,
-- 여기 든 것만 고칠 수 있다. site_meta가 spec 값을 복사하지 않는 것과 같은 방식이다.

CREATE TABLE structured.faq_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 화면의 묶음 이름. 빈 묶음을 「미분류」로 읽지 않게 빈 문자열을 막는다.
  category    text        NOT NULL CHECK (category <> ''),

  question    text        NOT NULL CHECK (question <> ''),
  answer      text        NOT NULL CHECK (answer <> ''),

  -- 작은 수가 위로. 같은 수는 만든 순서로 이어진다.
  sort_order  integer     NOT NULL DEFAULT 0,

  -- **기본은 숨김이다.** 등록하는 중간 상태가 그대로 사용자에게 나가지 않게 한다.
  published   boolean     NOT NULL DEFAULT false,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid        REFERENCES structured.users(id) ON DELETE SET NULL
);

-- 공개 조회는 「보이는 것만, 순서대로」 한 가지 형태로만 읽는다.
CREATE INDEX faq_items_published_order_idx
  ON structured.faq_items (published, sort_order, created_at);

COMMENT ON TABLE structured.faq_items IS
  '운영자가 등록한 자주 묻는 것. 코드의 FAQ_ITEMS와 겹쳐 보여주며 이 표의 행만 편집된다.';
COMMENT ON COLUMN structured.faq_items.published IS
  '사용자 화면에 내보내는지. 기본 false — 작성 중인 항목이 그대로 나가지 않게 한다.';

-- 공공 통계 — 웨딩피드 자동 작성에 넘기는 숫자(2026-09-24 대표 지시 「피드에는 써도 된다」).
-- 키 하나에 최신 값 하나만 둔다. 모델에게는 이 표의 값만 건네고, 본문의 숫자가 이 값과
-- 다르면 글을 버린다(packages/domain/src/public-stats.ts).
-- 출처 주소는 공공데이터포털 데이터 페이지만 받는다 — 출처 표시 의무를 지키는 근거다.
CREATE TABLE structured.public_stats (
  key text PRIMARY KEY CHECK (key ~ '^[a-z0-9_.]+$'),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  value numeric NOT NULL CHECK (value >= 0),
  unit text NOT NULL CHECK (length(unit) BETWEEN 1 AND 10),
  period text NOT NULL CHECK (length(period) BETWEEN 1 AND 30),
  source_name text NOT NULL CHECK (length(source_name) BETWEEN 1 AND 60),
  source_url text NOT NULL CHECK (source_url ~ '^https://(www\.)?data\.go\.kr/data/[0-9]+/'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

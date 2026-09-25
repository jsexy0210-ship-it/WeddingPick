-- 공휴일 · 중기예보 — 웨딩노트 D-day 카드(WP-NOTE-001) 예보 한 줄과 일정 등록 달력
-- (WP-NOTE-002) 아래 공휴일 한 줄(2026-09-24 대표 지시 「A안으로 해, 문구도 그대로 진행」).
-- 값은 공공 API(한국천문연구원 특일 정보 · 기상청 중기예보)에서 서버가 받아 넣는다.
-- 수집기는 실제 응답 모양을 확인한 뒤 붙인다 — 그 전까지 두 표는 비어 있고 화면은 줄을
-- 그리지 않는다.
CREATE TABLE structured.public_holidays (
  holiday_date date PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 예식 지역(짧은 꼴 — WEDDING_REGIONS) × 날짜 한 칸. 발표가 새로 나오면 덮어쓴다.
CREATE TABLE structured.mid_forecasts (
  region text NOT NULL CHECK (length(region) BETWEEN 1 AND 10),
  forecast_date date NOT NULL,
  -- 오전·오후 중 높은 쪽.
  rain_probability smallint NOT NULL CHECK (rain_probability BETWEEN 0 AND 100),
  temp_min smallint NOT NULL,
  temp_max smallint NOT NULL CHECK (temp_max >= temp_min),
  issued_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (region, forecast_date)
);

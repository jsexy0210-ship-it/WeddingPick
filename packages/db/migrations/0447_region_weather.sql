-- 지역 오늘 날씨 — 홈 히어로 카드 오른쪽 빈 자리(2026-09-26 대표 지시 「히어로 카드 영역 우측
-- 빈 영역에 날씨 정보를 넣는다」).
--
-- 값은 기상청 단기예보 조회서비스(공공데이터포털)에서 워커가 한 시간마다 받아 넣는다 —
-- 기온 · 강수형태는 초단기실황(getUltraSrtNcst · 정시 관측), 하늘상태는 초단기예보
-- (getUltraSrtFcst)의 가장 가까운 시각이다. 화면은 공공 API를 직접 부르지 않고 이 표만 읽는다.
--
-- 0437 `mid_forecasts`(예식일 중기예보)와 따로 둔다 — 그 표는 «발표일로부터 4~10일 뒤의
-- 하루»를 담고, 이 표는 «지금 이 지역»을 담는다. 합치면 한쪽 규칙(4~10일)이 다른 쪽을 막는다.
--
-- 지역은 온보딩 짧은 꼴(WEDDING_REGIONS) 중 격자 좌표가 정해진 여덟 곳뿐이다 — 「그 외」는
-- 한 점으로 대표할 수 없어 넣지 않고, 화면은 날씨를 그리지 않는다.
CREATE TABLE structured.region_weather (
  region text PRIMARY KEY CHECK (region IN ('서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산')),
  -- 기온(℃). 실황 T1H는 소수 한 자리라 반올림해 담는다.
  temperature smallint NOT NULL CHECK (temperature BETWEEN -60 AND 60),
  -- 화면 아이콘·글자를 가르는 다섯 가지. 강수형태(PTY, 실황)가 하늘상태(SKY, 예보)보다 먼저다.
  condition text NOT NULL CHECK (condition IN ('clear', 'partly_cloudy', 'cloudy', 'rain', 'snow')),
  -- 관측 기준 시각(실황 base_time, 정시). 화면 「14시 기준」이 이 값이다. 오래된 값은 읽는 쪽이 버린다.
  observed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

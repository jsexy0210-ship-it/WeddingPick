-- 네이버·구글 신원 파기 — 1단계 계수 스크립트 (읽기 전용)
--
-- 대표님 지시(2026-09-14) 1단계: 지우기 전에 먼저 센다.
-- 이 파일에는 DELETE·DROP·UPDATE·ALTER가 한 줄도 없다. SELECT만 있다.
--
-- 실행:
--   psql "$DATABASE_URL" -f scripts/identity-purge-count.sql
--
-- 읽는 법:
--   [3] locked_out_if_purged 가 0이면 아무도 못 들어오게 되지 않는다.
--       0이 아니면 그 수만큼 사람이 다시 못 들어온다 — 대표님 재결정 대상.
--   [6] partners_who_lose_the_wedding 은 네이버·구글 사용자가 아닌데도
--       CASCADE로 웨딩을 잃는 배우자 수다. 0이 아니면 특히 위험하다.
--
-- 주의: '잔여 로그인 수단'에 email을 포함한다. identity.email_credentials 는
--       provider='email' 인 identity 행에 붙으므로 이메일 로그인도 살아있는 경로다.

\pset footer off
\echo '=== [1] identity_provider enum 실제 값 ==='
SELECT e.enumlabel AS provider
FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'identity_provider' ORDER BY e.enumsortorder;

\echo ''
\echo '=== [2] provider별 신원(identity) 행 수 / 고유 사용자 수 ==='
SELECT i.provider::text AS provider,
       count(*)                AS identity_rows,
       count(DISTINCT i.user_id) AS distinct_users
FROM identity.identities i
GROUP BY i.provider ORDER BY 1;

\echo ''
\echo '=== [3] 네이버·구글 보유 사용자 분류 (핵심) ==='
WITH purge AS (SELECT DISTINCT user_id FROM identity.identities WHERE provider IN ('google','naver')),
surv AS (SELECT DISTINCT user_id FROM identity.identities WHERE provider IN ('apple','kakao','email'))
SELECT
  (SELECT count(*) FROM purge)                                   AS users_with_naver_or_google,
  (SELECT count(*) FROM purge p WHERE NOT EXISTS (SELECT 1 FROM surv s WHERE s.user_id=p.user_id))
                                                                 AS LOCKED_OUT_if_purged,
  (SELECT count(*) FROM purge p WHERE EXISTS (SELECT 1 FROM surv s WHERE s.user_id=p.user_id))
                                                                 AS safe_has_other_login;

\echo ''
\echo '=== [4] 잠기는 사용자의 잔여 로그인 수단 내역 ==='
WITH purge AS (SELECT DISTINCT user_id FROM identity.identities WHERE provider IN ('google','naver')),
per_user AS (
  SELECT p.user_id,
         coalesce(string_agg(DISTINCT i2.provider::text, '+'), '(none — 잠김)') AS remaining_methods
  FROM purge p
  LEFT JOIN identity.identities i2
         ON i2.user_id = p.user_id AND i2.provider IN ('apple','kakao','email')
  GROUP BY p.user_id)
SELECT remaining_methods, count(*) AS users
FROM per_user GROUP BY remaining_methods ORDER BY users DESC;

\echo ''
\echo '=== [5] 잠기는 사용자가 만든 데이터 (Pick/웨딩일정/제보/결제인증) ==='
WITH purge AS (SELECT DISTINCT user_id FROM identity.identities WHERE provider IN ('google','naver')),
surv  AS (SELECT DISTINCT user_id FROM identity.identities WHERE provider IN ('apple','kakao','email')),
locked AS (SELECT p.user_id FROM purge p WHERE NOT EXISTS (SELECT 1 FROM surv s WHERE s.user_id=p.user_id)),
-- 사용자 삭제 시 CASCADE로 함께 사라지는 웨딩
lw AS (SELECT w.id, w.owner_user_id, w.partner_user_id
       FROM structured.weddings w JOIN locked l ON l.user_id = w.owner_user_id)
SELECT
  (SELECT count(*) FROM locked)                                            AS locked_users,
  (SELECT count(*) FROM lw)                                                AS weddings_owned_by_locked,
  (SELECT count(*) FROM lw WHERE partner_user_id IS NOT NULL)              AS of_which_have_a_partner,
  (SELECT count(*) FROM structured.vendor_candidates c JOIN lw ON lw.id=c.wedding_id) AS picks,
  (SELECT count(*) FROM structured.wedding_events e JOIN lw ON lw.id=e.wedding_id)    AS wedding_events,
  (SELECT count(*) FROM structured.wedding_tasks t JOIN lw ON lw.id=t.wedding_id)     AS wedding_tasks,
  (SELECT count(*) FROM structured.price_reports r JOIN locked l ON l.user_id=r.reporter_user_id)   AS price_reports,
  (SELECT count(*) FROM structured.payment_proofs pp JOIN locked l ON l.user_id=pp.reporter_user_id) AS payment_proofs;

\echo ''
\echo '=== [6] 배우자 연쇄 피해: 잠기는 사용자가 owner인 웨딩에 묶인 "다른" 사용자 ==='
WITH purge AS (SELECT DISTINCT user_id FROM identity.identities WHERE provider IN ('google','naver')),
surv  AS (SELECT DISTINCT user_id FROM identity.identities WHERE provider IN ('apple','kakao','email')),
locked AS (SELECT p.user_id FROM purge p WHERE NOT EXISTS (SELECT 1 FROM surv s WHERE s.user_id=p.user_id))
SELECT count(DISTINCT w.partner_user_id) AS partners_who_lose_the_wedding
FROM structured.weddings w JOIN locked l ON l.user_id = w.owner_user_id
WHERE w.partner_user_id IS NOT NULL
  AND w.partner_user_id NOT IN (SELECT user_id FROM locked);

\echo ''
\echo '=== [7] 네이버·구글 세션이 아직 살아있는가 ==='
SELECT count(*) AS live_sessions_of_naver_google_only_users
FROM identity.sessions s
WHERE s.revoked_at IS NULL AND s.expires_at > now()
  AND s.user_id IN (
    SELECT DISTINCT user_id FROM identity.identities WHERE provider IN ('google','naver')
    EXCEPT SELECT DISTINCT user_id FROM identity.identities WHERE provider IN ('apple','kakao','email'));

#!/usr/bin/env node
/**
 * 관리자 계정 로그인 상태 점검(읽기 전용) — 2026-09-25 대표님 「신규로 추가한 관리자 계정
 * 왜 로그인 승인이 안나니?」 · 「다확인해봐」.
 *
 *   DATABASE_URL=... node scripts/admin-accounts-audit.mjs
 *
 * 계정마다 로그인·권한 확인이 거치는 조건을 하나씩 찍는다. 비밀번호 해시 원문·세션 토큰·
 * 로그인 제한 키 원문은 찍지 않는다 — 해시는 「꼴이 맞는가」만 참/거짓으로 본다.
 * 트랜잭션을 READ ONLY로 열어 아무것도 바꾸지 않는다.
 */
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL이 없다.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query('BEGIN TRANSACTION READ ONLY');

  const { rows: accounts } = await client.query(`
    SELECT
      a.login_id,
      a.role::text AS role,
      a.disabled_at IS NOT NULL AS disabled,
      to_char(a.created_at AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') AS created_kst,
      maker.login_id AS created_by,
      a.password_hash ~ '^scrypt\\$[A-Za-z0-9+/=]+\\$[A-Za-z0-9+/=]+$' AS hash_shape_ok,
      length(a.login_id) <> length(btrim(a.login_id)) AS login_id_has_spaces,
      (SELECT count(*) FROM identity.identities i
        WHERE i.provider = 'admin' AND i.subject = a.login_id)::int AS identity_rows,
      EXISTS (SELECT 1 FROM identity.identities i
        WHERE i.provider = 'admin' AND i.subject = a.login_id AND i.user_id = a.user_id) AS identity_points_here,
      u.activated_at IS NOT NULL AS activated,
      u.deleted_at IS NOT NULL AS user_deleted,
      (SELECT count(*) FROM identity.identities i2 WHERE i2.user_id = a.user_id)::int AS identities_on_user,
      (SELECT string_agg(DISTINCT i3.provider::text, ',') FROM identity.identities i3 WHERE i3.user_id = a.user_id) AS providers_on_user,
      (SELECT (ou.deleted_at IS NOT NULL)::text || '/' || EXISTS (SELECT 1 FROM structured.admin_accounts oa WHERE oa.user_id = ou.id)::text
         FROM identity.identities oi JOIN structured.users ou ON ou.id = oi.user_id
        WHERE oi.provider = 'admin' AND oi.subject = a.login_id AND oi.user_id <> a.user_id LIMIT 1) AS other_user_deleted_hasadmin,
      u.age_gate::text AS age_gate,
      EXISTS (SELECT 1 FROM structured.active_users au WHERE au.id = a.user_id) AS in_active_users,
      u.is_operator,
      (SELECT count(*) FROM identity.sessions s
        WHERE s.user_id = a.user_id AND s.revoked_at IS NULL AND s.expires_at > now())::int AS live_sessions,
      (SELECT to_char(max(s.created_at) AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI')
         FROM identity.sessions s WHERE s.user_id = a.user_id) AS last_session_kst
    FROM structured.admin_accounts a
    JOIN structured.users u ON u.id = a.user_id
    LEFT JOIN structured.admin_accounts maker ON maker.user_id = a.created_by
    ORDER BY a.created_at`);

  console.log(`관리자 계정 ${accounts.length}개`);
  for (const a of accounts) {
    const problems = [];
    if (a.disabled) problems.push('비활성 계정');
    if (!a.hash_shape_ok) problems.push('비밀번호 해시 꼴이 틀림');
    if (a.login_id_has_spaces) problems.push('아이디 앞뒤 공백');
    if (a.identity_rows === 0) problems.push('로그인 신원 없음');
    else if (!a.identity_points_here) problems.push('로그인 신원이 다른 사용자를 가리킴');
    if (!a.activated) problems.push('가입 완료 표시 없음');
    if (a.user_deleted) problems.push('연결된 사용자가 탈퇴 처리됨(deleted_at)');
    if (!a.in_active_users) problems.push('active_users에 없음');
    console.log(
      [
        `- ${a.login_id}`,
        `등급 ${a.role}`,
        `생성 ${a.created_kst} KST(${a.created_by ?? '부트스트랩'})`,
        `연령 ${a.age_gate}`,
        `사용자 신원 ${a.identities_on_user}개(${a.providers_on_user ?? '없음'})`,
        `아이디 신원이 가리키는 다른 사용자(탈퇴/관리자계정) ${a.other_user_deleted_hasadmin ?? '-'}`,
        `유효 세션 ${a.live_sessions}`,
        `마지막 세션 ${a.last_session_kst ?? '없음'}`,
        problems.length ? `문제: ${problems.join(' · ')}` : '문제 없음',
      ].join(' | ')
    );
  }

  const { rows: throttle } = await client.query(`
    SELECT count(*)::int AS keys,
           coalesce(max(failure_count), 0)::int AS max_failures,
           count(*) FILTER (WHERE window_started_at > now() - interval '15 minutes')::int AS active_windows
    FROM structured.admin_login_attempts`);
  const t = throttle[0];
  console.log(`로그인 실패 제한: 키 ${t.keys}개 · 최대 실패 ${t.max_failures}회 · 15분 안에 살아 있는 창 ${t.active_windows}개`);

  const { rows: supers } = await client.query(
    `SELECT count(*)::int AS n FROM structured.admin_accounts WHERE role = 'super' AND disabled_at IS NULL`
  );
  console.log(`활성 슈퍼 관리자(표에 저장) ${supers[0].n}명 — 0이면 환경변수 부트스트랩 계정만 슈퍼로 통한다`);

  await client.query('ROLLBACK');
} finally {
  await client.end();
}

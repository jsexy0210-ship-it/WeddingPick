/*
 * 마지막 슈퍼 보호 트리거를 「슈퍼를 줄이는 변경」에만 건다(2026-09-25).
 *
 * 0102의 `keep_one_super_admin`은 admin_accounts의 **모든** UPDATE·DELETE 뒤에 활성
 * 슈퍼 수를 세고 0이면 막았다. 표에 저장된 슈퍼가 한 명도 없는 운영(부트스트랩
 * 환경변수 계정만 슈퍼로 통하는 상태)에서는 그 수가 늘 0이라, 뷰어 계정을 끄거나
 * 지우는 일까지 전부 「마지막 슈퍼 관리자는 내리거나 끌 수 없다」로 막혔다.
 *
 * 지키려던 것은 「슈퍼가 있던 표에서 마지막 슈퍼가 사라지는 것」이다. 그래서 바뀌기
 * 전 줄(OLD)이 켜진 슈퍼였을 때만 센다. 뷰어·운영자 계정의 변경·삭제는 세지 않는다.
 *
 * 2026-09-25 대표 지시 「관리자도 삭제 가능하도록 한다」 — 삭제 라우트가 이 트리거를
 * 그대로 거친다.
 */
CREATE OR REPLACE FUNCTION structured.keep_one_super_admin() RETURNS trigger AS $$
DECLARE remaining integer;
BEGIN
  IF OLD.role <> 'super' OR OLD.disabled_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO remaining
  FROM structured.admin_accounts
  WHERE role = 'super' AND disabled_at IS NULL;

  IF remaining = 0 THEN
    RAISE EXCEPTION '마지막 슈퍼 관리자는 내리거나 끌 수 없다'
      USING ERRCODE = 'raise_exception';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION structured.keep_one_super_admin() IS
  '켜진 슈퍼 관리자를 줄이는 변경(내리기·끄기·지우기)이 활성 슈퍼를 0명으로 만들면 막는다. 라우트가 아니라 표가 막는 마지막 방어선.';

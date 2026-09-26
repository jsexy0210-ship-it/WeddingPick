-- 0439: 배우자 초대 코드를 4자리 숫자로 바꾼다(2026-09-26 대표 지시 「초대 코드 6자리 → 4자리」).
--
-- **대기 중인 옛 코드는 여기서 취소한다 — 기한까지 살려 두지 않는다.**
-- 앱 입력칸 · API 계약(`acceptInviteRequestSchema`)이 이제 4자리만 받는다. 6자리 코드를
-- 기한(72시간)까지 받으려면 입력칸 · 검증 · 문구를 두 벌로 들고 있어야 하는데, 그
-- 사흘을 위해 두 형식을 섞는 것보다 한 번에 끊는 편이 단순하고 틀릴 자리가 없다.
-- 코드는 서버가 해시만 들고 있어 다시 보여줄 수 없으므로(0010), 취소된 초대의
-- 주인은 배우자 화면을 열면 새 4자리 코드를 바로 받는다(대기 중인 초대가 없으면
-- 화면이 새로 만든다). 받는 쪽에게는 「4자리」 안내가 뜬다.
--
-- **어느 줄이 옛 코드인지는 해시로 가린다.** 원문이 없지만 4자리는 1만 가지뿐이라
-- 그 1만 개의 SHA-256을 여기서 만들어 대 본다 — 그 안에 없는 대기 줄이 옛 코드다.
-- 그래서 API가 이 마이그레이션보다 먼저 배포돼 이미 4자리 코드를 낸 뒤라도 그 줄은
-- 건드리지 않는다(배포 순서와 무관하다). 해시 규칙은 API `hashCode`와 같다 —
-- 코드 문자열의 UTF-8 바이트 SHA-256, 소문자 16진수.

UPDATE structured.wedding_invites
   SET status = 'revoked',
       revoked_at = now()
 WHERE status = 'pending'
   AND code_hash NOT IN (
     SELECT encode(sha256(convert_to(lpad(n::text, 4, '0'), 'UTF8')), 'hex')
       FROM generate_series(0, 9999) AS n
   );

-- 코드 해시의 꼴. 원문 길이는 DB가 볼 수 없으므로(해시만 둔다) 자리 수는 계약과
-- 도메인(`INVITE_CODE_PATTERN`)이 막고, DB는 «해시가 아닌 것»이 들어오는 것을 막는다.
ALTER TABLE structured.wedding_invites
  ADD CONSTRAINT wedding_invites_code_hash_is_sha256_hex
  CHECK (code_hash ~ '^[0-9a-f]{64}$');

-- 대기 중인 줄끼리 코드가 겹치지 않는다는 0435의 부분 유일 색인은 그대로 둔다 —
-- 1만 가지에서는 겹칠 일이 6자리보다 백 배 잦아 그 색인이 더 중요해졌다.
-- 입력 실패 제한(`invite_code_attempts`)도 그대로다.

COMMENT ON TABLE structured.wedding_invites IS
  '배우자 초대. 코드는 4자리 숫자(0439)이고 해시로만 남는다. 한 웨딩에 살아 있는 초대는 하나뿐이다.';

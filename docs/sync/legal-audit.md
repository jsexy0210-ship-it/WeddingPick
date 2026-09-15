# 약관·방침 감사

방침 정본은 `apps/web/src/subpages.ts` 하나다(2026-09-11 대표 지시 — 「웹사이트 기준으로
수정하라. 모든 약관은 여기서 컨트롤한다」). 이 문서는 **거기 적힌 문장과 코드가 실제로 하는
일을 하나씩 맞대어 본 기록**이다. 코드는 고치지 않는다. 재고 적는다.

판정은 셋뿐이다 — **같다 · 다르다 · 못 봤다.** 애매모호 표현은 쓰지 않는다.

---

## 2026-09-15 11:54 KST — 1차 감사

**본 것:** `apps/web/src/subpages.ts` 네 표(제1항 수집 항목 · 제4항 수탁자 · 제5항 국외 이전 ·
보유기간) · `packages/db/migrations/` · `apps/api/src/auth/` · `apps/api/src/analysis/` ·
`apps/api/src/retention/` · `render.yaml` · `infra/render-env.yml` · `apps/web/src/legal-pages.test.ts` ·
`apps/mobile/src/app/(tabs)/my/privacy.tsx` · `apps/api/src/push/expo.ts` ·
`apps/api/src/storage/s3.ts`

**기준 커밋:** `ecd114a` (main)

**결과:** 다르다 셋 · 같다 다섯 · 못 봤다 다섯.

---

### 다르다 ① — 방침에 없는 항목을 저장한다 (실명 · 성별 · 휴대전화번호)

**방침 문장** (`apps/web/src/subpages.ts:362-363`, 제1항)

> 회원가입·계정 관리 … 「소셜 제공자, 제공자별 회원 식별자, 연령대, 필수 동의 이력,
> 만 14세 이상 확인 결과·확인 시각, 가입·활성화 일시」
> 카카오 로그인 프로필 … 「**이메일, 프로필(닉네임·프로필 사진)**」

**코드 사실**

- `apps/api/src/auth/sessions.ts:193-206` `identityValues()`가 `identity.identities`에 넣는 값은
  provider · subject · email · **name** · nickname · profile_image_url · **gender** · birthday(null) ·
  age_range(null) · birth_year(null) · **mobile** 열둘이다.
- `birthday` · `age_range` · `birth_year` 셋은 `null`로 고정돼 있다. **`name` · `gender` ·
  `mobile` 셋은 제공자가 주면 그대로 들어간다.**
- 넣는 값의 출처는 `apps/api/src/auth/identity-provider.ts:94-99`(OIDC 공용 — 카카오 · 애플 ·
  구글이 쓴다)와 `:164-171`(네이버)이다. 둘 다 `name` · `gender` · `phone_number`/`mobile`을 읽는다.
- **실명이 실제로 들어온 적이 있다.** `apps/api/src/auth/sessions.ts:73-76` 주석: 「실명(`name`)으로는
  절대 채우지 않는다 — 카카오 실명이 홈 히어로에 그대로 뜨고 있었다」. 화면에 쓰지 않기로 한
  것이고, **저장을 그만둔 것이 아니다.**

**판정: 다르다.** 방침 제1항 어느 칸에도 실명 · 성별 · 휴대전화번호가 없는데 저장 경로가 살아
있고, 실명은 실제로 들어왔다.

**연령대 쪽은 같다.** 방침은 「연령대는 가입 판정 직후 버리고 저장하지 않습니다」라고 두 번
적었고(제1항 · 제8항), 코드가 `null`로 고정해 지킨다(`sessions.ts:203-205`). 칸은
`packages/db/migrations/0059_social_profile.sql:7-9`에 남아 있지만 채우는 경로가 없다.
카카오에는 `property_keys: '["kakao_account.age_range"]'`로 연령대만 달라고 한다
(`identity-provider.ts:300`).

---

### 다르다 ② — 「백그라운드 처리도 운영 API 안에 있다」

**방침 문장** (`apps/web/src/subpages.ts:402`, `:421`, 제5항)

> 국가 칸: 「싱가포르(**운영 API 및 백그라운드 처리**) · 전 세계(정적 웹 전송망, 사업자 소재지: 미국)」
> 표 아래: 「… Render의 운영 API와 Neon의 정보 저장소는 싱가포르 리전을 사용하며,
> **백그라운드 처리도 같은 운영 API 안에서 이루어져** 싱가포르 리전에 있습니다.」

**코드 사실 — 저장소 안에서 근거 두 벌이 서로 어긋난다**

| 자리 | 적힌 것 |
| --- | --- |
| `render.yaml:264-271` | `weddingpick-worker`가 **별도 서비스**로 선언돼 있다(`type: worker` · `runtime: docker` · `dockerCommand: npm run worker` · `autoDeploy: false`). 운영 API 안이 아니다 |
| `CLAUDE.md` 배포 구조 표 | 「Render **다섯** 서비스 전부 branch=main · autoDeploy=false」 — 워커를 있는 것으로 센다 |
| `apps/api/src/index.ts:105-106` | 「그 프로세스는 한 번도 배포된 적이 없다 — **`render.yaml`에 `type: worker` 서비스가 없었다**」 |
| `apps/web/src/legal-pages.test.ts:64-66` | 「워커 프로세스는 배포된 적이 없어 루프가 운영 API 프로세스 안에서 돈다」 |

`index.ts:105-106`의 근거가 지금 `render.yaml`에서 틀렸다. `render.yaml:264`에 `type: worker`
서비스가 **있다.**

**리전을 적은 줄이 저장소에 한 줄도 없다.** `render.yaml` 전체에 `region:` 키가 없고, Render는
지정이 없으면 기본 리전에 만든다. 방침이 말하는 싱가포르는 저장소 어디에도 고정돼 있지 않다.

**거짓을 지키는 시험이 다시 있다.** `apps/web/src/legal-pages.test.ts:87`이
`'싱가포르(운영 API 및 백그라운드 처리)'`를 문자열로 기대한다. 2026-09-09에 같은 일이 났다 —
방침 문장이 사실과 어긋났는데 그 문장을 지키는 시험이 붙어 있어, 고치려 하면 빨개져서
되돌리게 된다.

**판정: 다르다.** 「백그라운드 처리도 같은 운영 API 안에서 이루어져」는 `render.yaml`이 별도
워커 서비스를 선언하고 있는 한 성립하지 않는다.

**못 봤다:** `weddingpick-worker`가 Render에 실제로 배포돼 도는지, 그 리전이 어디인지.
Render 콘솔을 보지 않았다. `docs/render-region-move.md:7-9`(2026-09-13 마스터 확인)은 「별도
워커는 **Oregon**」이라고 적었고, `legal-pages.test.ts:64-66`은 「2026-09-14에 없앴다」고 적는다.
**둘 중 어느 쪽이 지금인지 저장소만 봐서는 알 수 없다.**

---

### 다르다 ③ — Google Files API 사본의 삭제를 검증할 수단이 없다

**방침 문장** (`apps/web/src/subpages.ts:427`, 제10항 안전성 확보조치)

> 「상담 녹음 원본의 접근 제한과 **읽어내기 직후 삭제 검증**」

**코드 사실**

- 큰 녹음은 Google Files API에 올려서 참조로 넘긴다
  (`apps/api/src/analysis/consultation-reader.ts:129-137` · `needsFilesApi`). 작은 녹음은
  본문에 실어 보내므로 저쪽에 사본이 남지 않는다.
- 지우는 자리는 있다. `:161-174` `finally`가 읽었든 실패했든 `deleteGeminiFile()`을 부른다.
  주석도 「저쪽은 48시간 뒤에 지우지만 그것을 기다리지 않는다」고 적었다.
- **실패를 받는 사람이 없다.** `:173`이 `if (!gone) onDeleteFailed?.(uploaded.name)`으로
  알리는데, `onDeleteFailed`가 저장소 전체에서 나오는 자리는 **선언(`:95`)과 이 호출(`:173`)
  둘뿐이다.** 부르는 쪽이 콜백을 넘기지 않아 `?.`가 아무 일도 하지 않는다.
- 다시 지우러 가는 경로도 없다. 파기 워커는 `audio_key`(우리 저장소)만 보고 돈다
  (`retention/consultation-audio.ts:38-44`) — 남의 저장소에 남은 사본은 조회 대상이 아니다.

**판정: 다르다.** 삭제를 **시도**하는 코드는 있고 그 부분은 방침대로다. 그러나 제10항이
적은 것은 「삭제 **검증**」이고, 실패가 아무 데도 남지 않으므로 검증할 수단이 없다.
주석이 「실패는 조용히 넘기지 않고 부르는 쪽이 알 수 있게 남긴다」고 적었는데 **부르는 쪽이
받지 않는다.**

**우리 저장소 쪽은 검증 수단이 있다** — `countOverdueConsultationAudio()`
(`retention/consultation-audio.ts:74-79`)가 밀린 건수를 세고 운영 화면이 그 숫자를 본다.
「0이 정상이다」라고 적혀 있다. 남의 저장소 쪽에만 그 눈이 없다.

**보존기간 자체는 어긋나지 않는다.** 방침 제5항 Google LLC 행은 「보존기준은 사업자가
공개한 정책을 따르며, 회사 저장소의 원본 삭제 일정과는 별도입니다」라고 적었다. 삭제가
실패해 저쪽 기본값(48시간)까지 남더라도 그 문장 안이다. 어긋나는 것은 제10항의 「검증」이다.

---

### 마감이 사흘 뒤다 — 시행일 2026-09-18

`infra/render-env.yml:66` · `:88` `LEGAL_PRIVACY_EFFECTIVE_ON: '2026-09-18'`.
같은 파일 `:62-64`가 적어 둔 것: 「**이 날짜는 마감이다** — 그날까지 API가 싱가포르에 있어야
방침과 사실이 맞는다. 이전이 늦어질 것 같으면 서버를 서두르지 말고 이 값을 미룬다.」

국외 이전만은 고지가 이전보다 먼저다(개인정보보호법 제28조의8 · `CLAUDE.md`). 지금 저장소가
가진 것은 **고지 문안**이고, **이전 완료를 증명하는 것은 저장소에 없다.** 시행일이 지난 뒤에도
사실이 문안과 다르면 그 구간이 그대로 어긋난 고지가 된다.

**판정: 못 봤다.** 사흘 안에 리전을 확인하고, 안 맞으면 날짜를 미루는 쪽이 절차서가 정한
순서다(`docs/render-region-move.md` §0 · §7).

---

### 같다 ① — 담을 칸이 없다

**방침 문장** (`apps/web/src/subpages.ts:374`, 제2항)

> 「녹음을 글로 옮긴 녹취록은 만들지 않고 보관하지도 않으며, 금액 항목의 근거로 40자 이내의
> 짧은 인용만 남깁니다. **전화번호·계좌번호·카드번호·주민등록번호를 담는 항목 자체를 두지 않습니다.**」

**코드 사실**

- `apps/api/src/analysis/consultation-spec.ts`에 전화번호 · 계좌번호 · 카드번호 · 주민등록번호
  칸이 없다. 녹취록 칸도 없다.
- 40자는 **부탁이 아니라 스키마다** — `:38` `const EVIDENCE_MAX = 40`, `:45-47`
  `z.string().max(EVIDENCE_MAX).nullable()`. 지시문(`:414`)에도 같이 적혀 있지만, 넘치면
  스키마에서 막힌다.
- `packages/db/migrations/0330_consultation_records.sql`에 해당 열이 없다.

**판정: 같다.**

**한 가지 적어 둔다.** `0330`의 `common` · `category_data` · `after_data`는 `jsonb`다. 열로는
칸이 없지만 `jsonb`는 무엇이든 담을 수 있는 그릇이라, 실제로 막는 것은 `consultation-spec.ts`의
스키마 하나뿐이다. **그 파일에 칸을 더하면 그날로 담긴다.** 이 자리를 매번 본다.

`packages/db/migrations/0022_payment_proofs.sql:31-35`의 `card_number` · `phone` ·
`account_number`는 담는 칸이 아니라 **가릴 것의 목록**이다. 방침 제2항 「카드번호, 승인번호,
계좌번호, 제3자 성명·연락처 등 통계에 불필요한 정보는 기기와 서버 단계에서 가림 또는
삭제합니다」와 같은 자리다. **같다.**

Npay 수령(`packages/db/migrations/0092_reward_payouts.sql:22-38`)은 `recipient_phone`을
`status = 'requested'`인 동안만 두도록 CHECK 두 개가 강제한다
(`payout_phone_only_while_requested` · `payout_phone_deletion_dated`). 보내고 나면 번호가
`NULL`이어야 하고 `phone_deleted_at`이 차 있어야 한다. **같다.**

---

### 같다 ② — 원본 파기의 순서와 모드

**방침 문장** (`apps/web/src/subpages.ts:374`, 제2항)

> 「상담 녹음 원본은 읽어내기가 끝나는 즉시 삭제하며, 이용자가 결과를 확인하지 않아 처리가
> 끝나지 않은 경우에도 업로드 시점부터 24시간을 넘겨 보관하지 않습니다.」

**코드 사실**

- **파일부터 지우고 표를 나중에 비운다.** `apps/api/src/retention/consultation-audio.ts:51-63` —
  `storage.delete(row.audio_key)`가 먼저, 그 뒤에 `audio_key = NULL, audio_deleted_at = now()`.
  실패하면 표를 건드리지 않아 다음 차례에 다시 잡힌다. 순서가 뒤집히면 「지웠다고 적혔는데
  파일은 남은」 줄이 생기고 그 줄은 다시 조회되지 않는다 — 그 자리를 코드가 지킨다.
- **`manual` 모드에서도 돈다.** `apps/api/src/worker-loops.ts:100-115` — `sweepExpiredDocuments`는
  `automatic`일 때만 부르지만, `sweepExpiredConsultationAudio`는 모드 밖에서 무조건 부른다.
  방침 문장에 조건이 없으므로 코드도 조건을 두지 않았다.
- 깃발을 따로 두지 않는다 — `audio_key`가 남은 줄이 곧 지울 줄이다
  (`consultation-audio.ts:22-27`).

**판정: 같다.**

---

### 같다 ③ — 사본이 다시 생기지 않았다

- 앱의 방침 화면 `apps/mobile/src/app/(tabs)/my/privacy.tsx`(166줄)는 요약 셋만 두고 전문을
  들지 않는다. 수탁자 이름 · 국외 이전 표 · 조문 번호가 없다.
- `apps/mobile/src/app/(tabs)/my/policies.tsx:37`은 `openExternal(policy.url)`로 웹 전문으로
  내보낸다. 앱 안에 본문을 두지 않는다.
- 2026-09-09에 사고가 났던 문장 「위탁 업체는 확정 후 명시해요」는 `privacy.tsx:24-25`에
  **주석으로만** 남아 있다. 화면 문구가 아니라 그때 무슨 일이 있었는지를 적어 둔 자리다.
- 관리자(`apps/admin`)에 전문 사본이 없다.

**판정: 같다.**

앱 요약(`privacy.tsx:51-53`)은 「읽어내는 일은 국외(미국)의 외부 서비스가 맡아요. 서비스
서버와 저장 공간도 국외에 있고…」로 리전을 적지 않고 「국외」로만 말한다. 방침 제5항이
싱가포르로 바뀌어도 앱 요약이 낡지 않는 모양이다. **어긋나지 않는다.**

---

### 같다 ④ — 네이버클라우드와 Expo

**네이버클라우드** — 방침 제4항은 「클라우드·객체 저장 / 서비스 정보 및 업로드 원본의
시한부 저장 / 네이버클라우드 주식회사」로 적고, **제5항 국외 이전 표에는 넣지 않았다.**
`render.yaml:285-288`이 `S3_REGION: kr-standard` · `S3_ENDPOINT: https://kr.object.ncloudstorage.com`
로 국내를 가리킨다. 국내 저장이므로 국외 이전 표에 없는 것이 맞다. 앱 요약
(`apps/mobile/src/app/(tabs)/my/privacy.tsx:52-53`)도 「원본 이미지는 국내 저장소에 둬요」로
같이 적는다. **같다.**

**Expo** — 방침 제5항 Expo 행은 「기기 푸시 토큰과 알림 제목·본문」 셋이다.
`apps/api/src/push/expo.ts:54-58`이 `https://exp.host/--/api/v2/push/send`로 보내는 본문은
`to`(토큰) · `title` · `body` 셋이다. **더도 덜도 없다. 같다.**

---

### 같다 ⑤ — 시크릿

`sk-ant-` · `AIza` · `ghp_` · `xox[baprs]-` · 자격이 박힌 `postgres://` 주소를 저장소 전체에서
찾았다. 걸린 일곱 자리는 전부 `localhost` · `127.0.0.1` 자리표시이거나 문서의 예시다 —
`packages/db/README.md:8` · `.github/workflows/main.yml:52` · `.github/workflows/public-data.yml:93` ·
`apps/api/src/public-data/run.test.ts:42`·`:58` · `apps/api/.env.example:2` ·
`docs/session-prompt.md:242` · `docs/codex-handoff.md:272`.

**실제 값은 없다. 판정: 같다.** (값은 이 문서에 옮기지 않는다.)

---

### 못 본 것 — 다음 주기에 본다

1. Render · Neon의 **실제 리전**. 콘솔을 보지 않았다.
2. `weddingpick-worker`가 실제로 배포돼 도는지. `render.yaml`은 선언하고 두 주석은 없다고 적는다.
3. 카카오 동의항목에서 **성별 · 휴대전화번호가 실제로 넘어오는지.** 카카오 콘솔을 보지 않았다.
   (실명은 넘어온 적이 있다 — `sessions.ts:73-76`이 증거다.)
4. `deleteGeminiFile()` **실패 경로**. 남은 사본을 다시 지우러 가는 자리가 있는지.
5. 제4항 수탁자 여섯 중 **Anthropic PBC**가 부르는 자리. `apps/api/src/index.ts:59`가
   `createClaudePaymentReader()`를 쓰는 것까지는 봤고, 보내는 항목이 제5항 문안과 맞는지는
   따라가지 않았다.

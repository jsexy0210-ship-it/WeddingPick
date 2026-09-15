# main 누락 감사

main에 올라간 것과 **올라갔어야 하는 것**을 나란히 재는 자리다. main에 코드를 얹는 것은
MASTER 하나뿐이고, 한 사람만 올리면 빠뜨려도 잡아줄 사람이 없다 — 그 자리를 이 문서가 맡는다.

적는 법은 **날짜 · 무엇을 쟀는지 · 나온 숫자 · 판정** 넷이다. 판정은 「누락 있음」과
「누락 없음」 둘뿐이고, 못 잰 것은 **「못 쟀다」고 적는다** — 확인하지 않은 「누락 없음」이
이 문서가 할 수 있는 가장 나쁜 일이다. 「거의」 「대략」 같은 말은 쓰지 않는다.

재는 것은 손이 아니라 스크립트다.

| 스크립트 | 재는 것 |
| --- | --- |
| `node scripts/check-main-ledger.mjs` | 열린 PR이 main과 몇 커밋 · 몇 파일 떨어져 있는지, 그중 이미 main에 든 것이 몇 개인지 |
| `node scripts/check-icon-colors.mjs` | 커밋된 아이콘 PNG가 심볼 원본과 같은 색인지 |
| `node scripts/sync-seed-tokens.mjs --check` | `spec/seed-tokens.json`이 SEED와 같은지 |
| `cd apps/api && npx jest src/test/tokens.test.ts src/test/seed-parity.test.ts src/test/mockup-parity.test.ts` | 토큰 · 테마 · 목업 값이 갈라졌는지 |

---

## 2026-09-15 11:06 KST — 1회차

기준: `origin/main` = `5af049ac` (PR #232 머지 커밋, 2026-09-15 10:56 KST).

### 판정 — 누락 있음 (3건)

| # | 무엇 | 어느 파일 | 커밋 |
| --- | --- | --- | --- |
| 1 | OG 카드 그림만 옛 색으로 남았다 | `apps/web/public/assets/weddingpick-og.png` | `d1edba0f` |
| 2 | 코랄 복귀 대표 지시가 규칙 파일 하나에만 들어갔다 | `docs/session-prompt.md` · `docs/codex-handoff.md` | `d1edba0f` |
| 3 | 토큰 값은 되돌아왔는데 그 값의 출처를 적은 줄은 안 되돌아왔다 | `spec/tokens.json` `color.brand.$rule` · `$source` · `$derivation` | `d1edba0f` |

셋 다 **뿌리가 같다.** `d1edba0f`(2026-09-15 01:25 KST, 「브랜드색을 코랄 정본으로 되돌린다」)가
값은 되돌렸는데 **그 값을 베껴 간 자리 셋을 같이 되돌리지 않았다.**

---

### 1. 브랜치에 남은 것

`node scripts/check-main-ledger.mjs`

| PR | 브랜치 | main보다 앞선 커밋 | 뒤진 커밋 | 가져올 파일 | 아직 다름 | 이미 반영 |
| --- | --- | --- | --- | --- | --- | --- |
| #133 | `claude/weddingpick-data-collection-q72atr` | 14 | 288 | 11 | 9 | 2 |
| #135 | `claude/data-collect-refine-d1d3` | 1 | 297 | 8 | 7 | 1 |
| #142 | `claude/alimtalk-channel` | 4 | 296 | 13 | 13 | 0 |
| #206 | `claude/perf-audit` | 20 | 139 | 7 | 7 | 0 |
| #216 | `claude/public-data-unify` | 3 | 133 | 7 | 7 | 0 |
| #223 | `claude/image-no-hotlink` | 4 | 124 | 10 | 9 | 1 |
| #230 | `claude/policy-gemini-audio` | 3 | 121 | 7 | 7 | 0 |
| #231 | `claude/approval-queue` | 7 | 121 | 1 | 1 | 0 |
| #233 | `claude/report-manual-entry` | 3 | 121 | 18 | 18 | 0 |
| #234 | `claude/rn-preview` | 19 | 90 | 96 | 74 | 22 |
| #235 | `claude/figma-pixel-parity` | 10 | 11 | 24 | 24 | 0 |
| #236 | `claude/design-policy-audit` | 7 | 9 | 140 | 29 | 111 |

열린 PR 12건의 head SHA는 **전부 원격 브랜치 끝과 같다** — 로컬만 앞서 있는 PR은 없다.

읽는 법을 적어 둔다. **「이미 반영」은 그 PR이 들고 있다고 말하는 파일 중 main에 이미 같은
내용으로 들어가 있는 것**이다. #236은 140 중 111이 이미 들어가 있어 실제로 남은 것은 29개고,
#234는 96 중 22가 이미 들어가 있다. 두 PR은 **보이는 것보다 작다.** 반대로 #142 · #206 ·
#216 · #230 · #233 · #235는 이미 반영이 0이라 **통째로 남아 있다.**

**「뒤진 커밋」이 큰 PR은 머지 전에 main을 먼저 받아야 한다.** #135는 297, #142는 296,
#133은 288 뒤져 있다. 이 셋은 리뷰가 아니라 충돌 해결부터 시작한다.

판정: **누락 없음.** 브랜치에 남아 있는 것은 아직 PR이 열려 있는 것이고, main에 들어갔어야
하는데 브랜치에 남은 것은 없다.

### 2. 머지가 파일을 삼켰는지

PR #232 (머지 커밋 `5af049ac` · head `ffa199f0` · base `main`):

| 잰 것 | 값 |
| --- | --- |
| PR이 적은 `changed_files` | 183 |
| main이 실제로 받은 파일 (`git diff 5af049ac^1 5af049ac`) | 183 |
| PR이 가져오려던 파일 (`git diff $(git merge-base) ffa199f0`) | 183 |
| 183개 중 main 트리에 없는 것 | 0 |
| 삭제됐어야 하는데 main에 남은 것 | 0 |
| `git rev-list --count origin/main..ffa199f0` | 0 |
| 머지 커밋의 2번째 부모 == PR head SHA | 같음 |
| 커밋 수 (PR 115 + 머지 1) | 116 |

머지 결과와 PR head 트리가 다른 파일은 **3개**(`public.zip` · `static.zip` · `variable.zip`)이고,
셋 다 **main 쪽(`8940b8ad`)에서 지운 것을 브랜치가 건드리지 않아 머지가 main의 삭제를 그대로
유지한 것**이다 — 브랜치 내용이 삼켜진 것이 아니다.

머지된 PR **203건 전부**에 대해 머지 커밋이 main의 조상인지 확인했다: **199건 main에 있음 ·
0건 없음 · 4건 해당 없음**. 해당 없는 넷(#66 · #67 · #68 · #70)은 base가 main이 아니라
`claude/session-a4bq31`이라 애초에 main에 직접 들어갈 커밋이 아니다.

판정: **누락 없음.**

### 3. 마이그레이션

| 잰 것 | 값 |
| --- | --- |
| main의 마이그레이션 파일 수 | 117 |
| `0330_consultation_records.sql` main 존재 | 있음 (6,524바이트) |
| `0340_wedding_feed.sql` main 존재 | 있음 (4,633바이트) |
| 번호가 겹치는 자리 | 2 (`0047` · `0102`) |
| `/health`의 applied · expected | **못 쟀다** |

**번호 겹침은 DDL을 빠뜨리지 않는다.** `packages/db/src/migrate.ts:29`가 적용 키로 쓰는 것은
번호가 아니라 **파일명 전체**(`file.replace(/\.sql$/, '')`)라, `0047_monthly_draw`와
`0047_vendor_data_quality`는 서로 다른 줄로 따로 적용된다. `0102`도 같다.

**빈 번호는 일부러 낸 자리다.** `0052`는 `4be7da78`(「마이그레이션 충돌 및 번호 중복 해소」)에서
치워졌고, `0104`부터 뒤의 빈 자리는 세션마다 번호대를 갈라 주는 규칙(CLAUDE.md)이 낸 것이다.

**열린 브랜치가 들고 있는 새 마이그레이션은 셋이고 서로 겹치지 않는다** —
`0092_public_data_switches_held_count`(#135) · `0094_alimtalk_delivery`(#142) ·
`0240_payment_proof_manual_entry`(#233). 다만 앞의 둘은 main이 이미 쓰고 있는 번호에
파일명을 더하는 꼴이라 번호만 봐서는 어느 것이 먼저인지 알 수 없다.

**`/health`는 못 쟀다.** 이 감사 세션의 바깥 통신을 프록시가 막는다 —
`weddingpickl-sg.onrender.com:443`에 대해 **CONNECT 403**(정책 거부)이 떨어진다. 상태 코드가
아니라 본문의 applied · expected를 읽어야 하는데 본문을 받지 못했다. **main의 파일 수 117이
운영 DB에 실제로 몇 개 적용돼 있는지는 이 문서가 말하지 않는다.**

판정: **파일 쪽 누락 없음. `/health` 대조는 못 쟀다.**

### 4. 생성물과 원본이 갈라졌는지

| 잰 것 | 결과 |
| --- | --- |
| `node scripts/sync-seed-tokens.mjs --check` | `SEED와 같다 (@seed-design/css@2.8.1)` |
| `tokens.test.ts` · `seed-parity.test.ts` · `mockup-parity.test.ts` | 18건 전부 통과 |
| `node scripts/check-icon-colors.mjs` — 생성기가 만드는 PNG 13장 | 13장 전부 같음 |
| 같은 스크립트 — 생성기 밖 자산 2장 | **1장 틀림** |

#### 누락 1 — OG 카드 그림만 옛 색으로 남았다

`apps/web/public/assets/weddingpick-og.png` (1200×630)의 불투명 픽셀 상위 셋:

    e7898d : 612,485
    d88085 : 121,731
    371b34 :  13,100

`#E7898D`와 `#371B34`는 **2026-09-14 하루 동안 쓰였다가 2026-09-15에 폐기된 색**이다.
CLAUDE.md가 그 자리를 이렇게 적는다 — 「2026-09-15 대표 지시로 코랄 정본으로 돌아왔다 —
「기존 정본색상으로 싹다 다시 바꿔. 코랄색으로」. 2026-09-14 하루 동안 `#E7898D` ·
마크 `#371B34`였고」.

되돌린 커밋 `d1edba0f`(2026-09-15 01:25 KST)가 무엇을 했는지 재면 이렇다.

- PNG **12장**을 코랄로 다시 그렸다.
- 같은 그림의 원본인 `apps/web/public/assets/weddingpick-og.svg`도 **코랄로 고쳤다**
  (지금 이 SVG에 든 색은 `#FF6F61` 하나와 `#FFFFFF` 셋뿐이다).
- 그런데 **그 SVG에서 뽑는 `weddingpick-og.png`는 다시 그리지 않았다.**

그래서 **원본 SVG는 코랄인데 실제로 나가는 PNG는 옛 색**인 상태로 main에 있다.
`apps/web/src/social-meta.ts:10`이 그 PNG를 `SHARE_IMAGE`로 내보낸다 — 카카오톡 · 슬랙에
주소를 붙였을 때 뜨는 카드가 이것이다.

**CI가 못 잡은 이유도 쟀다.** 이 PNG를 보는 시험은 둘인데 둘 다 **크기만** 본다 —
`apps/web/src/og-image.test.ts:39`와 `apps/web/src/social-meta.test.ts:27`이 `1200` · `630`만
확인하고 색은 읽지 않는다. 색이 어긋나도 초록으로 지나간다.

다시 그리는 법은 `apps/web/README.md:79`에 적혀 있다.

`scripts/build-app-icons.mjs`가 제 주석에 **「생성기가 없는 자산은 반드시 드리프트한다」**
고 적고 웹 PNG 일곱 장을 제 안으로 들였는데, **OG 그림은 그때 같이 들어가지 않았다.**
지금 생성기 밖에 남은 자산은 둘이다 — `weddingpick-og.png`(틀림)와
`favicon-mono-32.png`(`#212124` 단색 — 코랄을 쓰는 자리가 아니라 이번 복귀와 무관하고, `spec/tokens.json`의 Dark Gray `#191F28`과도 다른 값이라 출처는 못 쟀다).

판정: **누락 있음 1건.**

### 5. 규칙 문서 셋

`CLAUDE.md` · `docs/session-prompt.md` · `docs/codex-handoff.md`는 규칙이 바뀌면 함께 고친다.
최근 30개 변경 중 셋이 함께 바뀐 것과 하나만 바뀐 것을 갈라 세면, 2026-09-14 이후 **하나만
바뀐 것이 7건**이다. 그중 규칙이 실제로 바뀐 것은 하나다.

#### 누락 2 — 코랄 복귀 대표 지시가 `CLAUDE.md`에만 들어갔다

`d1edba0f`가 고친 문서는 `CLAUDE.md`와 `docs/sync/design-policy-audit.md` **둘뿐**이다
(`git show --stat d1edba0f -- CLAUDE.md docs/`). 두 전달문은 건드리지 않았다.

세 파일에서 문구를 세면 이렇다.

| 찾은 말 | `CLAUDE.md` | `session-prompt.md` | `codex-handoff.md` |
| --- | --- | --- | --- |
| `FF6F61` | 3 | **0** | **0** |
| 코랄 | 5 | **0** | **0** |

대신 두 전달문에는 **뒤집힌 줄이 그대로 남아 있다** — `session-prompt.md:41` ·
`codex-handoff.md:39`가 「예식일 휠 3열 · 온보딩 세 질문 · **브랜드색** · 아이콘 모양은 이
목록에서 빠졌다. 피그마대로 간다」고 적는다. 이 줄은 `777dba52`(01:12)가 썼고 13분 뒤
`d1edba0f`(01:25)가 브랜드색을 코랄로 되돌렸다.

**전달문만 읽는 세션은 브랜드색을 피그마에서 가져간다.** 피그마의 그 값이 `#E7898D`이고
(`docs/figma-spec/home.json:126` 등 main에 33개 파일이 그 값을 적고 있다), 그것이 바로
대표님이 「싹 다 다시 바꿔」라고 하신 색이다. 규칙을 지시에 통째로 넣는 이유가 여기 있다 —
「세션은 자기가 받은 지시부터 읽는다」(CLAUDE.md).

**`CLAUDE.md` 자신도 그 줄을 안 고쳤다.** 「앞서 이 자리에 있던 나머지는 빠졌다 — 예식일
휠 3열 · 온보딩 세 질문 · 브랜드색 · 아이콘 모양. 전부 피그마대로 간다」가 남아 있고, 같은
파일 아래 「심볼」 절이 `#FF6F61` 고정이라고 적는다. **한 파일 안에서 두 줄이 어긋난다.**

판정: **누락 있음 1건.**

#### 누락 3 — 토큰 값은 되돌아왔는데 출처를 적은 줄은 안 되돌아왔다

`spec/tokens.json`의 `color.brand` 값은 전부 코랄로 되돌아왔다.

    primary #FF6F61 · primaryPressed #EE6255 · primaryDark #C2453A
    primaryTint #FFE8E4 · primarySurface #FFF5F2 · primaryBorder #FFD9D4 · onPrimary #FFFFFF

그런데 같은 블록의 `$rule` · `$source` · `$derivation` 세 줄은 **`d1edba0f`가 한 글자도 건드리지
않았다**(`git show d1edba0f -- spec/tokens.json`에서 그 세 줄에 걸린 `+`/`-`가 0줄이다).
그래서 지금 이렇게 적혀 있다.

- `$rule`: 「2026-09-14 대표님 확정 — 키 컬러를 **코랄에서** Figma 신규 디자인의 2색 체계로
  **옮겼다**. primary · **accent**는 Figma theme.css 직접값」
- `$source`: `weddingpick_figma @3d1705d` `src/styles/theme.css`

**값과 정반대를 말한다.** 되돌린 방향이 거꾸로 적혀 있고, 출처는 폐기된 피그마 파일을 가리킨다.
게다가 `$rule`이 설명하는 **`accent` · `onAccent` 두 토큰은 `d1edba0f`가 지워서 지금 없다** —
있지도 않은 토큰의 근거가 남아 있다.

CLAUDE.md는 「값(색 · 크기 · 간격 · 문구)은 `spec/tokens.json`에서만 가져온다」고 적고, 값을
더할 때는 「어느 목업의 어느 규칙에서 온 값인지를 `$note`와 주석에 적는다」고 정한다.
**근거를 적는 자리가 틀린 근거를 적고 있으면 다음 사람이 고칠 근거를 잃는다.**

판정: **누락 있음 1건.**

---

### 못 쟀다고 적어 두는 것

- **`/health`의 applied · expected.** 프록시가 `weddingpickl-sg.onrender.com:443`에 CONNECT 403을
  돌려준다. main의 마이그레이션 117개가 운영 DB에 몇 개 적용돼 있는지 이 문서는 모른다.
- **아이콘 PNG의 모양.** `scripts/check-icon-colors.mjs`가 재는 것은 색뿐이다. 심볼의 path가
  틀어진 것은 `scripts/build-app-icons.mjs`를 돌려야 잡히는데, 그것은 Chromium(playwright)이
  있어야 하고 playwright는 이 저장소의 의존성이 아니다.
- **머지된 PR 4건**(#66 · #67 · #68 · #70)의 머지 커밋은 얕은 클론 경계 밖이라 객체를 읽지
  못했다. 넷 다 base가 main이 아니어서 main 누락 판정 대상은 아니다.

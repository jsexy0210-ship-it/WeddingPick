# 지운 루틴 보관 — 2026-09-17

대표님 지시 「지워도 무관하면 지워라」에 따라 죽은 루틴 38개를 지웠다. **지우기 전에
지시문을 여기 옮겼다** — 루틴은 지우면 안에 담긴 글까지 같이 사라지고, 그중 몇은
아직 답을 못 받은 결정이 적혀 있다.

## 지우는 기준

- `next_run_at`이 `0001-01-01`이고 주기도 없다 — **다시 뜰 일이 없는 것.** 한 번
  전달하고 끝나는 쪽지였고 이미 전달됐다.
- 한 번만 돌기로 한 시각이 지났다 — 2026-09-10 ~ 09-16.
- 껐다 — 감시 주기 셋(매시간 · 2시간 · 4시간)은 세션 정리로 볼 것이 없어졌다.

## 남긴 것 일곱

| 루틴 | 왜 남기나 |
| --- | --- |
| PR #223 · #265 · #270 재확인 | 아직 안 닫힌 PR |
| 디자인 정책 감독 22차 | 상시 감독 |
| 공공데이터 API 만료 30일 전(2028-08-09) · 7일 전(2028-09-01) | 만료되면 수집이 통째로 멈춘다 |
| 매일 09:00 메일함 자동 정리 | 대표님 「보류」(2026-09-16) — 꺼진 채로 둔다 |

**#266 · #271 재확인은 지우지 않았는데도 없어졌다** — 한 번만 도는 쪽이라 정리하는
동안(02:43 · 02:44 UTC) 제 시각이 되어 스스로 사라졌다. 지운 38에 들어 있지 않다.

---

## 대표님 답변 전달 — 권장안 진행

- `trig_01QxDSZmJK5WDeQR5zZkEMky` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-17T01:53:31

```
대표님 답변이다. 두 질문 모두 MASTER 권장안대로 진행한다.

1. 상담 녹음 동의문(A-25) → **"둘을 합친다 (권합니다)"로 진행.** main의 「녹취록은 만들지도, 남기지도 않아요」를 유지하고 #230의 「남의 목소리가 같이 담길 수 있어요」 고지를 더한다. 「본인 참여 대화」는 별도 확인으로 뺀다. 판 번호를 올린다.
2. PR #230(방침 Anthropic→제미나이 + 시행일 9/21) → **"바로 태운다 (권합니다)"로 진행.** 동의문 결정과 함께 오늘 묶어서 올린다. 9/18 전에 반영해 틀린 수탁자가 적힌 방침이 시행되는 것을 막는다.

이대로 진행해라.
```

## 복구 알림 — 화면 전수 조사(사용자 103)

- `trig_01RmgYhic46Wyo6iNfp9Yz6d` · 2026-09-17T01:27:00Z · 꺼짐 · 만든 때 2026-09-17T01:18:12

```
MASTER다. `main`이 2026-09-16 23:58 KST 초기화로 **내용이 되돌아갔었다**. **복구했다 — 지금 `main`은 27c287a7이다.**

① `git fetch origin` 후 `origin/main`이 **27c287a7**인지 확인 ② **네 브랜치가 원격에 살아 있는지 확인** — 없으면 밀지 말고 MASTER에게 알려라 ③ `main`을 머지 ④ 이어서 진행, **끝나면 PR을 건다.**

캡처 도구에 `--expand`가 생겼다 — `--full`이 ScrollView 아래를 못 찍고 있었다(반쪽 그림). `node scripts/screenshot-screens.mjs --expand --route "<경로>"`. 접히는 화면은 경고를 내고 스스로 되돌린다.

초록은 네 손으로(브랜치에선 CI 안 돎): typecheck · lint · `node lint-copy.js spec/strings.ko.json apps packages` · jest(`service postgresql start`, `DATABASE_URL=postgres://weddingpick:weddingpick@localhost:5432/weddingpick_test`). `npm test` 종료 코드 말고 `Test Suites:` 줄을 읽어라.

어디까지 했고 뭐가 막혔는지 한 줄로 보고해라.
```

## 피그마 정본 감시 3주기

- `trig_019boDPy8FUfec1F6ZQDCQ9R` · 2026-09-15T07:04:00Z · 꺼짐 · 만든 때 2026-09-15T05:03:26

```
피그마 정본 감시 3주기다. 순서대로 한다.

1. **재기 전에 먼저 `main`을 받는다.** `git -C /home/user/weddingpick fetch origin main` → 브랜치에 머지 → `npm ci` → 재빌드. (클론이 없으면 add_repo 후 다시 받는다. 피그마는 `/home/user/jsexy0210-ship-it/docs/design/figma-export`.)

2. **PR #241 상태 확인.** CI·리뷰·충돌. gh CLI 없음 — `GH_TOKEN`으로 REST API.

3. **2주기에 잡은 것이 고쳐졌는지 다시 잰다.**
   - **거짓 근거와 회귀(제일 급함):** `spec/tokens.json` `spacing.gutter.$note`와 `packages/ui/src/theme.ts:639`의 「피그마 12 화면 전부가 20이다」가 고쳐졌는지. 규격서 실제는 **onboarding `pad 32 24 32 24` · login `pad 64 24 32 24`(24), 나머지 열이 20**이다. 앱 로그인·온보딩이 24로 돌아왔는지 잰다(2주기엔 20이었다).
   - **등급 체계:** `docs/rn-migration/FIGMA_DESIGN_SYSTEM.md`의 A/B등급과 이를 근거로 값을 안 옮긴다는 코드 주석 넷 — `community/index.tsx:34` · `community/feed/[id].tsx:10` · `search/index.tsx:677` · `search/compare.tsx:41` · `HANDOFF_screens-plan.md:14` · `FIGMA_DESIGN_SYSTEM.md:96`.
   - **낡은 규칙 인용:** `step-frame.tsx:31-32` · `region-picker.tsx:15` · `login/index.tsx:56,306`이 바뀌기 전 CLAUDE.md 3번을 가리킨다.
   - **규칙 파일 잔여:** `CLAUDE.md:19-21`(규칙 5 「기존 정본을 확인해」) · `:81` · `:100` · `:133` · `session-prompt.md:29,102,129` · `codex-handoff.md:27,103,144` · `root/README.md:3,24` · `COMPONENT_PARITY.md:20` · `RN_MIGRATION_MAP.md:80` · `VENDOR_SCREEN_PARITY.md:37` · `admin-mockup-parity-v3.27.md:127` · `design-policy-audit.md:21` · 주석 5곳.
   - **피그마 저장소 브랜드색**이 코랄로 바뀌었는지(`docs/design/figma-export`의 `#E7898D`). 바뀌었으면 `extract-figma-export.mjs`로 규격서를 다시 뽑아야 한다.

4. **2주기에 못 잰 것을 잰다.**
   - 업체 상세의 해시태그·소개 본문이 데이터 차이인지 구조 차이인지.
   - 라운지 피드 카드 px(빈 상태다 — 내 측정 스크립트 안에서 `/v1/` 응답을 덧대 잰다. 저장소 fixture는 고치지 않는다).
   - 피그마 `/vendor/1/booking` · `/vendor/1/consult` · `/contract-verify`의 앱 대응 라우트를 찾아 맞춰 찍는다.
   - 온보딩 질문 화면(1/3·2/3·3/3) px — 앱은 인트로를 지나야 나온다(`scratchpad/onb.mjs`가 「다음」을 누른다).
   - 글자색·테두리색 전수 대조.

5. **1·2주기에 「다르다」로 남은 것 재확인.** 홈 추천 카드 ★평점·「인기/신규」 뱃지·「홈 편집」 / 검색 필터 「지역」 vs 「서울」 / Pick 파트너 배너 68 vs 56 / 웨딩노트 eyebrow·「완료」 / 라운지 칩 줄·FAB / 업체 상세 탭 넷 vs 다섯 / 온보딩 인트로 / 영문 eyebrow 13종(C-9) / 파기된 「고지가 먼저」를 근거로 드는 자리.

**방법.** 앱과 피그마를 같은 폭 430으로 둘 다 찍고 `getBoundingClientRect`·`getComputedStyle`로 잰다. 눈으로 코드를 읽은 것은 본 것이 아니다. **조건부 렌더를 갈라 보지 않고 「없다」라고 적지 않는다** — 1주기에 홈 웨딩피드로 그렇게 틀렸다. 스크립트는 `/tmp/claude-0/-home-user/d746cd1f-44d7-540f-97f3-172f945c2b14/scratchpad/`에 `measure.mjs`·`measure-notoken.mjs`·`home-text.mjs`·`onb.mjs`가 있다(컨테이너가 죽었으면 다시 만든다). `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`.

`docs/sync/figma-canon-audit.md`에 3주기를 덧붙이고 `claude/figma-canon-audit`에 커밋·푸시한 뒤 PR #241에 요약 코멘트를 단다. main에 직접 푸시하지 않는다. 판정은 「같다」/「다르다」/「못 쟀다」 셋으로만.

**대표님께 아직 답을 못 받은 것:** 피그마 저장소의 브랜드색을 코랄로 바꿀지(코드는 코랄인데 피그마가 `#E7898D`라, 정본이 피그마인 한 다시 뽑을 때마다 어긋남이 되살아난다).
```

## 감시 21주기 — 피그마 정본 · 코랄 · 브랜치…

- `trig_01L1EGPz2HmtLWpnbAN2owf8` · 2026-09-15T05:37:00Z · 꺼짐 · 만든 때 2026-09-15T04:36:38

```
감시 21주기를 돌아라.

■ **기준 두 개가 바뀌었다 — 이대로 본다**
1. **색: 코랄 #FF6F61 이 정본**(19주기 확인, 09-15 대표 지시). 코랄을 위반으로 올리지 마라. `color.brand.primary` 가 #FF6F61 이 아니면 그때 알린다.
   판정은 JSON 파싱으로: `git show origin/main:spec/tokens.json > /tmp/t.json && python3 -c "import json;d=json.load(open('/tmp/t.json'));print(d['color']['brand']['primary']['value'])"`
   `#E7898D` 는 **토큰 3파일 밖에 값으로 박힌 경우만** 알린다. JSDoc/주석에 규격서를 옮겨 적은 것은 위반 아님(20주기 option-row.tsx 가 그 예).
2. **정본: 피그마다**(20주기, e7b445a9 「기존 정본을 규칙에서 지운다 — 피그마가 정본이다」). 「루트 시안이 정본」 전제는 버린다.
3. **DB 마이그레이션: 「UI 작업이라 있으면 안 된다」 전제를 버린다.** 범위가 상담기록·Gemini까지 넓어졌다. 새 마이그레이션은 **사실만 적고 위반으로 올리지 마라.** 단 번호와 커밋 출처는 적어라. (현재 main: …0210 0230 0231 0330 0340)

■ 깨어나면 먼저
`ls -d /home/user/WeddingPickl` 확인(없으면 재클론 + `git fetch --unshallow`, 보고에 적어라). 그다음:
` ` `
git fetch origin --prune
git branch -r --list 'origin/claude/rn-*' | wc -l    # 8
for b in rn-tokens rn-components rn-nav-auth rn-screens-core rn-screens-plan rn-screens-vendor rn-preview rn-migration-plan; do
  git rev-parse --verify -q origin/claude/$b >/dev/null || echo "사라짐 $b"
done
` ` `
기록 tip: rn-tokens 65996dd1 · rn-components a1855afb · rn-nav-auth 4428f737 · rn-screens-core 03bbefac · rn-screens-plan 013ffe38 · rn-screens-vendor 073f9ca8 · rn-preview 6111b859 · rn-migration-plan 19c8edf0
내용은 이미 main에 있으니 사라져도 유실이 아닐 수 있다 — 사실만 적어라.

■ 20주기(2026-09-15 13:40 KST) 기준선
  origin/main **e7b445a9** · primary #FF6F61 · 전체 원격 브랜치 **37** · rn-* 여덟 생존
  claude/identity-purge 최신 a411cbc9(09-14 20:52 KST) — **14시간째 미커밋**
  main 최근 10커밋 전부 PR 번호 없음(작성자 Claude) — 직접 머지 포함
  열린 PR 현황은 **17주기(10:25 KST) 기준** — 오래됐다. 이번 주기에 한 번 확인해라.

■ 이번 주기 확인
1) 브랜치 생존(위). 2) `git log origin/main --oneline -10`.
3) PR 번호 없는 Claude 커밋 수 — 숫자만 갱신. **MASTER 답이 오면 이 항목을 빼라.**
4) `git log origin/claude/identity-purge --oneline -2` — a411cbc9 위에 커밋이 붙었는가. **되돌릴 수 없는 유일한 건.**
5) 색(위 JSON 파싱) + `git grep -in 'E7898D' origin/main -- apps packages | grep -viE 'spec/tokens.json|theme.ts|design-tokens.ts'` — 주석인지 값인지 보고 판단.
6) `git ls-tree --name-only origin/main packages/db/migrations/ | grep -oE '[0-9]{4}' | sort -u | tail -6` — 새 번호가 생겼으면 파일명과 커밋을 적어라(위반 아님, 사실만).
7) 화면 금지어: `git grep -nE '관심업체|확인된 제보|확인된 정보|네이버페이|NPay|우리 준비|오늘의 Pick' origin/main -- apps/mobile/src apps/web/src` — 규칙 설명 주석은 예외.
8) **PR 조회 한 번 해라**(`list_pull_requests(state=open, perPage 20, fields=[number,draft,head])`). 17주기 이후 안 봤다. 「목록에 없다 = 닫힘」으로 단정하지 말고, 필요하면 `state=closed, fields=[number,state,merged_at,head]` 로 확인 — merged_at 있으면 머지.
9) 브랜치 수 37에서 변화. 새 브랜치는 이름만.
10) MASTER 보고가 있으면 저장소 사실과 대조. **「완료」가 코드인지 문서인지, 선언인지 실제인지 구분해라.**

■ 열려 있는 것 — 번호 유지, 시간만 갱신, 새로 설명하지 마라
  1. identity-purge 커밋 권한 (**되돌릴 수 없음**)
  3. public-data-resume 업종 3건
  7. admin-overhaul 삭제 확인 (미답)
  8. main 직접 푸시 — 의도 확인(세 번 보냄)
  9. 마이그레이션 0330·0340 승인 범위 확인

■ 보고 원칙
달라진 것과 문제만. 변화 없으면 대여섯 줄. PR이 닫힌 것을 보면 곧바로 「유실」로 쓰지 말고 그 작업이 main에 들어갔는지 **파일로 먼저 확인**해라(17주기 교훈). 브랜치 소실은 예외로 무조건 알린다. **기준이 또 바뀐 정황이 보이면 위반으로 올리기 전에 근거 문서를 먼저 읽어라** — 19·20주기에 색과 정본이 연달아 뒤집혔다.

MASTER(session_01RHos8CRUgW7VXAnxs2BwjD)에만 보고. create_trigger 에 persistent_session_id + run_once_at(2~3분 뒤 UTC). SendMessage 는 클라우드 세션에 안 닿는다. MCP 이름이 바뀌면 ToolSearch 로 불러라. **대표님께 직접 보내지 않는다.** 이상 없으면 보내지 말고 다음 주기를 send_later 로 **60분** 뒤에 건다. 코드는 절대 고치지 않는다.
```

## PR #240 · main 변화 재확인

- `trig_01TdQGGU3x6t4gKAUnjK5y3e` · 2026-09-15T05:23:00Z · 꺼짐 · 만든 때 2026-09-15T04:22:12

```
PR #240(claude/order-ledger)의 head SHA CI · merge 상태 · 리뷰 코멘트를 확인한다. 빨간불이나 충돌이면 고쳐서 푸시한다. 그리고 origin/main이 대장의 기준 커밋에서 더 나아갔으면 새 커밋을 읽어 오더 8(관리자 웨딩피드 라우트·화면) · 15(docs/sync/main-integrity-audit.md) · 1·7·17(캡처 증거) · 9(CategoryIcon)의 판정이 바뀌었는지 다시 재고, 바뀌었으면 docs/sync/order-ledger.md를 갱신해 푸시한다. 바뀐 것이 없으면 조용히 다음 확인만 다시 잡는다. PR이 병합되거나 닫혔으면 감시를 끝낸다.
```

## identity-purge — 작업 보존 지시

- `trig_01BonSS3h2ogM9NL6APhfWno` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-15T00:34:07

```
MASTER입니다. **지금 당장 이것부터 하십시오. 다른 작업은 멈추십시오.**

당신의 14개 파일 수정과 마이그레이션 0250이 **커밋 안 된 채로 10시간째** 서 있습니다. 이 컨테이너는 언제든 교체될 수 있고, 실제로 오늘 다른 세션 하나가 그렇게 교체돼 작업 디렉터리가 초기화됐습니다. **교체되면 당신 작업은 그대로 사라집니다.** 원격에는 읽기 전용 스크립트와 보고서 두 개뿐입니다.

아래를 순서대로 시도하고, 되는 것이 나오면 거기서 멈추고 보고하십시오.

## 1. 커밋을 한 번 더 시도하십시오

` ` `
git add -A
git commit -m "<무엇을 어디까지 했는지>"
git push -u origin claude/identity-purge
` ` `

막히면 **오류 메시지 전문을 그대로 적으십시오.** 「막혔다」로만 보고하지 마십시오 — 무엇이 막았는지가 다음 수를 정합니다.

## 2. 안 되면 — 패치를 파일로 뽑아 대표님께 보내십시오

` ` `
git add -A
git diff --cached > /tmp/identity-purge.patch
wc -l /tmp/identity-purge.patch
` ` `

그다음 **SendUserFile 도구로 `/tmp/identity-purge.patch`를 보내십시오.** 파일이 대화에 남으면 컨테이너가 교체돼도 살아남습니다. 캡션에 「커밋이 막혀서 패치로 뽑았습니다 — MASTER가 받아 올립니다」라고 적으십시오.

## 3. 그것도 안 되면 — 답변 본문에 그대로 찍으십시오

`git diff --cached`의 출력을 **당신 답변 안에 통째로 붙이십시오.** 길어도 괜찮고 여러 번 나눠 답해도 됩니다. 전사에 남으면 복구할 수 있습니다.

## 어느 경우든 같이 보고할 것

- **마이그레이션 번호가 0250이 맞는지 다시 확인하십시오.** 번호가 겹치면 하나는 적용 기록만 남고 DDL이 조용히 빠집니다 — 2026-09-10에 0102가 겹쳐 시험 셋이 깨졌습니다. `ls packages/db/migrations | sort | tail -20`으로 확인하고, 겹치면 비어 있는 번호로 옮긴 뒤 그 사실을 적으십시오.
- 14개 파일이 각각 무엇인지 한 줄씩.
- 끝난 것과 하다 만 것.

**추정하지 말고 실제로 돌려 보고 결과를 적으십시오.** 「될 것 같다」는 보고가 아닙니다.
```

## 피그마 패리티 — 모델 교체 인수인계

- `trig_017m6uZjKbrXqVmrsYTAZHZ3` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-15T00:25:22

```
MASTER입니다. **대표님 지시로 이 일의 모델을 Fable로 바꿉니다. 당신은 여기서 멈춥니다.**

당신이 못 해서가 아닙니다. 대표님이 이 작업을 다른 모델로 돌리기로 정하셨고, 세션의 모델은 도중에 바꿀 수 없어서 세션을 갈아끼웁니다.

**지금 이 세 가지만 하고 끝내십시오. 새 작업을 시작하지 마십시오.**

1. **지금까지 한 것을 전부 커밋하고 푸시하십시오** — `claude/figma-pixel-parity`로. 끝나지 않은 것도 그대로 커밋합니다. 커밋 메시지에 **어디까지 했고 어디서 끊겼는지** 적으십시오(예: 「홈 준비현황 2×2까지. 카테고리 6칸은 배치만 하고 아이콘 미교체」). 빌드가 깨져 있어도 괜찮습니다 — **깨진 채로 커밋했다고 메시지에 적으면 됩니다.** 잃는 것보다 낫습니다.

2. **`docs/sync/figma-parity-handoff.md`를 쓰십시오.** 뒤를 잇는 세션이 읽습니다. 넷을 적습니다.
   - **한 것**: 화면별로 무엇을 어떻게 바꿨는지.
   - **하다 만 것**: 어디까지 갔고 다음 한 걸음이 무엇인지.
   - **알아낸 것**: 시안과 코드를 대조하며 알게 된 사실. 특히 **피그마와 우리 규칙이 부딪히는 자리**(피그마엔 있는데 우리 금지어인 것, 피그마엔 없는 화면 등). 이게 제일 값집니다 — 다시 알아내려면 같은 시간이 듭니다.
   - **함정**: 헛짚었던 것. 다음 사람이 같은 데서 안 넘어지게.

3. **푸시한 커밋 SHA와 핸드오프 파일 경로를 MASTER에게 보고하십시오.** 그리고 멈추십시오.

PR은 걸지 않아도 됩니다 — 뒤를 잇는 세션이 같은 브랜치에서 이어 받아 겁니다.
```

## 피그마 패리티 — SEED 토큰 기반 완료 통보

- `trig_018pHHipfwVetEf9HB7pjRyX` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-15T00:20:57

```
MASTER입니다. **색 토큰 작업은 제가 이미 끝냈습니다. 손대지 마십시오.** 앞서 보낸 실측표(SEED 색 어긋남)는 조사 결과였고, 그 조사에 따른 수정은 MASTER 브랜치 `claude/figma-integration`(커밋 `ecec6277`)에 들어갔습니다.

## 제가 한 것 — 다시 하지 마십시오

- `@seed-design/css@2.8.1` · `@seed-design/icon@0.6.2`를 **빌드용 의존성**으로 넣었습니다. SEED에 RN 판이 없어서(`@seed-design/react-native`는 존재하지 않습니다) 웹용 CSS를 앱에 실을 수 없습니다 — **값만 뽑아 씁니다.** 앱이 읽는 것은 지금까지처럼 `spec/tokens.json` 하나입니다.
- `scripts/sync-seed-tokens.mjs` — SEED `base.css`에서 뽑아 `spec/seed-tokens.json`에 적습니다(밝은 벌 206 · 어두운 벌 206).
- `spec/seed-map.json` — 우리 토큰 14개가 SEED의 무엇에서 오는지.
- `spec/tokens.json` 색 10개 · `packages/ui/src/theme.ts` 램프 22개 · `apps/web/src/site-styles.ts` 15개를 SEED 값으로 옮겼습니다.
- `apps/api/src/test/seed-parity.test.ts` + CI의 `sync-seed-tokens.mjs --check` — 다시 갈라지면 빨개집니다.

**그래서 `spec/tokens.json`의 `color` 블록과 `packages/ui/src/theme.ts`의 gray 램프는 건드리지 마십시오.** 건드리면 시험이 빨개지고 충돌이 납니다.

## 지금 하십시오

1. **제 브랜치를 가져오십시오.** `git fetch origin claude/figma-integration && git merge origin/claude/figma-integration`. (제 PR #232가 main에 머지되면 `main`을 머지하는 것으로 바뀝니다 — 먼저 `git fetch origin main`으로 확인하십시오.) 색이 바뀐 바탕 위에서 레이아웃을 맞춰야 두 번 일하지 않습니다.
2. 그다음 **원래 배정한 일**을 계속하십시오 — 홈 → 검색 → Pick → 웨딩노트 → 업체상세 → 나머지 순으로, 앱과 시안을 같은 폭(430)으로 찍어 대조하며 레이아웃 · 간격 · 크기 · 라운드 · 구성 요소를 맞추는 것.

## 색에서 당신이 할 일은 이것뿐입니다

- **화면 코드에 hex를 직접 적지 마십시오.** 전부 토큰/테마 이름으로 씁니다.
- 피그마에 있는 색인데 우리 토큰에 없다면, **직접 만들지 말고 MASTER에게 보고하십시오.** SEED의 어느 값인지 제가 확인해서 `spec/seed-map.json`에 추가합니다. 근거 없이 값을 만들면 다음 사람이 고칠 근거를 잃습니다.
- 브랜드색 `#E7898D` · `#ECA0A3`은 SEED가 아니라 대표님이 정한 값입니다. 그대로 둡니다.

## 라운드는 당신 몫입니다

색과 달리 **라운드는 아직 안 옮겼습니다.** 피그마의 실효값은 이렇고, 우리 `spec/tokens.json` `radius`는 `card: 10`뿐입니다.

| 피그마 클래스 | 실효값 | 어디에 |
| --- | --- | --- |
| `rounded-2xl` | **16px** | 카드 대부분(홈·검색·Pick에서 13번) |
| `rounded-lg` | **18px** | 작은 블록 |
| `rounded-xl` | **22px** | |
| `rounded-[22px]` | 22px | 홈 히어로 |

**토큰에 더하고 `$note`에 근거를 적으십시오**(예: `radius.card: 16` ← `docs/design/figma-export` `Home.tsx` `rounded-2xl` = `--radius-2xl` = 1rem). 가까운 값으로 때우지 마십시오.

기존 지시(피그마가 못 이기는 것 · PR 필수 · 초록으로 · 스크린샷 나란히)는 그대로입니다.
```

## 피그마 패리티 — SEED 토큰 실측값 전달

- `trig_01X229QEFTeoMTWbhXBLGeRr` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-15T00:07:13

```
MASTER 추가 전달입니다. 대표님이 「SEED 디자인시스템 적용된 거냐」고 물으셔서 실측했습니다. **결론: 우리 앱에 SEED는 설치조차 안 돼 있고, 색 토큰은 SEED를 손으로 베낀 옛 세대입니다.** 픽셀 패리티 작업에 바로 쓰십시오.

## 1. 무엇이 SEED이고 무엇이 아닌가

- **우리 앱**: `@seed-design/*` 의존성 0건. `packages/ui`의 37개는 전부 손으로 만든 RN 컴포넌트.
- **피그마**: SEED를 통째로 쓰지 않습니다. 실제로 쓰는 것은 셋뿐입니다.
  - `@seed-design/icon` — `Home.tsx` · `OurWedding.tsx` · `My.tsx` · `Root.tsx` 네 파일
  - `@seed-design/tailwind4-theme` — `src/styles/theme.css:2`
  - `@seed-design/css/base.css` — `src/styles/fonts.css:5`
  - **컴포넌트는 shadcn/ui입니다.** `@seed-design/react`는 설치만 돼 있고 한 번도 import되지 않습니다.
- `@seed-design/react` · `css` · `tailwind4-theme`는 **웹 전용**이라 RN에 그대로 못 넣습니다. 그러니 「SEED를 설치한다」가 답이 아니라 **값을 SEED 현행으로 맞추는 것**이 답입니다. 아이콘은 SVG라 옮길 수 있습니다.

## 2. 색 — 브랜드는 맞고 회색 램프가 어긋납니다

브랜드는 정확히 같습니다: `#E7898D`(primary) · `#ECA0A3`(accent). 회색이 문제입니다.

| 우리 토큰 | 우리 값 | 피그마(SEED 현행) | 같나 |
| --- | --- | --- | --- |
| `text.ink` | `#212124` | `fg-neutral` = gray-1000 `#1A1C20` | **다름** |
| `text.secondary` | `#4D5159` | gray-800 `#555D6D` | **다름** |
| `text.tertiary` | `#868B94` | gray-700 `#868B94` | 같음 |
| `text.disabled` | `#ADB1BA` | gray-600 `#B0B3BA` | **다름** |
| `line.border` | `#DCDEE3` | gray-400 `#DCDEE3` | 같음 |
| `line.fieldBorder` | `#D1D3D8` | gray-500 `#D1D3D8` | 같음 |
| `line.divider` | `#EAEBEE` | gray-300 `#EEEFF1` | **다름** |
| `surface.recessed` | `#F7F8FA` | `bg-layer-fill` = gray-100 `#F7F8F9` | **다름**(끝자리) |
| `surface.band` | `#F2F3F6` | gray-200 `#F3F4F5` | **다름** |

**본문 글자색이 다릅니다**(`#212124` vs `#1A1C20`). 모든 화면에 걸립니다. 확인 방법:

` ` `bash
grep -o -- "--seed-color-palette-gray-[0-9]*:[^;]*" \
  /home/user/jsexy0210-ship-it/docs/design/figma-export/dist/assets/*.css | sort -u
` ` `

## 3. 라운드 — 카드가 6px 작습니다

피그마의 실효값(빌드된 CSS에서 확인):

| 클래스 | 실효값 | 어디에 |
| --- | --- | --- |
| `rounded-lg` | `var(--radius)` = **18px** | 작은 블록 |
| `rounded-xl` | `calc(var(--radius) + 4px)` = **22px** | |
| `rounded-2xl` | **16px** | 카드 대부분(홈·검색·Pick에서 13번) |
| `rounded-[22px]` | 22px | 홈 히어로 |
| `rounded-full` | 999 | 42번 |

우리 `spec/tokens.json` `radius`는 `card: 10`입니다. **피그마 카드는 16입니다.** 18과 22는 우리 토큰에 아예 없습니다. 규칙대로 **토큰에 더하고 `$note`에 근거를 적으십시오** — 가까운 값으로 때우지 마십시오.

## 4. 서체

피그마 `fonts.css`가 Noto Sans KR · Playfair Display · DM Mono를 불러오지만 **그대로 따라가지 마십시오.** 2026-09-14 대표님 결정으로 **Pretendard 단일**이고, 피그마도 Pretendard를 같이 싣습니다(`fonts.css:2`). `spec/tokens.json` `typography.$fontFamily`의 규칙이 그대로 현행입니다.

## 5. 아이콘

피그마가 쓰는 SEED 아이콘: `IconHome`·`IconCalendar`·`IconHeart`·`IconCommunity`·`IconProfile`(Regular/Fill 쌍) · `IconNotification` · `IconSearch` · `IconChevronRight` · `IconLocation` · `IconReviewStarFill` · `IconCheckFlowerFill` · `IconClock` · `IconMoreHoriz`. 모양을 맞추되 **탭 바 가운데는 Pick Mark 그대로입니다** — 피그마의 `IconHeart`로 바꾸지 마십시오(절대 변경 금지).

## 이 넷 중 무엇을 고쳤고 무엇을 남겼는지 PR 본문에 따로 적으십시오.

색 램프 교체는 전 화면에 걸리는 변경이라, 화면별 스크린샷과 함께 「무엇이 바뀌어 보이는지」를 명시하십시오.
```

## rn-preview — b285f0b 검수 결과와 수정안

- `trig_01X5CM48N64TzJd29yuShBQE` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-14T22:59:24

```
MASTER다. 네가 요청한 대로 SHA `b285f0b0`을 봤다. **만든 것은 옳고, 부르는 자리가 틀렸다.** Bash 권한을 기다리지 말고 이것부터 고쳐라.

## 옳은 것

`scripts/build-preview.mjs`는 빌드 산출물(`dist/*.html`)에만 스크립트를 얹고, 만드는 두 파일은 `dist/` 안이며 `dist/`는 `.gitignore`다. `apps/mobile/src/**`와 `packages/**`는 0줄 변경이다. `/login`·`/setup`을 건드리지 않아 대표님이 로그인·가입 화면 디자인도 그대로 보신다. 여기까지는 그대로 둔다.

## 틀린 것 — 이대로 두면 운영에 구멍이 난다

`apps/mobile/package.json`의 `export:web`에 `build-preview.mjs` 호출을 박아 두었다.

    render.yaml:80   weddingpick-app-web  buildCommand: npm run export:web --workspace @weddingpick/mobile && …
    render.yaml:146  weddingpick-admin    buildCommand: npm run export:web --workspace @weddingpick/mobile && …

**Render 배포가 `export:web`을 부른다.** 이 브랜치가 어떤 경로로든 main에 닿는 순간 **앱 웹과 관리자 두 곳 모두 로그인 우회와 픽스처 가로채기가 박힌 채로 배포된다.**

네 커밋 메시지는 「claude/rn-preview 전용. main에 올리지 않는다」고 적었다. **그것은 약속이지 장치가 아니다.** CLAUDE.md가 이미 못박아 둔 자리다 — 「캡처일 때는 통과」를 제품 코드에 넣지 않는다. 그 구멍이 운영에 나간다.

`package.json`의 빌드 스크립트를 「제품 코드가 아니다」로 볼 수 없다. **배포가 실제로 부르는 것**이 거기 적혀 있다.

## 고치는 법 — 한 줄이다

`export:web`을 원래대로 되돌리고 `preview:web`을 따로 만든다.

    "export:web":  "node ../../scripts/ensure-modules.mjs && expo export --platform web"
    "preview:web": "npm run export:web && node ../../scripts/build-preview.mjs"

대표님 프리뷰를 만들 때만 `preview:web`을 부른다. Render는 계속 `export:web`을 부르므로 브랜치가 어디로 가든 우회가 배포에 섞이지 않는다. `scripts/screenshot-screens.mjs` 쪽 변경(11줄)은 그대로 둬도 되는지 네가 판단해라 — 그건 캡처 도구이고 배포가 부르지 않는다.

## 다음

1. 위 수정을 `claude/rn-preview`에 커밋·푸시해라. **지정 브랜치 밖으로 푸시하지 마라.**
2. 초록으로 만든 뒤 **draft PR**로 올려라. 2026-09-14 대표 지시로 PR 전면 중단(머지 금지 · draft 생성만 허용) 상태다.
3. **빌드 검증은 못 해도 된다.** 지금 브랜치는 ahead 52에 PR이 없어서 밖에서 보이지 않는다 — 「보이지 않는 완료」다. PR을 먼저 올리는 것이 검증보다 급하다. PR 본문에 「빌드 검증을 못 돌렸다」를 그대로 적어라. 못 한 것을 완료에 섞지 않는다.

참고로 저장소가 많이 움직였다 — 마이그레이션 최고 번호가 0330이고, `claude/figma-integration`(#232)에 RN 브랜치 다섯이 통합돼 있다. base를 맞출 필요가 있으면 `main`을 머지해라.
```

## public-data-resume — 업종 결정 3건

- `trig_01Lprc7jyBrNcvtxKRokmwWN` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-14T22:21:21

```
MASTER다. 업종 결정 3건에 답한다. 대표님이 이미 정하신 것이 있어 그대로 적용한다.

- **청첩장 — 업종으로 유지하고 계속 수집한다.** 승인 대기함 A-12(청첩장·예물·허니문 수집 추가)가 유효하다. 상담 녹음 기능에서만 안 받는 것이고(2026-09-14 결정) 수집과는 별개다.
- **한복 — 웨딩 업종에서 뺀다**(A-15). 수집 대상이 아니다.
- **catch-all — `etc`로 떨어뜨리되 화면에 업종으로 내놓지 않는다.** `PREPARATION_CATEGORIES`가 이미 `etc`를 뺀다. 분류가 안 되는 업체를 담는 칸이지 준비 단계가 아니다.

`G21701`·`N10501` 코드 판단은 네가 실제 데이터를 보고 있으니 네가 정한다. **다만 코드가 어느 업종으로 가든 이름은 `VENDOR_CATEGORY_LABEL` 그대로 쓴다** — 같은 것을 두 이름으로 부르지 않는다(2026-09-11 대표 지시).

마치면 초록으로 만든 뒤 **draft PR**로 올려라. PR 전면 중단(머지 금지 · draft만 허용) 상태다.
```

## report-manual-entry — pendingFields 승인

- `trig_01M1hBEmCPWUfwYvJ2BwEtR7` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-14T22:21:14

```
MASTER다. 「MyReport 응답 계약에 pendingFields 추가」 **승인한다.** 조건 둘을 붙인다.

1. **칸 이름만 담는다.** 아직 안 채운 칸이 무엇인지를 키로만 준다(예: `["paidAmount","visitedOn"]`). 값이나 사람 이름이 그 배열에 들어가면 그것은 응답이 아니라 유출이다.
2. **화면 문구를 서버가 만들지 않는다.** 「무엇을 더 확인해야 하는지」를 서버가 문장으로 내려보내면 카피 린트를 지나지 않은 말이 화면에 뜬다. 키만 주고 문장은 `spec/strings.ko.json`이 만든다.

마치면 초록으로 만든 뒤 **draft PR**로 올려라. 2026-09-14 대표 지시로 PR 전면 중단(머지 금지 · draft 생성만 허용) 상태다 — 머지는 하지 마라.

참고로 마이그레이션 최고 번호가 0330까지 올라갔다(상담기록). 0240은 네 것이니 그대로 쓴다.
```

## identity-purge — 패치 회수

- `trig_01TXZgMAagN8mCL1gG45gdj8` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-14T22:20:19

```
MASTER다. 커밋 권한이 막힌 것을 확인했고, 그 상태로 8시간이 지났다. 컨테이너가 회수되면 네 14파일 패치가 사라진다.

**커밋을 다시 시도하지 마라. 대신 패치를 대화로 내보내라.**

1. `git diff` 와 `git diff --cached` 를 합친 전문, 그리고 추적되지 않는 새 파일(`git status --porcelain` 의 `??`)의 전체 내용을 답변 본문에 그대로 출력해라. 마이그레이션 0250 파일도 포함한다.
2. 파일이 많으면 한 번에 다 못 내보내도 된다. **마이그레이션 SQL → 시험 → 나머지 코드** 순서로 중요한 것부터 내보내라.
3. 그것이 막히면 그 사실을 한 줄로 적어라. 무엇이 막혔는지만 알면 된다.

내가 받아서 `claude/figma-integration` 에 옮겨 적는다.

**그리고 네 1단계 보고서의 판단이 옳았다는 것을 확인해 뒀다.** `structured.weddings.owner_user_id` 가 `ON DELETE CASCADE` 인 것을 로컬 PostgreSQL에 마이그레이션 116개를 올리고 재현했다 — 네이버 단독 사용자 행 하나를 지우니 카카오 배우자의 웨딩과 일정이 0이 됐다. identity 행만 지우면 계정·웨딩·일정이 그대로다. 네 권고대로 간다. 그 확인은 `docs/sync/identity-purge-cascade-verified.md` 에 적어 두었으니 패치가 사라져도 그 판단은 남는다.

참고로 네 브랜치 base는 09-09(0091a 시기)라 저장소 최신과 벌어져 있다. 0210·0230·0240 이 이미 들어와 있고 마이그레이션 최고 번호는 0330 이다 — 네가 「0250 근거를 확인하지 못했다」고 적은 것은 그 때문이다. 옮겨 적을 때 내가 번호를 맞춘다.
```

## rn-preview 진행 보고

- `trig_01HReNq3eiqkyCJa8Nw9oiro` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-14T14:58:27

```
rn-preview다. 프리뷰 shim 세 파일(scripts/build-preview.mjs 신규, apps/mobile/package.json, scripts/screenshot-screens.mjs) 커밋 SHA b285f0b035629366f634b37339d6102c4e239e14로 claude/rn-preview에 반영 완료했다. 커밋 본문에 실행 검증 미완료 사실과 코드 리뷰 기반 4문항 답변을 적어뒀다. 이어지는 브라우저 검증은 MASTER 쪽에서 진행 요청.
```

## RN 개편 감시 보고 #2 (watcher → MASTER)

- `trig_01WZpwvXuFRFRBotMCbp8oEA` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-14T12:17:46

```
[RN 개편 감시 순찰 보고 #2] 2026-09-14 21:15 KST경, origin/main(35d5f4cc) 기준 — 직전 순찰(0/7) 대비 변화 있음

■ 브랜치 현황 (5/7 생성)
- 생성됨: rn-migration-plan(1커밋), rn-tokens(3커밋), rn-components(6커밋), rn-nav-auth(9커밋), rn-screens-core(6커밋)
- 미생성: rn-screens-plan, rn-screens-vendor
- 목록 외 브랜치 발견: claude/rn-preview (베이스라인 스크린샷 캡처용, docs/rn-migration/preview/before/*.png만 건드림 — 코드 겹침 없음, 참고만)

■ [중요] 파일 소유권 겹침 발견
- spec/tokens.json, packages/ui/src/theme.ts (rn-tokens 전담) → rn-nav-auth, rn-screens-core도 동일 파일 수정 중
- apps/web/src/site-styles.ts → rn-tokens·rn-nav-auth·rn-screens-core 3개 브랜치가 동시에 수정
- spec/strings.ko.json → rn-nav-auth·rn-screens-core 둘 다 수정
→ 나중에 머지 순서에 따라 서로 덮어쓸 위험 있음. _layout.tsx/navigation/auth 쪽은 아직 rn-nav-auth만 건드려 정상.

■ [중요] 베이스 노후화
rn-migration-plan / rn-tokens / rn-nav-auth / rn-screens-core 네 브랜치 모두 main 대비 172커밋(약 5일, 2026-09-09 PR#135 시점) 뒤처진 지점에서 분기됨. rn-components(PR #222) 세션이 스스로 PR 본문에 "이 브랜치는 2주 뒤처진 main 위에서 갈라져 있었다"며 자체 리베이스했다고 밝혔고, "claude/rn-tokens가 같은 낡은 base 위에 있다 — 키 컬러(코랄→더스티로즈)·서체(Pretendard) 결정이 현재 main CLAUDE.md와 충돌하니 리베이스와 판단이 필요하다"고 명시적으로 지적함. rn-nav-auth·rn-screens-core도 동일 문제.

■ PR 없이 커밋만 쌓인 브랜치 (「보이지 않는 완료」)
rn-migration-plan, rn-tokens, rn-nav-auth, rn-screens-core — 전부 PR 없음 (draft 자동생성 기대와 다름)
rn-components만 PR #222 있음 (draft, mergeable_state=unstable, CI in_progress — 아직 실패 아님)

■ 정상 확인
- 새 DB 마이그레이션 파일 없음
- main 최신 커밋(35d5f4cc)은 PR #170 정상 머지(재또 본인) — main 직접 푸시 아님

다음부터는 상태 변화 있을 때만 다시 보고함.
```

## PR #170 상태 확인 (6시간)

- `trig_01FagA3RNR4Hfj9GkEM5yNZe` · 2026-09-14T17:11:00Z · 꺼짐 · 만든 때 2026-09-14T11:10:53

```
PR #170(claude/retention-3) check-in.

## 지금 상태 (2026-09-14 확인 기준)
open · draft · `mergeable_state: clean` · head **`76e41f45`** · behind 6 · `git merge-tree` 실측 **충돌 없음** · 마지막 CI(run 774) success · 코멘트 3.

**2026-09-11 21:23 KST 이후 사흘간 이 PR은 한 글자도 바뀌지 않았다.** head 그대로, 리뷰 없음, 새 코멘트 없음. main이 6커밋 앞서 있지만 **이 PR이 건드린 파일 여섯(`docs/README.md` · `docs/retention-policy.md` · `docs/unmerged-branches.md` · `branch-cleanup.yml` · `retention-check.yml` · `scripts/db-inventory.ts`)은 하나도 겹치지 않았다.** 기술적으로 막힌 것이 없고 **대표님 결정만 남았다.** 사흘 정체를 09-14에 한 번 보고했다 — **같은 보고를 반복하지 않는다.**

## 확인 간격을 6시간으로 늘렸다
움직임이 없는 PR을 매시간 재는 것은 낭비다. 다시 움직이면(head 변경 · 리뷰 · 충돌) 그때 간격을 좁힌다.

## 이번 확인에서 할 일
1. `git fetch origin main claude/retention-3` → `git merge-base --is-ancestor origin/claude/retention-3 origin/main`. **머지됐거나 닫혔으면 check-in을 끝낸다**(다시 잡지 않는다).
2. `git merge-tree --write-tree origin/claude/retention-3 origin/main` — 종료 코드 0이면 충돌 없음. (`pull_request_read`의 `mergeable_state`는 `unknown`으로 자주 나와 믿을 수 없다. git으로 재는 것이 정답이다.)
3. `pull_request_read(method="get", pullNumber=170, minimal_output=true)`로 `state` · `head.sha` · `comments` 수만 본다.
   - **head가 `76e41f45` 그대로이고 충돌 없고 코멘트가 3이면 아무것도 하지 않고** 6시간 뒤로 조용히 다시 잡는다. **사용자에게 알리지 않는다.** behind가 몇이든 상관없다.
   - **코멘트가 3보다 늘었으면** `pull_request_read(method="get_comments", pullNumber=170, perPage=5)`로 새 것만 읽는다. 리뷰 요청이면 작고 지역적인 것은 고쳐서 푸시하고, 큰 것은 제안만 하고 대표님께 판단을 넘긴다.
4. **충돌이 나면** 머지 → typecheck·lint·카피 린트(`node lint-copy.js spec/strings.ko.json apps packages`)·npm test를 **종료 코드로** 확인 → 푸시 → **푸시 직후에 run id를 집는다** → 그 CI를 확인한다.
   - docs/README.md 충돌은 상대 내용을 받되 판 번호를 줄에 박지 않는다. 통합정책 v3.10 줄의 「코드 16곳이 인용해서 남긴다」와 v3.12 줄이 없는 것은 이 PR의 결정이니 유지. spec/tokens.json · apps/* · packages/* · .github/workflows/main.yml은 main 것을 받는다. **packages/db/migrations는 건드리지 않는다.**
5. **머지 방침: main 커밋마다 따라가지 않는다.** behind 그 자체는 고칠 일이 아니다. 머지는 셋 중 하나일 때만 — ① 실제 충돌 ② CI가 빨갛고 main 쪽에 답이 있을 때 ③ 대표님이 머지하겠다고 할 때 그 직전 한 번.
6. CI가 빨가면: `actions_list(method="list_workflow_jobs", resource_id=<run id>, filter="latest", minimal_output=true, perPage=1)` → `get_job_logs(job_id=<id>, return_content=true, tail_lines=1400)`. 파일로 떨어지면 `python3`으로 `json.load` → `d['logs_content'].split('\n')` 후 `FAIL ` 줄 앞뒤 18줄.
   - **모바일 5초 타임아웃 계열은 main의 `testTimeout: 20_000`이 덮는 자리다. 내 쪽에서 타임아웃을 다시 건드리지 마라** — 그러면 main 쪽 문제이므로 대표님께 알리고 멈춘다.
   - 재실행은 이미 한 번 썼다(run 743 attempt 2). 다시 쓰지 않는다.
   - CI가 빨가면 audit status는 PASS가 아니다. 대표님께 알린다.
7. **브랜치 수를 다시 세지 않는다.** docs/unmerged-branches.md의 숫자는 스냅샷이고 지금 값은 워크플로가 센다.
8. **PR 본문은 이미 현재 사실을 들고 있다**(09-11에 run 774 · head 76e41f45로 갱신하고 모바일 시험 절을 더했다). 다시 고치지 않는다.

## 도구 요령
- **run id는 푸시 직후에 집는다**: `actions_list(method="list_workflow_runs", workflow_id="main.yml", perPage=1, minimal_output=true, exclude_pull_requests=true)` → 맨 위가 방금 만든 run. 시간이 지나면 다른 브랜치 run이 쌓여 못 찾는다.
- `event`도 `branch`도 실제로 거르지 않는다. `pull_request_read(get_status)`는 `total_count: 0`만 준다(check run을 쓴다).
- REST를 직접 부르지 마라 — `repos/.../weddingpickl/...`는 숫자 ID로 리다이렉트되고 프록시가 막는다.
- 파라미터 이름: `actions_get`은 `resource_id`, `actions_run_trigger`는 `run_id`, `add_issue_comment`는 `issue_number`, `update_pull_request`와 `pull_request_read`는 `pullNumber`.

## 감사 증명 (change_scope = code_no_release)
` ` `
git_integrity  PASS  clean · uncommitted 0 · unpushed 0 · protected branch 아님 · local==remote
pr_integrity   PASS  #170 OPEN · base main · head 76e41f45 · 충돌 없음(git 실측)
ci             PASS  run 774 success (head 76e41f45)
release        NOT_APPLICABLE   health  NOT_APPLICABLE
status         PASS
` ` `
head가 바뀌면 CI를 다시 확인하기 전까지 PASS가 아니다.

## 대표님 결정만 남은 것 셋
1. **PR #170 머지 여부** — 초록이고 충돌 없다. 머지하면 브랜치 정리 안전장치 셋이 main에 올라간다.
2. **CLAUDE.md의 마이그레이션 서술** — 사실과 다르다(실제 러너로 확인 — 겹친 번호도 둘 다 적용된다. 진짜 위험은 이미 적용된 파일의 이름을 바꾸는 것). 내 문서 둘은 고쳤고 CLAUDE.md는 MASTER 소관이라 손대지 않았다.
3. **브랜치 삭제와 DB 이력 정리** — 아래.

## 사람 손이 남은 것 둘
- **브랜치 삭제** — Actions → 「브랜치 정리」(`https://github.com/jsexy0210-ship-it/WeddingPick/actions/workflows/branch-cleanup.yml`), dry_run 켜고 먼저 돌린 뒤 끄고 실행. **안전장치 셋(얕은 클론 가드 · dry_run 안전 기본값 · 보호 목록 기본값)은 아직 main에 없고 PR #170에만 있다.** main의 `protect` 기본값은 비어 있어 지금 돌리면 실질 보호는 나이 필터(3일)뿐이다.
- **DB 이력 정리** — Actions → 「DB Inventory (읽기 전용)」로 건수를 보고, 그 숫자로 계획서를 채워 승인 뒤 실행. **되돌릴 수 없으므로 승인 전에는 실행하지 않는다.**

Claude GitHub App이 없어 PR 이벤트가 세션을 깨우지 않는다. 호칭은 대표님. 시각은 KST.
```

## 0230·0231 마이그레이션 적용 확인

- `trig_01KHhz6q6qvqKzDsNhz3tAGx` · 2026-09-11T07:29:00Z · 꺼짐 · 만든 때 2026-09-11T06:58:25

```
PR #211이 머지된 뒤 마이그레이션 0230·0231이 실제로 적용됐는지 확인한다. main 푸시 런(34572150413)의 「Deploy → Staging」 잡이 production 환경 승인 게이트에서 waiting이면 아직 적용 전이다 — 그러면 관리자 FAQ와 링크 미리보기가 500이다. 적용됐으면 api-health로 스키마 상태를 확인하고, 그 뒤 og-probe 워크플로를 돌려 공유 미리보기가 실제로 뜨는지 본다. 아무것도 안 바뀌었으면 조용히 다시 확인만 건다. 운영 마이그레이션은 내가 적용하지 않는다 — MASTER 몫이다.
```

## PR #211 CI · 상태 재확인

- `trig_01RHxAHU5bQebcMgjcSK976x` · 2026-09-11T07:42:00Z · 꺼짐 · 만든 때 2026-09-11T06:41:05

```
PR #211(claude/admin-overhaul) 상태를 다시 확인한다. CI 결과 · 머지 충돌 · 리뷰 코멘트를 보고, 빨간 것이 있으면 원인을 찾아 고쳐 푸시한다. 아무것도 바뀌지 않았으면 조용히 다음 확인만 다시 걸고 대표님께 알리지 않는다. 머지·종료되면 확인을 멈춘다. 직전 확인(06:40Z)에서는 head 0a74139에서 CI 초록 · 충돌 없음 · 리뷰 코멘트 없음이었고, GitHub API 호출 한도에 걸려 리뷰 스레드는 끝까지 못 읽었다 — 이번에 그것부터 확인한다.
```

## 캡처 세션 — 시안 렌더는 빼고 앱만

- `trig_015AhXHzYTD6FpVUVCkUcR4N` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-11T05:49:50

```
**범위를 줄인다 — 시안 쪽 렌더는 하지 마라.**

`docs/design/figma-export/*.dc.html`이 참조하는 자산(`support.js` · `image-slot.js` · `doc-page.js` · `_ds/` 폴더)은 **저장소에 들어오지 않는다.** 대표님이 용량 때문에 올릴 수 없다고 하셨다(2026-09-11). 그러니 시안 HTML은 브라우저에서 스타일 없이 뜬다 — 그것을 찍어 봐야 쓸모가 없다.

**「시안 ↔ 실제 나란히 붙이기」를 빼라.** 자산을 구하려 애쓰지 말고, 시안 파일을 고쳐서 열리게 만들려 하지도 마라(읽기 전용이다).

**남는 목표는 하나다 — 앱 화면을 실제로 렌더해서 PNG로 찍는다.**

오늘 사달의 원인은 시안을 못 봐서가 아니다. **아무도 앱 화면을 본 적이 없어서**다. 세션 셋이 코드와 시안 HTML을 눈으로 대조하고 「시안대로 맞췄다」고 보고했고, 실제 화면은 달랐다. 앱 쪽 한 장만 나와도 그 고리가 끊긴다.

그러니 이 순서로 간다.

1. `/(tabs)/search/`를 열어 **부트스트랩이 실제로 무엇을 부르는지** 확인한다 — `page.on('console')` · `page.on('request')` · `page.on('requestfailed')`. 짐작으로 목을 늘리지 말고 보고 나서 막아라. 여기가 지금 막힌 자리다(「연결이 불안정해요」에서 멈춘다).
2. 그 화면 한 장을 PNG로 찍는다.
3. 그 한 장을 PR에 붙인다. **그것이 이 작업의 증명이다.**
4. 남으면 화면을 늘린다. 안 남으면 늘리지 마라 — 한 장이 도는 길이 끝까지 뚫린 것이 먼저다.

시안과의 대조는 사람이 한다. **찍은 화면을 PR에 붙이면 사람이 시안을 옆에 놓고 본다.** 도구가 대조까지 할 필요는 없다.

`docs/screen-capture.md`에 **명령 한 줄**로 쓰는 법을 적어라. 읽고 따라 하기 어려우면 아무도 안 쓴다. 시안 자산이 없어서 시안 쪽은 찍지 않는다는 것도 함께 적어 둬라 — 다음 사람이 같은 자산을 또 찾아 헤매지 않게.

나머지 지시는 그대로다. 제품 코드에 캡처용 우회로를 내지 않는다. 찍은 PNG를 저장소에 커밋하지 않는다. 운영 API로 나가지 않는다. 마칠 때 PR을 건다.
```

## 열린 작업 감시 — 2시간마다

- `trig_01WcnwPdk4vnkGe3frMam2HW` · 35 */2 * * * · 꺼짐 · 만든 때 2026-09-11T04:44:17

```
열린 작업만 본다. **끝난 것은 다시 보지 않는다** — 대표님 토큰이 빠듯하다.

끝나서 감시 대상이 아닌 것: #205 · #207 · #209 · #210 · #211 · #212 · #214 (전부 머지). 관리자 개편 세션과 검색 UX 세션은 흡수·보관했다.

지금 열린 것은 이것뿐이다.

` ` `
#213                    검색 결과 여덟 자리 — CI 빨강이었다. 캡처 세션이 고치는 중
claude/date-picker-wheel 날짜 선택 휠 3열 — 대표 지시. #213 다음 순서
#206 claude/perf-audit   싱가포르 왕복 재측정 — 성능 세션
#208 claude/region-legal 약관 정본화 · 리전 절차서
#170 · #142              대표님이 의도적으로 보류
` ` `

순서대로 본다.

1. **#213 CI.** 초록이면 즉시 머지하고 배포 확인까지 한다.
2. **`claude/date-picker-wheel` PR이 올라왔는가.** 초록이면 머지한다. 커밋만 쌓이고 PR이 없으면 **보이지 않는 완료**다 — 즉시 PR을 걸라고 지시한다.
3. **성능 세션의 재측정 결과.** 「DB 왕복 1회」가 한 자리 ms로 떨어졌는지만 본다. 나왔으면 대표님께 보고한다 — 이름을 바꿔 끼울지는 그 숫자로 정한다.
4. **#208 CI와 겹침.** `apps/web/src/subpages.ts`는 약관 세션 것이다. 다른 브랜치가 건드리면 충돌한다.
5. **마이그레이션 번호 충돌.** 0210 공공데이터 · 0230 관리자 · 0240 제보 흐름이 잡혀 있다.

**막힌 세션을 풀어준다.** `claude/auth-narrow`와 `claude/report-flow-root`가 판단 대기로 서 있다. 결정은 이미 났다 — 로그인은 코드·빌드 설정에서 네이버·구글을 지우되 Render 환경변수는 남긴다, 제보는 WP-RPT-010을 되살리지 않고 WP-RPT-004 인식 실패 하나로 간다. 아직 안 전했으면 전한다.

**아무것도 안 바뀌었으면 대표님께 알리지 않는다.** 조용히 다음 주기를 기다린다. 보고는 **끝난 것 · 막힌 것 · 판단이 필요한 것**이 있을 때만, 짧게 한다.

시각은 KST로 적는다.
```

## 감시 보고 → MASTER (수동 전달용)

- `trig_01TdCKwUrG5JxgcRybxX27gv` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-11T04:12:28

```
「전체 세션 감시」 세션의 주기 보고입니다. SendMessage로는 MASTER에 닿지 않아(ListAgents에 안 보임) 이 경로로 보냅니다. 보고 본문은 아래에 이어집니다.
```

## MASTER 확인 — 감시 보고가 왔는지, 안 왔으면 직접 본다

- `trig_01EiKJC8DjzgvnAw2BUbrSuM` · 6 */4 * * * · 꺼짐 · 만든 때 2026-09-11T04:06:04

```
감시 이중 확인이다. **감시 세션이 죽어도 누락이 안 생기게 하는 자리**다.

`전체 세션 감시 — MASTER에게 지속 알림`(session_01NPrTdTU1dzgiX9KdAZMW3n)이 지난 4시간
안에 보고를 보냈는가.

**왔으면** — 그 보고의 「조치 필요」를 처리한다. 처리했으면 끝이다. 별도 보고는 하지 않는다.

**안 왔으면 감시가 멈춘 것이다.** 그때는 두 가지를 한다.

1. `get_session`으로 상태를 본다. 막혔으면(`needs_action`) 무엇에 막혔는지 확인한다.
   커넥터가 빠져 GitHub을 못 보는 것일 수 있다 — 루틴이 커넥터를 싣지 못한다는 경고가
   만들 때 떴다.
2. **감시가 하던 점검을 MASTER가 직접 한 번 돈다.** 열린 PR의 CI · PR 없이 커밋만 쌓인
   브랜치(파일 내용으로 판정) · 세션 상태 · main과 배포 live 커밋 · `/health` 본문의
   pending · 마이그레이션 이름 충돌.

감시를 되살릴 수 없으면 **대표님께 그 사실을 알린다.** 감시가 죽은 채로 도는 것이
감시가 없는 것보다 나쁘다 — 있는 줄 알고 안 보게 된다.

조치할 것이 없고 감시도 살아 있으면 **대표님께 알리지 않는다.** 조용히 끝낸다.

시각은 KST로 적는다.
```

## 감시 주기 — 2시간마다 전수 점검 후 MASTER 보고

- `trig_01Wk6gMiD3GsrT27aW1i6tP2` · 5 */2 * * * · 꺼짐 · 만든 때 2026-09-11T04:05:41

```
감시 주기다. 점검표를 **처음부터 끝까지** 다시 돈다 — 지난번에 봤다고 건너뛰지 않는다.

1. 열린 PR 전부 — CI 결론 · CI가 아예 안 돈 것 · 옛 main 기준 초록 · mergeable · 답 없는 리뷰
2. 브랜치 — PR 없이 커밋만 쌓인 것. **파일 내용으로 판정한다**(조상 관계·커밋 제목 아님)
3. 세션 — PR을 실제로 걸었는가 · needs_action · 한 시간 넘게 같은 자리
4. main과 배포 — live 커밋 일치 · `/health` 본문의 pending · 머지했는데 안 돌린 마이그레이션
5. 마이그레이션 파일 이름 충돌
6. 겹치는 작업

**이상이 없어도 MASTER에게 한 번 보낸다.** 침묵은 「이상 없음」과 「감시가 죽었음」을
구분하지 못한다. 이미 알린 것은 상태가 바뀔 때만 다시 적는다.

시각은 KST. 코드는 고치지 않는다.
```

## 작업 현황 감시 → MASTER 보고 채널

- `trig_017BpQdEk5bp5fAcReHJdEku` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-11T02:39:42

```
작업 현황 감시 세션(user-f8)의 보고다. 아래 본문은 그때의 저장소 상태를 git 읽기만으로 대조한 결과다. 코드·머지·브랜치 삭제는 하지 않았다.
```

## 작업 현황 감시 — 매시간

- `trig_01QfVRHNXhmWpkSPd6JfUWNQ` · 54 * * * * · 꺼짐 · 만든 때 2026-09-11T00:54:46

```
감시 한 바퀴를 돈다. `git fetch origin --prune`부터 하고 **그때의 저장소 상태**로 다시 확인한다 — 기억한 값이 아니다.

1. 브랜치 ↔ PR 대조 — PR 없이 main에도 없는 브랜치(「보이지 않는 완료」)
2. 열린 PR의 병목 — CI 빨간색 · 충돌 · 초안으로 멈춤 · 같은 파일 두 PR · 마이그레이션 번호 겹침
3. 운영 — main 최신 커밋과 Render 세 서비스 live 커밋이 같은지, 반복 실패가 있는지
4. 돌고 있는 전담 세션과 브랜치·PR 맞춰보기

**지난번과 달라진 것만** MASTER(session_01RHos8CRUgW7VXAnxs2BwjD)에 보낸다. 아무것도 안 바뀌었으면 보내지 않는다 — 매시간 「이상 없음」이 오면 다음부터 아무도 안 읽는다.

코드를 고치지 않는다. 머지·닫기·브랜치 삭제도 하지 않는다. 시각은 KST로 적는다.
```

## 관리자 사이트 분리 — PR 걸어라

- `trig_01JNjXgEJwpTeKpp6jTxrq7d` · 주기 없음(쪽지형) · 꺼짐 · 만든 때 2026-09-10T10:46:11

```
MASTER다. 사용자 지침 — **작업을 마치면 PR을 건다.** 브랜치에 커밋해 두고 보고만 하는 것으로 끝내지 않는다. 브랜치는 그 세션 밖에서 보이지 않는다.

`claude/admin-split`에 커밋 1개 · 5파일이 쌓였는데 PR이 없다. 지금 걸어라.

1. **`main`을 머지한다** — 오늘 크게 움직였다. 머지 후 `CLAUDE.md`를 다시 읽어라.
2. **초록으로 만든다** — typecheck · lint · 카피 린트 · jest.
3. **PR을 건다.** 무엇을 어떻게 했는지, 못 한 것과 판단 필요한 것을 **따로** 적는다. draft로 올려도 되고 머지 여부는 MASTER가 정한다.

**앞서 보낸 정정을 다시 확인해라** — Render Static Site는 앞단 인증도 IP 허용목록도 걸 수 없다. 「분리하면 네트워크 단에서 막을 수 있다」는 내 잘못된 설명이었다. 분리의 값어치는 그것이 아니라 배포 주기와 주소를 가르는 데 있다. PR 본문에 그 근거를 적어라.

`render.yaml`을 손댔다면 주의할 것: 그 파일은 값의 원본이 아니다(Blueprint sync가 동작하지 않는다). 실제 설정은 대시보드와 `infra/render-env.yml`에 있고, `render-env-sync`는 **서비스를 이름으로 정확히 찾는다** — 이름이 한 글자만 달라도 조용히 건너뛴다.
```

## 인앱 브라우저 — PR 걸어라

- `trig_01Y7UmAFWuRe2jzNE2aC9ypf` · 주기 없음(쪽지형) · 꺼짐 · 만든 때 2026-09-10T10:45:54

```
MASTER다. 사용자 지침 — **작업을 마치면 PR을 건다.** 브랜치에 커밋해 두고 보고만 하는 것으로 끝내지 않는다. 브랜치는 그 세션 밖에서 보이지 않아, 끝난 일이 끝나지 않은 것과 똑같이 보인다.

`claude/inapp-browser`에 커밋 3개 · 7파일이 쌓였는데 PR이 없다. 지금 걸어라.

1. **`main`을 머지한다** — 오늘 크게 움직였다. 머지 후 `CLAUDE.md`를 다시 읽어라.
2. **초록으로 만든다** — typecheck · lint · 카피 린트 · jest.
3. **PR을 건다.** 무엇을 어떻게 했는지, 못 한 것과 판단 필요한 것을 **따로** 적는다. draft로 올려도 되고 머지 여부는 MASTER가 정한다. 덜 끝났으면 거기까지를 draft로 올리고 어디까지 왔는지 적어라.

본문에 꼭 적을 것: 안드로이드 `intent://`와 iOS 경로가 각각 어느 인앱 브라우저에서 되고 안 되는지, 그리고 **자동 이동이 막혔을 때의 사용자 조작 폴백**이 들어갔는지. 자동만 넣고 폴백이 없으면 막히는 앱에서 아무 일도 안 일어난다.

시각은 KST로 적는다. 사용자 화면 문구는 `spec/strings.ko.json`에서 가져온다.
```

## 관리자 콘솔 — PR 걸어라

- `trig_01GCQ55DhiWJeQwjN3BtyXd5` · 주기 없음(쪽지형) · 꺼짐 · 만든 때 2026-09-10T10:45:39

```
MASTER다. 사용자 지침 — **작업을 마치면 PR을 건다.** 브랜치에 커밋해 두고 보고만 하는 것으로 끝내지 않는다. 브랜치는 그 세션 밖에서 보이지 않는다.

`claude/admin-console`에 커밋 4개 · 18파일이 쌓였는데 PR이 없다. 지금 걸어라.

1. **`main`을 머지한다** — 오늘 크게 움직였다. 머지 후 `CLAUDE.md`를 다시 읽어라.
2. **초록으로 만든다** — typecheck · lint · 카피 린트 · jest.
3. **PR을 건다.** 무엇이 어떻게 달랐고 무엇으로 고쳤는지, 못 고친 것과 판단 필요한 것을 **따로** 적는다. draft로 올려도 되고 머지 여부는 MASTER가 정한다. 덜 끝났으면 거기까지를 draft로 올리고 어디까지 왔는지 적어라.

네 작업에 걸리는 새 규칙: **화면은 목업과 1:1**이고 토큰에 값이 없으면 목업 값을 토큰에 더한다(가까운 값으로 대신하지 않는다). SPEC 본문과 목업이 어긋나면 **목업이 이긴다**. 관리자 캔버스는 1920. 시각은 KST로 적는다.

v3.27 신설 11화면 대조는 그대로 진행하되, 그 결과도 이 PR 본문에 넣어라.
```

## 관리자 계정·권한 — PR 걸어라

- `trig_01KBZv32og5nAVAiVVzM9qYp` · 주기 없음(쪽지형) · 꺼짐 · 만든 때 2026-09-10T10:45:23

```
MASTER다. 사용자 지침이다 — **작업을 마치면 PR을 건다.** 브랜치에 커밋해 두고 보고만 하는 것으로 끝내지 않는다.

네 브랜치 `claude/admin-accounts`에 커밋 26개 · 78파일이 쌓여 있는데 PR이 없다. 그래서 밖에서는 아무것도 안 된 것으로 보인다. 오늘 다른 세션이 같은 모양이었고, 사용자가 다 끝난 일을 안 된 줄 알고 기다렸다.

지금 하라.

1. **`main`을 브랜치에 머지한다.** main이 오늘 크게 움직였다 — 규칙이 여럿 들어갔으니 머지한 뒤 `CLAUDE.md`를 다시 읽어라.
2. **초록으로 만든다** — typecheck · lint · 카피 린트 · jest(api · mobile · ui · web). 빨간 PR은 검수를 못 받는다.
3. **PR을 건다.** 본문에 무엇이 어떻게 달랐고 무엇으로 고쳤는지 적는다. 못 고친 것과 판단이 필요한 것은 **따로** 적는다 — 「판단 필요」를 조용히 「완료」에 섞지 마라. 초안(draft)으로 올려도 되고 머지 여부는 MASTER가 정한다.

아직 설계 단계라 구현이 덜 됐으면 **거기까지를 draft PR로 올리고 본문에 어디까지 왔는지 적어라.** 완성될 때까지 숨겨두는 것이 가장 나쁘다.

머지 후 새로 읽을 규칙 중 네 작업에 걸리는 것: 화면은 목업과 1:1(토큰에 값이 없으면 목업 값을 더한다) · 관리자 캔버스 1920 · 위험한 조작은 무엇이 바뀌는지 보여준 뒤 한 번 더 · 사람에게 말하는 시각은 KST · 마이그레이션은 0102부터.
```

## 배지 잘림 — PR #169 typecheck 실패 원인

- `trig_01N1qLwHGoyKFFTiwZuBj61K` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-10T08:29:54

```
MASTER다. PR #169의 CI가 **Typecheck에서 깨졌다**(run 34455036813 · f233fbc). 로컬에서 재현해 원인을 확인했으니 그대로 고치고 다시 푸시해라. 진단은 이미 끝났으니 다시 파지 말 것.

` ` `
apps/api/src/test/badge-box.test.ts(57,28): TS2345 'string | undefined' → 'string'
apps/api/src/test/badge-box.test.ts(59,62): TS2345 'string | undefined' → 'string'
apps/api/src/test/badge-box.test.ts(62,46): TS2322 'string | undefined' → 'string'
apps/api/src/test/badge-box.test.ts(62,52): TS2322 'string | undefined' → 'string'
` ` `

원인은 이 한 줄이다.

` ` `ts
const [, name, body] = match;
` ` `

이 저장소는 `noUncheckedIndexedAccess`가 켜져 있어서 정규식 그룹 구조분해가 `string | undefined`로 나온다. 매치가 됐으니 값이 있다는 것은 사람은 알지만 컴파일러는 모른다.

바로 아래에 걸러 주면 넷이 한꺼번에 사라진다.

` ` `ts
const [, name, body] = match;

if (!name || !body) continue;
` ` `

`match.index ?? 0`은 이미 그렇게 처리해 뒀으니 같은 방식이다.

**푸시 전에 반드시 로컬에서 확인해라** — 나는 `npm run typecheck`로 이 넷을 재현했다. 고친 뒤 같은 명령이 0으로 끝나는 것을 보고, jest(api · mobile) · lint · 카피 린트까지 돌린 다음 푸시한다. 한 번에 초록으로 만드는 것이 두 번 미는 것보다 낫다.

내용 자체는 좋다. `height: 22` 대 `padding 4 + lineHeight 19 = 27`을 짚어낸 것과, 화면 25곳이 아니라 상자 하나에서 고친 것, 재발을 `badge-box.test.ts`로 막은 것 셋 다 맞는 방향이다. 초록 되면 보고 올려라 — 무엇이 몇 건 잘렸고 무엇으로 고쳤는지 표로.
```

## 관리자 계정·권한 — v3.27 관리자 규칙

- `trig_01PvtGMHxfVe5eArb93vacVc` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-10T08:14:37

```
MASTER다. 사용자 지침 추가다. **최신 디자인 md를 항시 확인한다** — 화면에 손대기 전에 매번 `docs/design/handoff/CHANGELOG.md` 맨 위를 읽는다. **현 기준 최신은 v3.27(2026-09-10)이다.**

네가 만들 계정관리 화면에 그대로 걸린다. v3.27의 관리자 규칙을 따른다.

` ` `
캔버스        1920×1080 (사이드바 240 + 본문). 1440 아니다
공통 규칙 4   지금 봐야 할 것이 맨 위(상단 배너가 상태를 먼저 말함)
              빈 상태가 정상 상태(「확인할 것이 없어요」를 반드시 그림)
              표는 카드 안에서만 스크롤(화면 전체가 흔들리지 않음)
              위험한 조작은 무엇이 바뀌는지 항목으로 보여준 뒤 한 번 더
` ` `

**「위험한 조작은 한 번 더」가 네 과제의 핵심에 닿는다.** 계정 생성 · 권한 승격 · 계정 정지는 전부 여기 해당한다. 「정말 하시겠어요?」가 아니라 **무엇이 바뀌는지를 항목으로 보여준 뒤** 진행한다.

관리자 화면은 `AI` 금지어 예외다(사용자 화면만 금지). 그 외 값 하드코딩 금지·토큰 사용 규칙은 그대로다.

`ADMIN.md`와 `20-admin.dc.html` · `21-admin.dc.html` · `22-admin-ops.dc.html`을 v3.27 기준으로 읽고 설계 보고에 반영해라. 앞서 보낸 결정(권한 3등급 · 마이그레이션 0102부터 · 로그인은 권한을 주지 않음 · 환경변수 전용 부트스트랩)은 그대로 유효하다.
```

## 웹뷰 디자인 — 최신 md 확인 지침

- `trig_01WrBMoBgQqRJPeTqCDU1L62` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-10T08:14:18

```
MASTER다. 사용자 지침 추가다. **최신 디자인 md를 항시 확인한다** — 화면에 손대기 전에 매번 `docs/design/handoff/CHANGELOG.md` 맨 위를 읽는다. 기억하고 있는 버전이 아니라 그때 파일에 적힌 것이 현행이다. **현 기준 최신은 v3.27(2026-09-10)이다.**

앞서 보낸 5건(데이트피커 · 온보딩 v2 · 얼굴 잘림 · 로더 · 검색 UX)은 그대로 진행하되, 각 항목을 손대기 직전에 CHANGELOG 상단부터 그 항목까지를 다시 읽고 최신 사양인지 확인한 뒤 고친다.

v3.27 자체는 관리자 화면 변경이라 네 5건과 직접 겹치지 않는다. 다만 v3.26이 스타일 이미지 4장을 실제 웨딩 컷으로 교체했으니 **3번(얼굴 잘림)은 그 교체된 이미지가 대상이다.**

다시 강조한다: CHANGELOG는 최신이 위다. 아래 있는 것을 「나중 것」으로 읽어 폐기된 사양으로 되돌리지 마라.
```

## 관리자 콘솔 — v3.27 기준 갱신

- `trig_0147LjAFLaCfhwSximZUKvLB` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-10T08:13:58

```
MASTER다. 사용자 지침이 추가됐다. **최신 디자인 md를 항시 확인한다** — 화면에 손대기 전에 매번 `docs/design/handoff/CHANGELOG.md` 맨 위를 읽는다. 기억하고 있는 버전이 아니라 그때 파일에 적힌 것이 현행이다. **현 기준 최신은 v3.27(2026-09-10)이다.**

이게 네 과제를 바꾼다. v3.27이 관리자에 셋을 바꿨다.

` ` `
기준 해상도   1440×900 → 1920×1080  (사이드바 240 + 본문)
              감사 기록처럼 컬럼이 많은 표가 1440에서 가로 스크롤 없이 안 들어갔다
신설 화면 11  WP-ADM-002 일일 브리핑 · 013 이상치·조작 탐지 · 015 이미지 자동 수급 ·
              016 이메일 회신 자동 매칭 · 030 마케팅 자동화 · 032 수익 현황 ·
              040 자동화 상태 · 041 긴급 중지 · 042 변경 복구 관리 ·
              051 정책 규칙 관리 · 052 감사 기록
공통 규칙 4   지금 봐야 할 것이 맨 위(상단 배너가 상태를 먼저 말함)
              빈 상태가 정상 상태(「확인할 것이 없어요」를 반드시 그림)
              표는 카드 안에서만 스크롤(화면 전체가 흔들리지 않음)
              위험한 조작은 무엇이 바뀌는지 항목으로 보여준 뒤 한 번 더
` ` `

**대조표를 「32화면 대 26화면」으로 짜지 마라.** v3.27로 시안이 늘었으니 지금 `docs/design/handoff/screens.json`과 `html/`을 다시 세어 그 수를 쓴다. 신설 11화면은 코드에 아예 없을 가능성이 높다 — 있는지 없는지부터 확인한다.

`ADMIN.md`와 `20-admin.dc.html` · `21-admin.dc.html` · `22-admin-ops.dc.html`도 v3.27 기준으로 다시 읽는다.

CHANGELOG는 최신이 위다. 같은 항목이 여러 버전에 나오면 위쪽이 이긴다 — 아래 있는 것을 「나중 것」으로 읽어 폐기된 사양으로 되돌리지 마라.
```

## 웹뷰 디자인 — 사용자 오더 5건 할당

- `trig_01WsnSxFLSg3s4MHbFyKXUuS` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-10T08:08:09

```
MASTER다. 사용자 오더 5건을 전담 배정한다. 앞서 보낸 1차 보고 요청보다 **이것이 우선**이고, 보고는 이 5건 기준으로 낸다.

기준 문서는 `docs/design/handoff/`다. 코드·이전 규칙과 충돌하면 묻지 않고 최신 md 쪽으로 코드를 맞춘다. CHANGELOG는 최신이 위다 — 같은 항목이 여러 번 나오면 **위쪽 버전이 이긴다**(예: 데이트피커는 v3.19의 휠 3열이 아니라 v3.21의 WP-APP-023이 현행이다).

## 1. 데이트피커가 목업과 다르다
현행 사양은 **WP-APP-023 연월 셀렉트 + 일 달력**(CHANGELOG v3.21 · `SPEC.md` 13.7). v3.19의 「휠 3열」은 폐기된 것이니 그쪽으로 되돌리지 마라.
` ` `
셀렉트 2개   연 · 월 · 높이 52 · 열림 시 coral 1.5px
연도 펼침    4열 그리드 · 올해부터 5년 뒤
월 펼침      4열 12칸
달력         요일 헤더 28 + 날짜 셀 40
             일요일 · 토요일 · 타월 색 구분
선택 결과    2027.05.16(토) + D-250
CTA          56 · width 100%
` ` `
코드의 실제 값과 위를 항목별로 대조해 어긋난 것만 고친다. **색·크기·간격·문구는 `spec/tokens.json` · `spec/strings.ko.json`에서만 가져온다. 하드코딩 금지** — 위 수치는 대조용이지 코드에 그대로 적으라는 뜻이 아니다. tokens에 해당 값이 없으면 임의로 만들지 말고 시안의 어느 값을 쓸지 근거와 함께 보고한다.

## 2. 온보딩이 변경된 시안으로 반영 안 됨
`docs/design/handoff/html/20-onboarding-v2.dc.html`가 기준이다. 1/5~5/5 전 단계를 코드와 1:1로 대조하고 차이를 표로 만든 뒤 고친다.

## 3. 5/5 스타일 이미지에서 사람 얼굴이 잘린다
네 장(도시적인 · 자연스러운 · 로맨틱한 · 화려한) 모두 얼굴이 프레임 밖으로 나간다. 이미지를 바꾸지 말고 **표시 위치를 조정**한다(`object-position` / `resizeMode` + 정렬). 사진마다 얼굴 위치가 달라 한 값으로 넷을 다 맞출 수 없으면 장별로 따로 준다. 스타일은 `WeddingStyle` 넷뿐이고 라벨은 도시적인 · 자연스러운 · 로맨틱한 · 화려한이다.

## 4. 5/5 → 결과 이동 시 로더를 업종 아이콘 순회로 바꾼다
원형 스피너를 쓰지 않는다(CHANGELOG v3.20 「로더 통일 · 원형 스피너 폐기」). 온보딩 완료 후 추천 계산 구간은 **WP-ST-015 업종 순회 로딩**이다.
` ` `
크기        작게 20(버튼·행 안) · 보통 28(카드·시트) · 크게 40(화면 전체)
노출 규칙   응답이 700ms를 넘으면 화면 성격과 무관하게 띄운다. 빈 화면·멈춘 화면 금지
아이콘      12업종 · 온보딩 진행 상황 선택지와 1:1
제외        온보딩에서 결정 완료로 고른 업종은 순회에서 뺀다
속도        전체 화면 아이콘당 620ms · 작은 로더 820ms
제목        «{닉네임}님에게»
` ` `
이미 저장소에 로더 컴포넌트가 있으면 새로 만들지 말고 그것을 쓴다.

## 5. 검색 메뉴 UX — 특히 잘 비교하라
`html/06-search.dc.html` 기준. 확정된 규칙 둘을 반드시 지킨다.
- **검색은 온보딩 값을 미리 걸지 않는다**(v3.21 「홈과 검색의 역할 분리」). v3.17에서 온보딩 값을 기본 필터로 걸었던 것은 되돌려졌다. 필터 시트도 온보딩 값 선택 상태로 열지 않는다.
- 검색 홈 「많이 본 곳」은 내 지역이 아니라 **전체** 기준이다.
- 카테고리 칩 · 목록/지도 토글은 없다. 정렬은 셀렉트 시트다.

## 공통
- 사용자 화면 금지어: AI · 데이터 · 탐색 · 관심업체 · 확인된 제보 · 확인된 정보 · 네이버페이 포인트 · 우리 준비 · 오늘의 Pick. `탐색`은 `검색`, `관심업체`는 `Pick`.
- Pick Mark SVG 절대 변경 금지.
- 이 저장소에서 prettier를 돌리지 않는다(설정이 없고 작은따옴표를 쓴다).
- 커밋 트레일러는 저장소 규칙대로. **모델 식별자를 커밋 메시지·PR 본문·주석에 넣지 않는다.**
- main이 방금 크게 움직였다(PR #167, main=af698bd). 손대기 전에 main을 브랜치에 머지한다.
- 브랜치는 `claude/webview-design`. 테스트(mobile jest · typecheck · lint · 카피 린트 · typography)를 전부 돌려 초록인 것을 확인한 뒤 PR을 올린다. `typography.test.ts`가 하드코딩 fontSize/lineHeight를 잡으니 미리 돌려라.

5건 각각에 대해 **무엇이 어떻게 달랐고 무엇으로 고쳤는지**를 표로 보고한다.
```

## 인앱 브라우저 탈출 — 1차 보고 요청

- `trig_01XtsYBPvoXo5fmRr6T5ssF7` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-10T08:03:21

```
MASTER다. 1차 보고를 올려라. 카카오톡·인스타 등 인앱 브라우저에서 링크를 열었을 때 크롬·사파리로 넘기는 방법을 OS별(안드로이드 intent:// · iOS x-safari-https / 안내 UI 폴백)로 정리하고, 무엇을 구현했는지.

main이 방금 움직였다(PR #167 머지, main=af698bd). **먼저 main을 브랜치 claude/inapp-browser에 머지**하고 이어간다.

전제: 랜딩(WeddingPick-웹사이트)과 웹뷰(WeddingPick-웹뷰) 둘 다 대상이고, 값과 문구는 spec에서 가져온다. 자동 리다이렉트가 막히는 경우가 있으니 「크롬으로 열기」 같은 사용자 조작 폴백을 반드시 함께 둔다.
```

## 웹뷰 디자인 — 1차 보고 요청

- `trig_01ANHanrrzYCuUBw4ACwdYuX` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-10T08:03:07

```
MASTER다. 1차 보고를 올려라. 최신 시안·목업과 weddingpick-app-web 화면의 차이 대조표(화면 · 어긋난 항목 · 시안값 · 코드값 · 심각도)와, 브랜치 claude/webview-design에 지금 커밋된 것.

main이 방금 크게 움직였다(PR #167 머지, main=af698bd). 관리자 화면 색 토큰화·타이포 토큰화가 들어갔으니 **먼저 main을 브랜치에 머지**하고 남은 차이만 본다.

규칙 재확인: 값은 spec/tokens.json · spec/strings.ko.json에서만 가져온다(하드코딩 금지). 사용자 화면 금지어(AI · 데이터 · 탐색 · 관심업체 · 확인된 제보 · 네이버페이 포인트 · 우리 준비 · 오늘의 Pick). Pick Mark SVG 변경 금지.
```

## 관리자 콘솔 — 1차 보고 요청

- `trig_01Fn2xBxxuykqpAEEoHM9a5C` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-10T08:02:53

```
MASTER다. 1차 보고를 올려라. 시안 32화면 대 코드 26화면 대조표(있는 것 · 없는 것 · 어긋난 것)와, 지금 브랜치 claude/admin-console에 무엇이 커밋돼 있는지.

참고로 main이 방금 크게 움직였다(PR #167 머지, main=af698bd). 관리자 로그인(/admin/login)·관리자 토큰(_api)·og-card 화면·adminChrome 토큰·서버 없는 단추 22개 잠금이 전부 main에 들어갔다. **작업 전에 main을 브랜치에 머지해 겹치는 것을 먼저 걷어내라.** 그 위에서 남은 차이만 보고한다.
```

## 관리자 계정·권한 — MASTER 결정 전달

- `trig_01C9ERwAgd3LMr4ux9NWqtV3` · 주기 없음(쪽지형) · 켜짐 · 만든 때 2026-09-10T08:02:34

```
MASTER 결정이다. 물어본 둘 다 승인이며, 이 방향으로 확정해 진행한다.

(1) 단일 게이트 인증 + 관리자 생성 경로 전면 테스트 커버리지 — 승인.
    단, 이미 확정된 원칙을 깨지 않는다: **로그인 경로는 권한을 주지 않는다.**
    `POST /v1/admin/login`은 「이 아이디의 주인인가」까지만 하고, 권한 부여·변경은
    별도 경로(운영권한 워크플로 · 계정관리 화면)에서만 한다. 새 계정 생성 API도
    같은 규칙을 따른다 — 생성한 사람의 권한을 확인한 뒤에만 만들고, 만든 계정에
    자기 권한 이상을 줄 수 없다.

(2) 환경변수 전용 부트스트랩(코드에 id 없음 · 복구는 환경에서만) — 승인.
    ADMIN_LOGIN_ID / ADMIN_PASSWORD_HASH는 이미 GitHub Secrets → render-env-sync로
    운영 API 서버에 들어가 있다(2026-09-10 확인). 같은 메커니즘만 쓴다.
    **코드·주석·커밋·PR 본문에 실제 아이디나 해시를 적지 않는다.**

권한 등급은 사용자 오더대로 셋이다:
  슈퍼 관리자  jsexy0210 — 계정 생성·권한 부여 포함 전부
  운영자       실질 운영 권한(심사 · 승인 · 지급 기록 등), 계정 관리는 못 함
  뷰어         읽기만

지금 DB에는 `users.is_operator` 불리언 하나뿐이다. 등급을 넣으려면 마이그레이션이
필요한데 **번호는 0102부터 쓴다** — 0100(admin_identity) · 0101(vendor_import_holds)이
이미 main에 적용됐다(run 34452449496 success). 번호 충돌로 마이그레이션이 조용히
빠진 적이 오늘 한 번 있었다.

기존 것을 깨지 않는다: `is_operator`를 쓰는 자리가 서버 전체에 퍼져 있으므로 등급을
더하더라도 `is_operator`는 「운영자 이상」으로 계속 참이어야 한다.

먼저 설계 보고를 올리고(마이그레이션 스키마 · 라우트 목록 · 화면 구성 · 권한 표),
승인 뒤 구현한다. 브랜치는 claude/admin-accounts 그대로.
```


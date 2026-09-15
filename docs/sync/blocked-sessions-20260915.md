# 막힌 세션 넷과 rn-preview 검수 결과

2026-09-15 03:02 KST 감시 10주기가 올린 건이다. **이 세션에는 다른 세션에 말을
거는 수단이 없다**(`send_message` 도구 없음). 그래서 내가 할 수 있는 검수만 하고,
푸는 것은 대표님이 각 세션 화면에서 해주셔야 한다.

---

## 1. rn-preview — 검수했다. **이대로 두면 운영에 구멍이 난다**

세션이 「MASTER가 SHA `b285f0b0`를 봐 달라」고 했다. 봤다.

**만든 것 자체는 옳다.** `scripts/build-preview.mjs`는 빌드 산출물(`dist/*.html`)에만
스크립트를 얹고, 만드는 두 파일은 `dist/` 안에 있으며 `dist/`는 `.gitignore`다.
`apps/mobile/src/**`와 `packages/**`는 0줄 변경이다. `/login`·`/setup`을 건드리지 않아
로그인 화면 디자인도 그대로 보인다.

**부르는 자리가 틀렸다.**

    apps/mobile/package.json   "export:web": "... && node ../../scripts/build-preview.mjs"
    render.yaml:80             weddingpick-app-web  buildCommand: npm run export:web …
    render.yaml:146            weddingpick-admin    buildCommand: npm run export:web …

Render 배포가 `export:web`을 부른다. **이 브랜치가 main에 닿는 순간 앱 웹과 관리자
두 곳 모두 로그인 우회와 픽스처 가로채기가 박힌 채로 배포된다.**

커밋 메시지는 「claude/rn-preview 전용. main에 올리지 않는다」고 적었다. 그것은
약속이지 장치가 아니다. CLAUDE.md가 이미 못박아 둔 자리다 —
**「캡처일 때는 통과」를 제품 코드에 넣지 않는다. 그 구멍이 운영에 나간다.**

`package.json`의 빌드 스크립트는 「제품 코드가 아니다」로 볼 수 없다. **배포가 실제로
부르는 것**이 거기 적혀 있다.

### 고치는 법 — 작다

`export:web`을 그대로 두고 **`preview:web`을 따로 만든다.**

    "export:web":  "node ../../scripts/ensure-modules.mjs && expo export --platform web"
    "preview:web": "npm run export:web && node ../../scripts/build-preview.mjs"

대표님 프리뷰를 만들 때만 `preview:web`을 부른다. Render는 계속 `export:web`을
부르므로 브랜치가 어디로 가든 우회가 배포에 섞이지 않는다.

**세션에 남은 다른 요청(Bash 권한으로 빌드 검증)은 이 수정 뒤에 해도 늦지 않다.**

---

## 2. identity-purge — **작업이 저장돼 있지 않다. 가장 급하다**

    session_01P4YicagRBx8k8MtWveYMkP · 커밋 권한이 막혀 있음 · 22:56 KST 이후 멈춤

원격 브랜치 `claude/identity-purge`를 확인했다. 거기 있는 것은 **1단계 계수
스크립트와 보고서 두 파일뿐**이다.

    scripts/identity-purge-count.sql   91줄 (읽기 전용)
    docs/identity-purge-step1.md       97줄

세션이 「14개 파일 + 마이그레이션 0250 + 시험이 준비됐다」고 한 그 패치는 **원격에
없다.** 컨테이너 안에만 있고, 컨테이너가 회수되면 사라진다.

**대표님이 그 세션에서 `git add`·`commit`·`push`를 허용해 주셔야 한다.** 다른 셋은
답을 기다릴 뿐이지만 이것은 시간이 지나면 없어진다.

---

## 3. report-manual-entry — 답을 정했다

    session_01Ki47… · 22:08 KST부터 대기 · 「MyReport 응답 계약에 pendingFields 추가 승인」

**승인한다.** 다만 조건 둘을 붙인다.

- **이름을 담지 않는다.** 아직 안 채운 칸이 무엇인지를 **칸 이름(키)** 으로만 준다.
  값이나 사람 이름이 그 배열에 들어가면 그것은 응답이 아니라 유출이다.
- **화면 문구를 서버가 만들지 않는다.** 「무엇을 더 확인해야 하는지」를 서버가
  문장으로 적어 내려보내면 금지어 검사를 지나지 않는 말이 화면에 뜬다. 키만 주고
  문장은 `spec/strings.ko.json`이 만든다.

---

## 4. public-data-resume — 업종 결정 3건

    session_01DqSN… · 00:12 KST부터 대기

대표님이 이미 정하신 것이 있어 그대로 적용한다.

| 물은 것 | 답 |
| --- | --- |
| 청첩장 규칙 | **업종으로 유지하고 계속 수집한다.** A-12(청첩장·예물·허니문 수집 추가)가 유효하다. 상담 녹음만 안 받는 것이고(2026-09-14 P-2) 수집과는 다른 얘기다 |
| 한복 | **웨딩 업종에서 뺀다**(A-15). 수집 대상이 아니다 |
| catch-all | **`etc`로 떨어뜨리되 화면에 업종으로 내놓지 않는다.** `PREPARATION_CATEGORIES`가 이미 `etc`를 뺀다 — 분류가 안 되는 업체를 담는 칸이지 준비 단계가 아니다 |

`G21701`·`N10501` 코드 판단은 그 세션이 실제 데이터를 보고 있으므로 그쪽이 정한다.
**다만 코드가 어느 업종으로 가든 이름은 `VENDOR_CATEGORY_LABEL` 그대로 쓴다** —
같은 것을 두 이름으로 부르지 않는다(2026-09-11 대표 지시).

---

## 대표님이 해주셔야 하는 것

1. **identity-purge 세션에 커밋 권한** — 가장 급하다. 안 하면 14파일이 사라진다
2. rn-preview 세션에 위 1번 수정을 전달(또는 Bash 권한)
3. report-manual-entry · public-data-resume 세션에 위 3·4번 답 전달

셋 다 내가 직접 전할 수 없다. 이 세션에 세션 간 메시지 도구가 없다.

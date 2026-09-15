# 디자인·UX라이팅·영문표기 전수 검수 (2026-09-15)

대표 지시: 디자인 틀어짐·간격·패딩·컴포넌트·토스식 UX라이팅·영문 표기를 전수 검수한다. 특히
**3Depth 화면**에 디자인이 안 입혀져 있는지를 가장 먼저 본다. **다른 검수 세션(「흐름이 끊기는가 ·
기능이 되는가」)과 역할이 갈린다 — 이 문서는 「보이는 것이 맞는가 · 말이 맞는가」만 본다.**

이 문서는 **찾아서 적은 것**이다. 코드는 고치지 않았다(제품 코드 기준). 수정은 각 항목의 ⑤에
지시로만 남긴다 — MASTER가 담당 세션에 나눠 배정한다.

## 0. 방법·범위

- **뎁스 정본은 `apps/mobile/src/features/navigation/depth-back-rules.ts`다.** 손으로 화면 목록을
  만들지 않고, 그 파일이 내보내는 `ROUTES`·`hasDepthBack`·`depthBackTarget`를 그대로 실행해 뽑았다
  (스크립트: TypeScript 컴파일러로 그 파일만 트랜스파일해 로드 → 각 라우트에서 `depthBackTarget`을
  루트(탭 또는 `NO_BACK_ROUTES`)에 닿을 때까지 반복 적용해 홉 수를 셌다. 루트=1).
  - 관리자(`/admin/**`)는 제외했다 — 좌측 사이드바가 이동을 맡는 별도 체계이고, 대표님이 말한
    "사용자 화면 103개"의 모수가 아니다.
  - **admin 제외 사용자 라우트 총 106개**(피그마가 그린 12개 포함). Depth 1(=14, 탭 루트·온보딩
    ·로그인 등 뒤로가기 없는 화면) · **Depth 2(=48)** · **Depth 3 이상(=43, Depth3 30 · Depth4 12
    · Depth5 1)** · 나머지는 Depth 1에 포함.
  - **숫자 참고**: 대표님이 말한 "103개"와 이 106개는 정확히 일치하지 않는다 — 카운트 방식(파일
    존재 기준 vs 실제 진입 가능 화면 기준)이 다를 수 있어 정확한 대조는 못 했다. 이 문서는
    `depth-back-rules.ts` 기준 106개를 전수로 삼았다.
- **3Depth 이상 43개는 전부 실제로 렌더해서 스크린샷을 찍었다**(`node scripts/screenshot-screens.mjs
  --edges`, Playwright 헤드리스). 2Depth 48개도 전부 찍었다. **눈으로 코드만 읽은 항목은 없다** —
  「못 찍었다」로 명시한 1개(`/wedding/[id]`, 로컬 전용 화면이라 서버 fixture로 못 채움) 제외.
- **캡처 함정 두 가지를 그대로 지켰다**: (1) fixture·토큰이 없으면 화면이 오류/시작 상태로
  떨어진다 — 캡처 전마다 `fixture 없음` 경고를 확인하고 `scripts/fixtures/api.cjs`를 실제 zod
  계약 기준으로 보강한 뒤(§10) 다시 찍어 확인했다. (2) 카드 안쪽 패딩은 좌우 어긋남으로 세지
  않았다 — `--edges`가 잡은 값 중 **바깥 끝선만** 어긋남으로 판정했다.
- **팀 구성**: A조(`/capture/*`·`/my/*` 3Depth 20개) · B조(`/search/*`·`/wedding/*`·`/pick/*`
  3Depth 23개) · C조(2Depth 48개) · 컴포넌트 규격화 · 카피 · 영문 표기, 총 6갈래 병렬 검수.
- **스크린샷 원본은 저장소에 없다**(용량 때문에 커밋 안 함, 저장소 규칙). 세션 임시 폴더
  `/tmp/wp-audit-a` · `/tmp/wp-audit-b` · `/tmp/wp-audit-c`에 있고, PR 본문에 핵심 그림만 붙인다.

---

## 1. 요약 — 급한 순

### 못 쓴다
| 항목 | 어디서 | 근거 |
|---|---|---|
| 로그인 화면 영문 eyebrow "WEDDING, LESS OVERWHELMING" | `apps/mobile/src/app/login/index.tsx:60,106,122` | §6-①. 앱 최초 진입 화면에 노출 |
| 하단 탭 바 전체 영문 "MY" | `features/navigation/root-tabs.ts:38` · `tab-bar.tsx:93` | §6-②. 모든 화면 하단 상시 노출 |
| MY 탭 첫 화면 제목 "MY"(26px 본제목) | `app/(tabs)/my/index.tsx:63,235` | §6-③ |

### 불편하다 (구조적·다수 화면 반복)
| 항목 | 범위 | 근거 |
|---|---|---|
| **날짜가 원문 ISO 그대로 노출**(`2026-10-10T02:00:00.000Z`) | 박람회·웨딩정보 목록/상세 4곳 + 웨딩노트 견적 1곳 변형 | §4-CC4 |
| **뒤로가기 아이콘이 화면마다 3~4갈래**(←/‹/텍스트) | 3Depth 43개 중 다수 + 2Depth 48개 중 47개 | §4-CC1 |
| **탭바가 딥링크 직접 진입 시 안 숨음** | `/my/*`(20개 중 13개, 7개는 예외) · `/wedding/*`(16/16) · `/pick/*`(4/4) 전부 재현 | §4-CC2 |
| 공용 `TextField` 대신 raw `TextInput`(포커스·오류 표시 없음, 테두리색 오류 포함) | 최소 11개 화면 | §4-CC3 |
| `/wedding/[id]/expenses/[expenseId]` "업체" 행에 업체명 아닌 지출명 표시 | 1개 | §7-⑤ |
| Pick 카테고리 후보 목록 — Primary 버튼이 후보 수만큼 동시에 강조됨 | `/pick/category`(대괄호 동적) | §5-1 (확인 필요) |
| 서브카피·Primary CTA 1개 규칙과 실제 `Hero` 컴포넌트(40여 곳)가 충돌 | 전역 | §5-0 (대표님 판단 필요) |

### 눈에 거슬린다
카드 안쪽 패딩 16/20 혼용(7곳) · `radius.picker` 미사용(2곳) · 관리자 radius/색 하드코딩(132곳/33곳)
· `CategoryCycleLoader` 컴포넌트 레벨 잔존(5+ 화면) · `/pick/category` "undefined 검색" 노출 ·
Pick 띄어쓰기 불일치 · 영문 표기 10건(TOP 3·관리자 표 헤더 등) · 문체(해요체/합쇼체) 혼용 2건 —
전부 아래 각 절 참고.

### 확인 필요(대표님 판단, 이 세션은 정하지 않음)
- **§5-0**: "섹션 제목 1줄·서브카피 없음·Primary CTA 1개" 규칙 문장과, 실제 공용 `Hero` 컴포넌트가
  서브카피를 그리고 있는 것 중 어느 쪽이 낡았는가.
- **§6-⑭**: Google·Apple·Outlook 같은 제3자 서비스 고유명사를 "Pick·Npay 둘뿐" 예외에 추가할지.
- **§6-⑫**: 관리자 og-card 미리보기의 도메인 문자열(`weddingpick-web.onrender.com`)을 그대로 둘지.
- **§5-1**: Pick 후보 목록 Primary 버튼 반복이 피그마 의도인지(피그마 대조 필요, 이 세션은 접근 불가).

### 좌우 끝선·②(간격/패딩)
**91개 화면(3Depth 43 + 2Depth 48) 전부 바깥 좌우 끝선 20/20 일치 — 새로 발견한 위반 0건.**
로그인·온보딩 20(24여야 함)은 이미 배정된 항목이라 다시 적지 않는다.

---

## 2. ① 3Depth+ 화면 검수 (43개) — 대표님이 가장 걱정하신 자리

### 결론부터
**"디자인이 아예 안 입혀진 화면"(RN 기본값이 그대로 노출되는 수준)은 찾지 못했다.** 43개 전부
`packages/ui` 토큰(카드 radius·간격·타이포)을 어떤 형태로든 참조하고 있었다. 대신 **구조적으로
반복되는 결함**(뒤로가기 부품 불일치, 탭바 미숨김, 공용 입력칸 미사용, 날짜 미포맷)이 3Depth
전역에 걸쳐 있었다 — "아무도 본 적 없는 깊은 화면일수록 깨져 있을 것"이라는 우려가, "완전히
빈 화면"이 아니라 **"공용 부품을 빠뜨린 채 각자 새로 그린 화면"** 형태로 실현됐다.

### A조 — `/capture/*`·`/my/*` (20개)

| # | 라우트 | 뎁스 | 이상 | 급한가 |
|---|---|---|---|---|
| 1 | /capture/analysis/[id] | 3 | 없음(양호) | — |
| 2-9 | /capture/payment/consent·register·quote/consent·result/[quoteId]·review·sample·verify-status/[requestId]·verify/[quoteId] | 3-4 | CC1(뒤로가기 ‹) | 눈에 거슬림 |
| 10-13,20 | /my/biz/benefit·claim·data·/my/rebuttals/[reviewId]·/my/vendor-claims/[vendorId] | 3 | CC1(←)·CC2(탭바)·CC3(raw TextInput) | 불편하다 |
| 14,19 | /my/referral·/my/rewards/promotion | 3 | CC2·CC3(입력칸만) | 불편하다 |
| 15-17 | /my/rewards/fund·history·missions | 3 | CC2, missions는 추가로 「Pick」 띄어쓰기(§7-⑥) | 불편하다 |
| 18 | /my/rewards/npay | 3 | CC2만(그 외 모범 사례) | 불편하다 |

전문 표·근거는 세션 스크린샷(`/tmp/wp-audit-a/*.png`, 20장)과 함께 아래 §4에 통합 정리.

### B조 — `/search/*`·`/wedding/*`·`/pick/*` (23개)

| # | 라우트 | 뎁스 | 이상 | 급한가 |
|---|---|---|---|---|
| 1 | /pick/removed | 3 | CC1(‹)·CC2 | 불편하다 |
| 2,3,18,19 | /search/[vendorId]·/autocomplete·/review/[reviewId]·/reviews | 3-4 | 없음(양호) | — |
| 4,5,21,22 | /search/expo(+[expoId])·/wedding-info(+[infoId]) | 3-4 | **CC4(날짜 원문 ISO)**·CC1 | 불편하다 |
| 6-11 | /wedding/[id]/events/[eventId]·/new·/expenses/[expenseId]·/add·/list·/verify | 3 | CC2, `[expenseId]`는 추가로 §7-⑤ | 불편하다 |
| 12-14,20 | /search/[vendorId]/booking·consult·edit-review·write-review | 4 | **CC3(테두리색 오류)** | 눈에 거슬림 |
| 15 | /search/[vendorId]/fix-report | 4 | CC1(‹)만, 그 외 양호 | — |
| 16 | /search/[vendorId]/images | 4 | **CC1 4번째 변형 — 아이콘 없는 "돌아가기" 텍스트** | 눈에 거슬림 |
| 17 | /search/[vendorId]/price-report | 4 | v3.24 폐기, `<Redirect>`뿐 — 검수 대상 화면 없음 | — |
| 23 | /search/expo/[expoId]/calendar | 5 | 없음(양호, 날짜 정상 포맷) | — |

**못 찍은 화면 없음(A·B조 43개 전부 정상 콘텐츠 상태로 캡처 완료).**

---

## 3. ② 좌우 끝선·간격·패딩

**91개(3Depth 43 + 2Depth 48) 전부 `--edges`로 측정 — 바깥 좌우 끝선은 20/20으로 일관됐다. 새로
발견한 위반은 0건.** 카드 안쪽 패딩·라벨 정렬(예: 좌 56/우 20, 좌 41/우 41)은 지시대로 어긋남에서
제외했다. nav 타이틀이 뒤로가기 아이콘 폭만큼 안쪽에서 시작하는 「좌 60 우 20」류 비대칭도 모든
nav-bar 화면에 공통인 구조적 정상 값이라 제외했다.

카드·배지·버튼 자체의 radius·padding **값**은 대부분 토큰을 참조하고 있었다(하드코딩 hex/px는
컴포넌트 감사 §4에서 별도로 다룬다 — "끝선"과 "패딩 값"은 다른 문제다).

---

## 4. 구조적으로 반복되는 문제 (Cross-Cutting, CC1~CC8)

3Depth·2Depth 검수에서 여러 화면에 걸쳐 반복된 문제를 한데 모았다. 같은 원인이면 한 번만 고쳐도
전 화면에 반영된다 — 화면별로 따로 고치지 않도록 원인 파일을 명시한다.

### CC1 — 뒤로가기 아이콘·크기가 3~4갈래로 갈린다 (거의 전 화면)

① 무엇이 — 좌상단 뒤로가기 버튼의 **아이콘 모양·크기**가 같은 "상세 화면"인데 부품마다 다르다.
CLAUDE.md 자신이 "뒤로 가기 단추의 자리는 상세 화면끼리 같다. 한 화면만 다르면 그 화면이 고장 난
것처럼 보인다"고 못 박은 규칙에 정면으로 걸린다.

② 어디서 — 네 갈래 구현.
  - `BackButton`(`apps/mobile/src/components/back-button.tsx:58-62`) — `arrowLeft`(←, 획 1.9) ·
    크기 20(`Layout.iconRow`). `BackBar`가 이것을 씀. 사용처: `/my/biz/*`·`/my/rebuttals/[reviewId]`
    ·`/my/vendor-claims/[vendorId]` 등.
  - `NavBar`(`apps/mobile/src/features/wedding/screen-kit.tsx:80-84`) — `chevronLeft`(‹) · 크기 24
    (`Layout.iconTab`). 사용처: `/capture/*` 9개 전부, `/pick/removed`, `/search/expo*`,
    `/wedding/[id]/events*`, `/wedding/[id]/expenses*` 등 다수.
  - `SubScreen`(`apps/mobile/src/features/settings/my-kit.tsx:73-75`) — 인라인으로 역시
    `chevronLeft`·24를 또 따로 그림(BackButton 재사용 안 함). 사용처: `/my/referral`·
    `/my/rewards/*`·`/search/[vendorId]/fix-report` 등.
  - **`/search/[vendorId]/images`**(`images.tsx:77-86,354-366`) — 위 세 부품 어느 것도 안 쓰고
    아이콘 없이 "돌아가기" **텍스트만** 그린다. 좌측 패딩도 `Layout.gutter`(20)로 달라 다른
    화면(`Layout.navPaddingLeft`=12)보다 8px 오른쪽에서 시작한다. **22개 중 유일한 4번째 변형.**

③ 근거 — C조가 2Depth 48개 중 47개(`/search`만 자체 헤더라 버튼 자체 없음)를 전수 확인:
`BackBar`/`BackButton`(← , 20) 15곳 vs `NavBar`/`SubScreen`(‹, 24) 32곳. **같은 폴더 형제 화면끼리도
갈린다** — 예: `/wedding/[id]/candidates`는 ←, 바로 옆 `/wedding/[id]/changelog`는 ‹.
스크린샷: `/tmp/wp-audit-a/my-biz-benefit.png`(←) vs `/tmp/wp-audit-a/capture-payment-consent.png`
(‹) vs `/tmp/wp-audit-b/search-vendorId-images.png`("돌아가기" 텍스트).

④ 왜 — `back-button.tsx` 주석은 스스로 "2026-09-11 대표 지시로 통일했다. 자리는 NavBar·
SubScreen과 같다"고 적었지만, **실제로는 `NavBar`와 `SubScreen`이 `BackButton`을 재사용하지 않고
옛 `chevronLeft`를 여전히 인라인으로 그리고 있다** — 그 통일 지시가 컴포넌트 자신만 고쳤고, 그
컴포넌트를 안 쓰는 두 갈래(전체 화면의 다수)는 반영이 안 됐다(코드 확인, 추측 아님).
`/search/[vendorId]/images`는 셋 다 안 쓰고 처음부터 손으로 그렸다(4번째 변형, 별개 원인).

⑤ 어떻게 — `screen-kit.tsx`의 `NavBar`와 `my-kit.tsx`의 `SubScreen` 안 뒤로가기 `Pressable`을
걷어내고 둘 다 `components/back-button.tsx`의 `BackButton`을 재사용한다(토큰은 이미 있음, 코드
통합만 필요). `images.tsx`의 `header`/`backBtn`은 지우고 `BackBar`로 교체한다.

⑥ 급한가 — 불편하다. **같은 MY 탭 안에서조차** 화살표·꺾쇠가 뒤섞여 있어 사용자가 화면을 오가면
뒤로가기 버튼 모양이 바뀌는 걸 체감할 수 있다. `/search/[vendorId]/images`는 눈에 거슬리는 정도
(기능은 됨).

---

### CC2 — 하위 화면에 딥링크로 직접 진입하면 탭바가 안 숨는다 (`/my/*`·`/wedding/*`·`/pick/*`)

① 무엇이 — Root 탭바(홈·웨딩노트·Pick·라운지·MY)가 3Depth·2Depth 상세 화면 바닥에 그대로 남아
있다. `apps/mobile/src/app/(tabs)/_layout.tsx` 주석은 "상세 화면에서는 탭 바가 통째로 숨는다"고
명시하는데 실제로는 딥링크 진입 시 안 숨는다.

② 어디서 — 원인 파일 `apps/mobile/src/features/navigation/tab-bar.tsx:51-52`. 재현 범위(3Depth+
2Depth 합산, 전수 확인):
  - `/pick/*` **4/4**, `/wedding/*` **16/16**(오류 화면인 `/wedding/[id]` 포함) — **예외 없이 전부**.
  - `/my/*` **20개 중 13개**만 재현 — **7개(`/my/guide`·`/my/privacy`·`/my/profile`·
    `/my/rebuttals`·`/my/reports`·`/my/reviews`·`/my/vendor-claims`)는 정상적으로 숨는다.**
    C조가 헤더 컴포넌트 차이·MY홈 직접 링크 여부·비동기 로딩 유무·폴더 구조 4가지 가설을
    코드로 확인했으나 **전부 반례가 있어 기각됐다 — 정확한 코드상 원인은 확정하지 못했다**
    (추측 아님을 명시, §4 C조 원문 참고).
  - off-tab 화면(`/capture`·`/feed`·`/progress`·`/search`·`/search/compare`·`/top3`)은
    `OFF_TAB_ROUTES`라 이 판정 자체를 안 거쳐 항상 정상 — 버그 아님.

③ 근거 — 3Depth+2Depth 합쳐 30장 이상의 스크린샷 바닥에 탭바가 보인다(`/tmp/wp-audit-a/
my-referral.png` · `/tmp/wp-audit-b/pick-removed.png` 등). **대조 실험**(B조): `/wedding/[id]/events`
목록을 먼저 찍고 화면 안에서 항목을 눌러(client-side push) 들어가면 탭바가 **없다**
(`/tmp/wp-audit-b/wedding-id-events-eventId-REAL.png`) — 앱을 정상 사용하는 사람은 이 버그를
못 본다. **직접 링크(딥링크·새로고침·알림·공유링크)로 들어오는 경로에서만 재현된다.**

④ 왜 — `tab-bar.tsx:51-52`가 탭바 숨김을 **push 스택 깊이**(`nested.index > 0`)로 판정한다. 화면
안에서 눌러 들어가면 깊이가 쌓여 정상 숨지만, 주소를 직접 열면 그 경로가 스택 첫(0번째) 화면으로
마운트돼 깊이가 0으로 남아 조건을 못 만족하고 탭바가 그려진다. 캡처 도구는 매번 `page.goto`(직접
진입)라 이 경로를 정확히 재현한다 — **도구의 인위적 산물이 아니라 실제 웹 새로고침·딥링크에서도
나는 동작**(코드 경로로 확정, 추측 아님). `/my/*` 7개가 예외인 정확한 이유만 미확정.

⑤ 어떻게 — `tab-bar.tsx`의 판정을 push 스택 깊이가 아니라 **현재 경로가 그 탭의 루트 화면인지**로
바꾼다(`depth-back-rules.ts`의 `TAB_ROOTS`·`matchRoute`를 재사용할 수 있다). 고치는 사람은 `/my/*`
7/13 갈림의 원인(react-navigation의 딥링크 상태 생성 로직, `getStateFromPath`)을 먼저 한 번
확인해보길 권한다 — 원인을 모른 채 고치면 왜 됐는지 모르고 넘어가게 된다.

⑥ 급한가 — 불편하다. 앱 내 정상 탐색에서는 안 보이지만, 알림·공유 링크로 들어오는 모든 사용자가
겪는다. 화면 하단 CTA(Dock)와 탭바가 거의 붙어 두 겹으로 보인다.

---

### CC3 — 공용 `TextField` 대신 raw `TextInput`을 직접 그림 (포커스·오류 표시 없음, 테두리색 오류)

① 무엇이 — 공용 `packages/ui/src/text-field.tsx`(포커스 시 테두리색 전환·오류 시 빨간 테두리
내장)를 안 쓰고 화면마다 `TextInput`을 손으로 그린다. 그중 일부는 테두리 색까지 틀렸다.

② 어디서 — raw `TextInput` 확인된 화면(A·B·C조 합산):
  - `/my/biz/benefit`(5곳)·`/my/biz/claim`·`/my/biz/data`(3곳)·`/my/rebuttals/[reviewId]`(2곳)·
    `/my/vendor-claims/[vendorId]`(3곳) — 포커스·오류 로직 자체가 없음(테두리 없이 배경색만).
  - `/my/referral`·`/my/rewards/promotion` — 같은 SubScreen 계열인데 `npay.tsx`만 정본 사용.
  - **테두리색까지 잘못됨**: `/search/[vendorId]/consult`(=booking, 같은 파일)·`edit-review`·
    `write-review`(`theme.border` #eeeff1 — 구분선용 옅은 회색을 씀) · `/my/contact`(2곳, 동일 오류).
    정본은 `theme.fieldBorder`(#d1d3d8)다(`text-field.tsx:39,52`).
  - 대조(정상): `/my/rewards/npay.tsx:132,140`·`/my/profile`·`wedding/[id]/expenses`는 `TextField`
    또는 올바른 `theme.fieldBorder`를 씀. `/my/settings`·`wedding/[id]/tasks`는 테두리 없이
    배경색만 쓰는 제3의 스타일(바텀시트 안이라 기본 캡처로는 확인 못 함 — 버그 단정 안 함).

③ 근거 — 코드 자체가 증거(위 파일:줄). 화면 비교: `/tmp/wp-audit-a/my-rewards-npay.png`(1px
테두리 상자, 정상) vs `/tmp/wp-audit-a/my-biz-benefit.png`(테두리 없음) vs
`/tmp/wp-audit-b/search-vendorId-edit-review.png`(테두리가 거의 안 보임).

④ 왜 — 화면들이 `screen-kit.tsx`·`my-kit.tsx`를 안 쓰고 처음부터 손으로 폼을 짠다(import 목록으로
확인). 테두리색 오류는 `theme.border`(구분선용)와 `theme.fieldBorder`(입력칸용)를 혼동한 것.

⑤ 어떻게 — 위 화면들의 `TextInput`+수동 스타일을 `packages/ui/src/text-field.tsx`의 `<TextField>`
로 교체한다(새 토큰 불필요, 이미 있는 컴포넌트 재사용). 안내 박스도 `NoteCard`/`NoteBox`로 맞추면
좋다.

⑥ 급한가 — 불편하다(포커스 표시가 없어 스크린리더·웹 키보드 탐색 사용자가 위치를 알기 어려움) ~
눈에 거슬린다(테두리색만 다른 경우).

---

### CC4 — 날짜가 포맷 없이 원문 ISO 그대로 노출된다

① 무엇이 — 화면에 `2026-10-10T02:00:00.000Z` 같은 원문 타임스탬프가 그대로 찍힌다.

② 어디서 — `/search/expo`(목록, `expo/index.tsx:194`) · `/search/expo/[expoId]`(상세,
`[expoId]/index.tsx:158`) · `/search/wedding-info`(목록, `wedding-info/index.tsx:221`) ·
`/search/wedding-info/[infoId]`(상세, `[infoId]/index.tsx:128`) — 전부 `{expo.startsAt} ~
{expo.endsAt}` 또는 `{item.publishedAt}`을 포맷 없이 템플릿에 그대로 넣는다.
**변형**: `/wedding/[id]/quotes.tsx:52` — "계약일"만 원문(`2026-08-01`, 시각은 없는 날짜 문자열),
바로 아래 "등록일"(`:57`)은 `formatDateDot`으로 정상 포맷 — **같은 파일에 이미 import돼 있는데
이 한 줄만 빠뜨림.**

③ 근거 — `/tmp/wp-audit-b/search-expo.png`("2026-09-20T01:00:00.000Z ~ …") ·
`search-wedding-info.png` · `search-expo-expoId.png` · `search-wedding-info-infoId.png` ·
`/tmp/wp-audit-c/wedding-id-quotes.png`("계약일: 2026-08-01" / "등록일: 2026.09.01(화)" 나란히).

④ 왜 — fixture 문제가 아니다. 서버 계약(`expos.ts`·`wedding-info.ts`)이 `startsAt`·`endsAt`·
`publishedAt`을 전부 `z.string()`(ISO, 포맷 없음)으로 내려주므로 **운영에서도 동일하게 깨진다.**
`/search/expo/[expoId]/calendar.tsx`는 같은 값을 받아 정상 포맷하므로 바로 옆 화면은 고쳐져 있고
이 넷만 빠졌다.

⑤ 어떻게 — 네 파일 모두 다른 화면이 이미 쓰는 `formatDateDot`(`@/features/common/format-date`)으로
감싼다. `quotes.tsx:52`도 같은 함수를 한 번 더 부르면 된다. 유틸만 부르면 되고 토큰 문제 아님.

⑥ 급한가 — 불편하다. **박람회·웨딩정보는 사람이 거의 본 적 없는 3Depth 화면**이라는 MASTER의
우려를 정확히 뒷받침하는 사례다 — 깊이 때문에 아무도 못 보고 지나간 것으로 보인다(추측).

---

### CC5~CC8 — 컴포넌트 규격화 (코드 레벨 감사, §5 참고)
카드 안쪽 패딩 16/20 혼용(CC5) · `radius.picker` 미사용(CC6) · 관리자 radius/색 하드코딩(CC7) ·
`CategoryCycleLoader` 컴포넌트 레벨 잔존(CC8)은 스크린샷 없이 코드 레벨에서만 확인됐다 — 상세는
§5로 위임(중복 방지).

---

## 5. ③ 컴포넌트 규격화 (코드 레벨)

`packages/ui/src/*`를 정본으로 두고 `apps/mobile/src/app`·`features`를 grep/Read로 대조했다.

### CC5 — 카드 안쪽 패딩이 16px/20px로 갈린다
정본 `packages/ui/src/card.tsx:87` `padding: Layout.cardPadding`(=20). **16px(`Spacing.three`)로
잘못 재구현한 화면 7곳**: `login/index.tsx:413` · `search/[vendorId]/edit-review.tsx:181` ·
`search/wedding-info/[infoId]/index.tsx:198` · `search/expo/[expoId]/calendar.tsx:255` ·
`search/expo/[expoId]/index.tsx:287` · `wedding/[id]/candidates.tsx:145` ·
`features/auth/login-sheet.tsx:132`(+`top3.tsx:230`). radius(10)는 맞게 베꼈는데 패딩만 틀렸다.
대조군(올바름): `wedding/[id]/quotes.tsx:179` · `screen-kit.tsx:607,614`.
**어떻게**: `padding: Spacing.three` → `Layout.cardPadding`. 토큰 이미 있음.
**급한가**: 눈에 거슬린다.

### CC6 — 날짜 선택 두 곳이 `radius.picker`(8, "선택한 날짜도 원이 아니라 사각" — 2026-09-10
사용자 결정) 대신 다른 값을 쓴다
`packages/ui/src/wedding-calendar.tsx:187-190`은 `Radius.pill`(999, 완전한 원)로, 온보딩 휠
`date-picker-sheet.tsx:369`는 `Radius.medium`(10, 카드용)으로 그린다. `Radius.picker`를 실제로 쓰는
곳은 관리자 화면 하나뿐(`admin/_ui.tsx`, 날짜 선택과 무관). **어떻게**: 두 곳의 radius 값을
`Radius.picker`로 바꾼다(토큰 이미 있음). **급한가**: 눈에 거슬린다.

### CC7 — 관리자 화면은 색만 토큰화되고 모서리·간격은 화면마다 숫자로 직접 적혀 있다
`apps/mobile/src/app/admin/*.tsx` 21개 파일에서 `borderRadius: 숫자`(Radius 미사용) **132곳**
(6이 72회·10이 15회·14가 4회·4가 12회 등으로 흩어짐, `grep -c "Radius\." admin/*.tsx` = 0). 같은
파일 안에서도 버튼끼리 6/8이 섞인다(`users.tsx:372,394,427,441`=6 vs `450`=8). 관리자 전용 radius
토큰이 `spec/tokens.json`에 없다.
**추가로 `admin/og-card.tsx`는 색까지 33곳 hex 직접 기재**(다른 admin 파일은 전부 `Colors.light.*`
쓰는데 이 파일만 `Colors` import 자체가 없음). 본문 글자 `#212124`는 실제 정본 `color.text.ink`
(`#1A1C20`)와 다른 값이라 엉뚱한 토큰을 옮겨 적은 것으로 보임. `#e5e7eb`·`#0f8a4f`·`#b45309`는
`spec/tokens.json`에 아예 없어 추가 필요.
관리자 표 "선택 행" 배경 `rgba(255,111,97,0.08)`(#FF6F61 8%)도 토큰 밖에서 **9번(8개 파일) 중복**
— 값은 일치하나 다음 브랜드색 변경 때 9곳을 손으로 찾아야 한다(2026-09-14~15에 실제로 2번 바뀜).
**어떻게**: 관리자 radius 토큰(예 `radius.adminButton: 6`)과 색 파생값(`primarySoft8` 등)을
`spec/tokens.json`에 먼저 더한다 — **토큰에 값이 없다.** `og-card.tsx`는 `Colors` import 추가 후
33곳 교체. **급한가**: 눈에 거슬린다(관리자 전용이라 기능은 안 막힘).

### CC8 — `CategoryCycleLoader`(폐기 대상)가 컴포넌트 레벨에서 강제된다
`packages/ui/src/status-view.tsx`의 `LoadingView`만 `loader?: 'circle'|'cycle'` prop을 받고 기본값이
`circle`(2026-09-11 반영)인데, 같은 파일의 `ProcessingView`(:349-370)·`RecommendingBody`(:170-191)·
`RecommendingView`(:196-202)는 그때 같이 안 고쳐져 `CategoryCycleLoader`를 prop 없이 고정 렌더한다.
호출부: `setup.tsx` · `top3.tsx` · `capture/analysis/[id].tsx` · `(tabs)/index.tsx` ·
`delayed-loader.tsx` — 화면 코드를 아무리 고쳐도 이 두 함수 자체를 안 고치면 폐기된 로더가 계속
돈다. **어떻게**: `ProcessingView`·`RecommendingBody`의 `CategoryCycleLoader` 호출을
`CircleLoader size={40}`으로 바꾼다(정책상 `cycle` 선택지가 이제 없으므로 prop 없이 바로 교체 가능).
**급한가**: 눈에 거슬린다 — "폐기"한 로더가 최소 5개 화면에서 여전히 돈다.

### (경미) 주석이 낡은 값을 적고 있음
`action-button.tsx:58`·`text-field.tsx:25` JSDoc이 `radius.control`의 옛 값(6)을 그대로 적고 있다
— 실제 값은 2026-09-15에 6→16으로 바뀌었고 코드는 정상 동작(화면 문제 없음, 주석만 최신화 필요).

---

## 6. ⑤ 영문 표기 전수 검수

**규칙(2026-09-15 최신, main 반영됨)**: 사용자 화면 영문 금지, 예외는 **`Pick`·`Npay` 둘뿐**.
`D-127`류 날짜 세는 꼴은 대상 아님. 피그마가 그린 영문 eyebrow는 번역이 아니라 **삭제** 대상.

어떻게 grep했는지, 왜 이렇게 판정했는지는 세션 스크래치패드 원문(§10 참고 경로)에 전체 grep
명령·근거가 있다 — 여기서는 결론만 정리한다. **13건 신규 위반 후보**(이미 배정된 `question-head.tsx
:25` "JUST FOR YOU"는 제외), **2건 렌더링 안 됨(위반 아님)**, **2건 판단 보류**.

| # | 원문 | 어디서 | 성격 | 대체 후보(복수, 택1 금지) | 급한가 |
|---|---|---|---|---|---|
| ① | WEDDING, LESS OVERWHELMING | `login/index.tsx:60,106,122` | **eyebrow 삭제 대상**(13개 목록 1번과 일치) | 삭제만 | 못 쓴다 |
| ② | 탭바 "MY" | `root-tabs.ts:38`·`tab-bar.tsx:93` | 일반 번역 | 마이 / 내 정보 / 마이페이지 | 못 쓴다 |
| ③ | MY 탭 제목 "MY"(26px) | `app/(tabs)/my/index.tsx:63,235` | 일반 번역 | ②와 통일 | 못 쓴다 |
| ④ | "MY에서 언제든 바꿀 수 있어요" | `app/setup.tsx:433` | 일반 번역(②에 종속) | 마이에서… / 내 정보에서… | 눈에 거슬림 |
| ⑤ | `spec/strings.ko.json` `"nav.my"`·`"my.title"` = "MY" | `spec/strings.ko.json:244,730` | 정본 파일 자체가 영문(직접 참조는 안 됨) | ②와 통일 | 눈에 거슬림 |
| ⑥ | "TOP 3" | `(home)/top3.tsx:68` | 일반 번역. glossary.json(구판)은 "웨딩픽 TOP3"·"상위 3곳" 둘 다 적어둠 | 웨딩픽 TOP3(영문 잔존 재충돌) / 상위 3곳 / 웨딩픽 추천 | 눈에 거슬림 |
| ⑦ | "FAQ 관리"·"+ 새 FAQ"(관리자) | `admin/_layout.tsx:94`·`admin/faq.tsx:136,138` | 일반 번역, 관리자도 대상(CLAUDE.md 284행) | 자주 묻는 질문 관리 / 문답 관리, 버튼 "+ 새 질문" | 눈에 거슬림 |
| ⑧ | 표 헤더 event_id·source·confidence·decision·reason_code·evidence·rollback_target(관리자) | `admin/audit-log.tsx:66-73,172-173,179` | 일반 번역, DB 컬럼명 그대로 노출 | 이벤트 ID·출처·신뢰도·판정·사유 코드·근거·되돌릴 대상 | 눈에 거슬림 |
| ⑨ | "ID" 표 헤더·검색창(관리자 7개 화면) | `data-pipeline.tsx:177` 등 | 일반 번역 | 번호 / 아이디(음역) / 고유번호 | 불편하다 |
| ⑩ | "CTR"(관리자 광고 표) | `admin/ads.tsx:126` | 일반 번역, 같은 표 나머지는 전부 한글 | 클릭률 / 노출 대비 클릭 | 눈에 거슬림 |
| ⑪ | "(Enter)"(관리자 검색창) | `admin/users.tsx:209` | 일반 번역 | (엔터) / 문장화("검색 후 엔터를 눌러주세요") | 불편하다 |
| ⑬ | "All rights reserved."(웹 푸터) | `spec/strings.ko.json:192`·`apps/web/src/landing.ts:30`·`subpages.ts:97` | 일반 번역, apps/web 전 페이지 공통 | 모든 권리 보유 / 저작권 보유 / 괄호 문구 삭제 | 눈에 거슬림 |

**판단 보류(대표님 확인)**:
- ⑫ `admin/og-card.tsx:288` 미리보기 도메인 `weddingpick-web.onrender.com` — 카카오톡 등에 실제로
  뜨는 호스트 이름을 미리 보여주는 자리라 도메인은 "단어" 번역 대상이 아닐 수 있음. 하드코딩이라
  실제 운영 도메인이 바뀌면 안 따라간다는 별개 문제는 있음.
- ⑭ `calendar.tsx:20-26,223` `CALENDAR_LABEL.outlook = 'Outlook'`(Google·Apple도 동일하게 영문) —
  **실제 렌더링됨.** 제3자 서비스 고유명사라 번역어 자체가 없다. "Pick·Npay 둘뿐" 규칙 문면과
  실제 코드 사이 간극을 보여주는 사례 — 예외 인정 여부 판단 필요.

**렌더링 안 됨(위반 아님, 확인만)**:
- ⑮ `calendar.tsx:38` `action: 'TEMPLATE'` — 구글 캘린더 URL 프로토콜 상수, `<Text>`로 안 나감.
- ⑯ `consult.tsx:37,40` "BLOOMING STUDIO"·"YOUR CONSULTANT" — JSDoc 주석 안에만 있고 실제 JSX는
  이미 업체명·업종명으로 대체돼 있음(59-67행 주석: "담당자는 계약에 없다 — 없는 값을 지어내지
  않는다").

**전수 조사했지만 위반 없음**: `accessibilityLabel` 167건(전부 영문 변수명, 값은 한글) ·
`packages/ui/src/**`(하드코딩 영문 없음, `npay-logo.tsx`의 "pay"는 Npay 마크 자체) ·
`wedding/index.tsx`의 "OUR CALENDAR"·`search/[vendorId]/index.tsx`의 "VERIFIED PRICE RANGE"는
이미 걷어낸 상태(코드 주석 "C-9" 확인) · 나머지 eyebrow(`MY NOTES`·`TODAY'S PICK`·`UPCOMING FAIR`·
`CONSULTATION` 등)는 코드에 아예 없음(미구현 화면이거나 이미 대체됨).

---

## 7. ⑥ 토스식 UX라이팅 · 그 밖의 발견

### `npm run copy-lint`(정확히는 `node lint-copy.js apps/mobile/src apps/web/src packages`) → **통과
(금지어 0건)**. 아래는 그 도구가 못 잡는 것만 정리했다.

### §5-0. (확인 필요) "서브카피 없음·Primary CTA 1개" 규칙과 실제 `Hero` 컴포넌트가 충돌
CLAUDE.md "섹션 제목 1줄, 서브카피 사용하지 않음"과 달리, 공용 `Hero`(`my-kit.tsx:162-187`·
`screen-kit.tsx:115`, 사용처 40곳 이상 — `wedding/join`·`wedding/partner`·`my/display`·`my/taste`·
`capture/index` 등)는 **주석 자체가 "서브 16/24 gray700(1줄)"을 피그마 규격(`padHero`)으로
문서화**하고 있다. 2026-09-15 최상위 정책("피그마가 픽셀 단위 정본")과 이 문장 중 어느 쪽이
낡았는지 **이 세션은 피그마 원본에 접근하지 못해 확정할 수 없다 — 대표님 확인 필요.** 이 메타
질문이 풀리기 전까지, 이 규칙에 근거한 개별 "위반" 판정(아래 §5-1 포함)은 참고용이다.

### §5-1. (확인 필요) Pick 카테고리 후보 목록 — Primary 버튼이 후보 수만큼 동시에 강조됨
`pick/category.tsx:120,157` — `candidates.map()` 루프 안에서 미결정 후보마다 `variant="primary"`
버튼("결정할게요")이 반복돼, 후보 3곳이 미결정이면 코랄 버튼이 동시에 3개 뜬다. 같은 방식으로
다른 화면(`my/contact`·`wedding/partner`·`wedding/join`·`capture/verify/[quoteId]`·`capture/review`)
도 확인했으나 전부 조건부 분기로 동시에 하나만 뜬다(오탐 아님 확인). 피그마 대조 필요.
**어떻게(안, 확정 아님)**: 목록 반복 버튼을 보조 스타일로 낮추거나, "다음 결정할 곳"처럼 한 곳만
강조. **급한가**: 불편하다.

### 부정형/문체 불일치
- **(확정, 실제 노출) 사진 접근 권한 거부 메시지가 합쇼체로 튐**: `features/capture/pickers.ts:46`
  "사진 접근이 허용되지 않았습니다. 설정에서 권한을 켜주세요."(나머지 문구는 전부 해요체).
  `capture/payment/register.tsx:142-144`에서 `caught.message`를 그대로 화면에 뿌려 실제로 노출됨.
  **어떻게**: "사진 접근 권한이 꺼져 있어요. 설정에서 켜주세요." **급한가**: 불편하다.
- **(확정) 상담 예약 카드 안에서 해요체/합쇼체 혼용**: `search/[vendorId]/consult.tsx:292`("공유
  돼요")·`:297`("공유됩니다"). **어떻게**: 297행을 "…공유돼요."로 통일. **급한가**: 눈에 거슬린다.
- (참고, 혜택 화면 밖 부정형 종결 2건 — CLAUDE.md 문면상 혜택 화면 한정 규칙이라 "스타일 개선
  여지"로 분류) `features/common/info-sheet.tsx:26` "판정하지 않아요" ·
  `wedding/[id]/expenses/[expenseId].tsx:154` "공개하지 않아요" — 대체 후보는 복수 제시, 결정 안 함.

### 같은 것을 두 이름으로 부르는 곳
**(확정) 「본식스냅」 vs 「스냅」**: `features/quotes/quote-result-view.tsx:43-48,194`
`ROLE_LABEL.snap = '스냅'`(견적 비교 "패키지 구성" 목록, 칩이 아니라 세로 나열 — CLAUDE.md 327행의
칩 폭 예외에 해당 안 됨). 나머지 파일(`default-image.tsx`·`category-icon.tsx`·
`consultation-category.ts`·`vendor.ts`·`wedding-feed.ts`)은 전부 "본식스냅"으로 통일돼 있다.
**어떻게**: `ROLE_LABEL.snap`을 "본식스냅"으로(렌더 폭 재확인 후). **급한가**: 눈에 거슬린다.
지역 짧은꼴 아홉은 전수 대조 결과 추가 위반 없음(완료).

### 애매모호 표현 — 완료(추가 발견 없음)
`apps/mobile/src`·`apps/web/src` 전체 grep, 사용자 노출 문자열에서는 추가 위반 없음(glossary.json이
이미 대부분 포괄, `apps/web`은 `copy-rules.test.ts`가 별도로 커버해 실제로는 빈틈 아님을 확인).

### ⑤ `/wedding/[id]/expenses/[expenseId]` — "업체" 라벨에 업체명 아닌 지출명 표시
`wedding/[id]/expenses/[expenseId].tsx:106` `<KeyValueRow label="업체" value={current.label} />` —
`ExpenseDetail` 계약(`wedding-plan.ts:63-104`)에 업체명 필드 자체가 없어, 자유 텍스트 지출명("웨딩홀
계약금" 등)이 "업체" 칸에 그대로 뜬다. fixture 우연이 아니라 코드 구조 문제. **어떻게**: 라벨을
"내역"/"항목"으로 바꾸거나, 서버 계약에 업체명 필드(nullable)를 추가한다. **급한가**: 불편하다.

### ⑥ `/my/rewards/missions` — 같은 배열 안에서 「Pick」 띄어쓰기가 갈림
`packages/domain/src/membership.ts:80` "마음에 드는 곳 **Pick하기**"(붙임) vs `:90` "**Pick 인증**
1건"(띄움). `/my/referral`의 "Pick 인증을 마친 친구"도 띄어쓰기 쪽이라 "Pick하기"가 소수 예외.
(참고: "Pick확인"·"자료확인" 인증등급 배지는 `verification.ts:29`의 의도된 규칙이라 버그 아님—
제외함.) **급한가**: 눈에 거슬린다.

### `/pick/category` — 카테고리 없이 열리면 "undefined 검색" 노출
`pick/category.tsx:39,96-97` — `useLocalSearchParams`의 `category`가 없으면 `VENDOR_CATEGORY_LABEL
[undefined] ?? undefined`가 그대로 버튼 라벨에 박힌다. 저장소 전체에서 이 경로에 파라미터를 실어
`router.push`하는 코드를 찾지 못함(앱 내부에서는 도달 불가로 보이나, 라우트 자체는 살아 있어
딥링크·북마크로 도달 가능). **어떻게**: `cat`이 유효하지 않으면 즉시 `/pick`으로 리다이렉트하는
가드를 추가하거나, 안 쓰는 사구코드라면 삭제 검토(코드 소유자 판단 필요). **급한가**: 눈에 거슬림.

---

## 8. 확인했지만 이상 없음(양호) — 참고용 요약

- `/capture/analysis/[id]`·`/capture/payment/register`·`/capture/result·verify·verify-status` ·
  `/my/rewards/npay`(가장 정본에 가까움) — 공용 부품·토큰 사용 정상.
- `/search/[vendorId]`·`/autocomplete`·`/review/[reviewId]`·`/reviews`·`/search/expo/[expoId]/
  calendar` — 정상.
- 로더 종류: 91개 화면 어디에도 `CategoryCycleLoader`가 화면 레벨에서 남아 있지 않았다(다만 §5
  CC8이 지적한 대로 **컴포넌트 정의 자체**에는 남아 있어 화면에서 안 보여도 잠재적으로 돈다).
- 숫자 천단위 쉼표: 확인한 화면 전부 정상.
- `/wedding/[id]/map`의 "지도는 앱에서만" 안내, `/pick/[category]`의 리터럴 `[category]` 노출(캡처
  기법 한계, 화면 결함 아님), `/search/[vendorId]/price-report`(v3.24 폐기, `<Redirect>`뿐) —
  전부 의도된 것이거나 검수 대상 화면 자체가 없음.
- `/top3` 배치 캡처 중 1회 일시 오류 — 단독 재실행 시 100% 정상 재현, 원인 미상이나 재현 불가라
  제외.

---

## 9. 이미 배정된 항목 (중복 아님을 확인만, 재기술 안 함)

로그인·온보딩 좌우 여백 20(24여야 함) · 취향 3/3 글자 줄·CTA「0장 선택」· 온보딩「바꾸기」요약
줄·지역이 줄 목록 · 온보딩 인트로「홈 편집」장 삭제 배정 · 홈 웨딩피드·홈편집 · 업체 사진 403
(핫링크) · 검색 지역 겹침(강남구/강남) · 웨딩노트·라운지·Pick 빈 화면 · 숫자 천단위 쉼표·「공공기관
확인」→「인증」· 로더 두 종류(화면 호출부 레벨. §5 CC8은 **컴포넌트 정의 레벨**의 같은 문제라 다른
층위로 별도 기재함) · 온보딩 eyebrow "JUST FOR YOU"(삭제 배정됨).

---

## 10. 검수 도구 변경 내역 (제품 코드 아님)

3Depth+2Depth 91개 화면을 실제 콘텐츠 상태로 캡처하기 위해 `scripts/fixtures/api.cjs`·
`packages/api-contract/src/capture-fixtures.test.ts`에 **총 34개 GET 엔드포인트**를 실제 zod 계약
기준으로 추가했다(제보·리워드·박람회·웨딩정보·웨딩노트 결정/메모/견적/할일/방문노트/초대·추천
TOP3 등). `npx jest --config packages/api-contract/jest.config.js --rootDir packages/api-contract
capture-fixtures` **46/46 통과** 확인. 커밋 내역: `b2050163`·`28f0ce18`·`ec7997b5`·`19e51928`
(브랜치 `chore/design-copy-audit-2026-09-15`). 제품 코드(화면·컴포넌트·서버)는 이 세션에서 손대지
않았다.

## 11. 못 찍은 화면

`/wedding/[id]`(문서 상세) 1개 — 서버가 아니라 기기 로컬 `document-store`만 읽는 화면이라 서버
fixture로는 못 채움(실제 촬영→분석 플로우로 기기에 문서를 만들어야 진짜 내용을 볼 수 있음, 이번
범위 밖). 나머지 105개(3Depth 43·2Depth 48·양호 확인된 것 포함)는 전부 실제 렌더로 확인했다.

## 12. 스크린샷 원본 위치 (세션 임시, 재현 가능)

`/tmp/wp-audit-a/*.png`(A조 20장) · `/tmp/wp-audit-b/*.png`(B조 23장+재촬영 2장) ·
`/tmp/wp-audit-c/*.png`·`/tmp/wp-audit-c-single/*.png`(C조 48장) — 저장소에는 없다(용량 규칙).
재현: `node scripts/screenshot-screens.mjs --build --route "<경로>" --edges`(§0 방법 참고).
PR 본문에 핵심 그림만 선별해 붙였다.

# 관리자 콘솔 출처 분리

2026-09-10 사용자 결정. 관리자 콘솔을 사용자 앱과 **다른 출처**로 옮긴다.

```
weddingpick-app-web.onrender.com          사용자 앱
weddingpick-admin.onrender.com/admin/*    관리자 콘솔 (화면 31장)
```

2026-09-09에 「관리자를 `/admin` 하나로 통일한다」고 정했던 것을 되돌린 것이다.
그때 `admin.html`을 없앤 커밋(`8b64be5`)이 `weddingpick-admin` 사이트를 만들던
코드를 함께 지웠고, 그 뒤로 저장소에 그 사이트를 만드는 코드가 없었다.

## 이 분리로 얻는 것 — 하나다

**출처 분리.** 관리자 토큰이 사용자 앱과 다른 `localStorage`에 들어간다. 사용자
화면 쪽 XSS가 관리자 토큰에 닿지 못한다. 쿠키·저장소의 폭발 반경이 갈라진다.

## 얻지 못하는 것 — 여기를 잘못 읽으면 다른 방어를 안 하게 된다

- **앞단 인증·IP 제한을 걸 수 없다.** 관리자 서비스도 Render **정적 사이트**이고,
  Render 정적 사이트에는 그런 기능이 없다. 그러려면 앞에 다른 것을 세우거나 API
  서버가 직접 서빙해야 하는데 이번 작업 범위가 아니다. **분리했다고 아무나 못
  들어오는 것이 아니다** — 주소를 아는 사람은 관리자 화면을 연다.
- **화면 코드는 공개다.** 정적 호스팅이라 HTML·JS를 누구나 받는다. 정상이다 —
  지켜야 할 것은 화면이 아니라 정보이고, 정보는 API가 토큰으로 막는다
  (`requireOperatorUser`, 권한은 `structured.users.is_operator`).
- **번들은 갈라지지 않는다.** 두 출처가 같은 JS 번들 하나(`_expo/static/js/web/entry-*.js`)를
  쓴다. 사용자가 받는 번들에 관리자 라우트 코드가 남아 있다. 위와 같은 이유로
  이건 보안 문제가 아니라 내려받는 양의 문제다. 갈라야 할 만큼 커지면 그때
  `apps/admin`을 따로 세운다(아래 「왜 따로 빌드하지 않았나」).

## 어떻게 갈랐나

두 서비스가 **같은 소스에서 같은 export를 돌리고, 산출물만 다르게 깎는다.**

```
npm run export:web --workspace @weddingpick/mobile
  && node scripts/split-admin-dist.mjs <app|admin>
```

| 역할 | 하는 일 | 성격 |
|---|---|---|
| `app` | `dist/admin/**.html`을 관리자 출처로 넘기는 쪽지로 교체 | **필요한 조치.** 관리자가 두 곳에 살아 한쪽이 낡는 것을 막는다 |
| `admin` | `admin` · `_expo` · `assets` · favicon · `+not-found` 만 남기고 사용자 화면 제거, `index.html`은 `/admin/home`으로 | **정리이지 경계가 아니다.** 번들에 사용자 라우트가 남아 클라이언트 라우팅으로는 그려질 수 있다 |

### 왜 `render.yaml`의 `routes`를 쓰지 않았나

1. **Blueprint sync가 깨져 있다**(`render.yaml` 머리말, 2026-09-07). `render.yaml`에
   적은 `routes`가 Render에 반영된다는 보장이 없다 — 지금 그 파일은 사실상 문서다.
2. Render 정적 사이트에서 **route 규칙과 실재하는 파일 중 무엇이 이기는지 확인하지
   못했다.** 추측 위에 경계를 세우지 않는다.

파일이 없으면 규칙 해석과 무관하게 없다. 그래서 산출물을 직접 깎는다.

### 왜 `/admin` 접두어를 관리자 출처에서도 유지하나

주소가 `weddingpick-admin.onrender.com/admin/home`으로 조금 길어지지만,

- expo-router의 static 출력은 **URL 경로로 라우트를 찾는다.** `/admin/home`을
  `/home`으로 바꿔 내보내면 서버가 보낸 HTML과 클라이언트 라우터가 어긋난다.
- `_api.ts`가 401·403에서 보내는 `/admin/login`(PR #167)이 **고칠 것 없이 맞는다.**

### 왜 따로 빌드하지 않았나 (갈래 B)

화면 31장이 expo-router 트리 하나에 묶여 있고 `react-native`의 `View`·`Text`·
`Pressable`·`ScrollView`·`StyleSheet`를 그대로 쓴다. `apps/admin`을 따로 세우려면
react-native-web 빌드 파이프라인을 새로 세워야 한다. 그런데 **출처 분리라는 목적은
그것 없이 달성되고**, 따로 빌드해서 얻는 것은 사용자에게 안 보내도 될 바이트를 안
보내는 것뿐이다 — 정적 사이트라 관리자 코드는 관리자 출처에서 어차피 공개로 받을
수 있으므로 보안 이득이 아니다. 성능 항목으로 미뤄 둔다.

## 분리 뒤 사용자가 겪는 변화

1. 관리자 주소가 바뀐다. 옛 주소(`weddingpick-app-web.onrender.com/admin/*`)는 같은
   화면의 새 주소로 넘어간다 — 북마크는 그대로 써도 된다.
2. **한 번은 다시 로그인해야 한다.** 관리자 토큰은 `weddingpick.adminToken.v1`에
   들어가는데 **출처가 바뀌면 그 저장소가 비어 있다.** 브라우저가 출처마다 다른
   `localStorage`를 주기 때문이고, 고장이 아니다.
3. 사용자 앱 쪽은 아무 변화가 없다.

## ⚠️ 전환 순서 — PR #167보다 먼저 하면 안 된다

**지금 main에는 관리자 로그인이 없다.** PR #167(머지 대기)에 들어 있다. 현재 상태는

- `_layout.tsx`에 인증 게이트가 없다 — `Platform.OS !== 'web'` 검사뿐이다
- `_api.ts`가 **사용자 토큰**(`weddingpick.sessionToken.v1`)을 쓴다. 관리자 전용
  토큰도, 401 리다이렉트도 없다

이 상태로 출처를 가르면 새 출처의 `localStorage`가 비어 토큰이 없고, **그 출처에는
토큰을 받을 로그인 화면이 없다.** 관리자 콘솔에 들어갈 방법이 사라진다.

### 절차

1. **PR #167을 머지한다.** 관리자 로그인·`_session.ts`·인증 게이트가 들어온다.
2. Render 대시보드에서 `weddingpick-admin` 서비스를 확인하거나 새로 만든다
   (Static Site). 저장소 문서가 엇갈린다 — `docs/AI_HANDOFF.md`는 2026-09-09에
   「지웠다」고 적혀 있다. **실제 존재 여부를 눈으로 확인한다.**
3. 그 서비스에 손으로 넣는다 — Blueprint sync가 깨져 있어 `render.yaml`만으로는
   아무것도 반영되지 않는다.

   | 항목 | 값 |
   |---|---|
   | Branch | `main` |
   | Build Command | `npm run export:web --workspace @weddingpick/mobile && node scripts/split-admin-dist.mjs admin` |
   | Publish Directory | `apps/mobile/dist` |
   | Auto-Deploy | 켠다 |
   | 환경변수 | `render.yaml`의 `weddingpick-admin` 블록에 적힌 `EXPO_PUBLIC_*` 일습 |

4. 배포된 `weddingpick-admin.onrender.com/admin/login`에서 **실제로 로그인해 본다.**
   여기까지 되고 나서 다음으로 간다.
5. `weddingpick-app-web`의 Build Command 끝에 `&& node scripts/split-admin-dist.mjs app`을
   붙이고 재배포한다. 이때부터 옛 주소가 새 주소로 넘어간다.
6. `infra/render-env.yml`의 `weddingpick-admin` 블록 주석을 풀어 환경변수 원본을
   저장소로 옮긴다. **대시보드의 실제 서비스 이름과 글자 하나까지 맞춘다** — 이름이
   어긋나면 sync 워크플로가 exit 1로 끝나 main 푸시마다 빨갛게 남는다.

`CORS_ORIGINS`에 `https://weddingpick-admin.onrender.com`을 넣는 것은 **먼저 해도
안전하다** — 아직 아무것도 서빙하지 않는 출처를 허용 목록에 넣는 것뿐이고 기존
출처에 영향이 없다. 이미 `infra/render-env.yml`에 들어가 있다.

## 되돌리려면

`weddingpick-app-web`의 Build Command에서 `&& node scripts/split-admin-dist.mjs app`을
빼고 재배포하면 옛 주소의 관리자 화면이 그대로 돌아온다. 화면 코드는 손대지 않았다.

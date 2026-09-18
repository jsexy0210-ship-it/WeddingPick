# 인증 인수인계

확인 기준: 2026-09-17, `main e0060059d67c938b300dcf44dc599fea2ba43ff5`에서 시작한
PR #274의 인증 수정본. 2차 변경은 `f9b4e4e46eaaa55886da17596a3c98cecd151c29` 위에 추가한다.
이 문서는 코드 구조와 변경 범위를 설명한다. 운영 설정이나 실기기 로그인, 배포 성공을 확인했다는 뜻은 아니다.

## 1. 현재 로그인 정책과 노출

2026-09-17 `CLAUDE.md`와 `docs/design/README.md`의 결정은 **카카오 + Apple 유지**다.
예전 「카카오만 / Apple 폐기」 설명은 현재 기준이 아니다.

| 플랫폼 | 사용자 화면 | 조건 |
| --- | --- | --- |
| Android | 카카오 | API 제공자 설정과 앱 REST API 키 필요 |
| 일반 웹 | 카카오 | 동일 origin의 `/setup`으로 복귀 |
| iOS | 카카오, Apple | 서버가 해당 제공자를 반환해야 표시 |
| 네이티브 웹뷰 | 네이티브 앱에서 인증 | 신뢰한 웹 페이지에 세션을 메모리로 전달 |
| 관리자 웹 | 별도 ID/비밀번호 | `/v1/admin/login` |

이메일/비밀번호 사용자 로그인과 비밀번호 재설정 경로는 제거된 상태다.
네이버·구글 검증 코드는 남아 있으나 앱 버튼은 노출하지 않는다. 환경변수로 켠 제공자는
`POST /v1/auth/sessions`에서 사용할 수 있고 `signIn()`은 새 identity도 만든다.
따라서 「기존 계정만 허용」이 서버에서 강제된다고 해석하면 안 된다.

주요 구현:

- `apps/mobile/src/features/auth/providers.ts`, `kakao-redirect-state.ts`: 소셜 인증과 callback 검증.
- `packages/api-contract/src/auth.ts`: 요청·응답 계약.
- `apps/api/src/routes/auth.ts`, `auth/identity-provider.ts`: 코드 교환과 신원 검증.
- `apps/api/src/auth/sessions.ts`, `auth/plugin.ts`: 자체 세션과 권한 관문.
- `apps/mobile/src/api/session.ts`, `api/client.ts`: 사용자 토큰·API 인증.
- `apps/mobile/src/features/webshell/session-protocol.ts`, `WebShellView.tsx`: 네이티브 측 전달·이동 제한.
- `apps/mobile/src/api/web-shell-session.ts`: 웹뷰의 일회성 수신·메모리 보관.
- `apps/mobile/src/app/_layout.tsx`: 세션 전달 완료 후 부팅·가입 복구.
- `apps/api/src/routes/admin-login.ts`, `auth/admin-password.ts`, `auth/admin-role.ts`: 관리자 인증·권한.
- `apps/mobile/src/app/admin/_session.ts`, `_api.ts`: 관리자 토큰·로그아웃·호출.

## 2. 카카오 요청 흐름

1. 앱이 `GET /v1/auth/providers`를 조회한다.
2. `ResponseType.Code`, PKCE, `state`, `openid profile_nickname age_range`로 인증을 시작한다.
3. 웹은 같은 창으로 이동하며 **`${origin}/setup`**으로 복귀한다. `/login`이 아니다.
   네이티브는 앱에 등록된 `kakao…://oauth` 스킴을 사용한다.
4. 앱이 code, state, redirectUri, codeVerifier, 사용자가 확인한 ageAcknowledged를
   `POST /v1/auth/sessions`에 보낸다.
5. 서버가 카카오 `/oauth/token`으로 교환하고 `jose`와 원격 JWKS로 id_token을 검증한다.
   issuer와 audience를 지정하고 `sub`가 있어야 한다.
6. 필요한 경우 access_token으로 연령대를 조회한 뒤 연령 판정, 사용자 조회/생성, 자체 세션 발급을 수행한다.

`EXPO_PUBLIC_KAKAO_CLIENT_ID`와 `KAKAO_APP_KEY`는 같은 **REST API 키**다.
Client Secret은 별도 비밀값이며 앱에 전달하지 않는다. 콘솔에서 사용을 켰다면 서버 설정이 필요하다.
코드가 `/setup`을 사용한다는 사실과 실제 콘솔에 그 주소가 등록되어 있다는 사실은 별개다.
도메인 변경 시 새 origin의 `/setup`, API CORS와 네이티브 앱 설정을 함께 검증한다.

### 웹의 임시 인증 요청

`weddingpick.kakaoAuthRequest.v1`은 탭별 `sessionStorage`에 저장한다.
state, PKCE verifier, redirectUri, startedAt, 선택적인 ageAcknowledged만 담는다.
callback은 URL 인증 파라미터와 임시 요청을 교환 전에 제거하고 JSON 구조, state,
PKCE 형식, 현재 origin의 `/setup`, 미래 시각 여부, **10분 만료**, code 존재를 검사한다.
이전 버전에서 이미 시작한 OAuth 요청은 AsyncStorage에서 한 번 읽되 같은 검증 후 삭제한다.
이는 아래에서 차단하는 구버전 **세션 토큰 URL 전달**과 다른 호환 경로다.

부팅은 같은 시도의 Promise를 재사용한다. React effect 재실행 때문에 일회용 카카오 code를
두 번 교환하거나 처리 중에 일반 세션 복구가 앞서 실행되지 않도록 한다.
저장소가 JavaScript에서 접근 가능하다는 점은 그대로이며 XSS 방어를 대체하지 않는다.

## 3. Apple과 연령 확인

iOS는 `expo-apple-authentication`의 identityToken을 API에 보낸다.
첫 인증 때 받을 수 있는 이름은 profileName으로 별도 전달한다. 서버는 Apple JWKS, issuer,
audience와 sub를 확인하고, 앱이 로그인 시도마다 생성한 단일사용 nonce가 id_token의 nonce와
정확히 같은지도 확인한다. nonce는 기기에 저장하지 않고 Apple 요청과 서버 검증 사이에서만 유지한다.
Apple이 연령을 제공했다고 가정하지 않는다. 실제 iOS 기기에서 nonce 포함 로그인 성공·취소·재시도는 별도 검증한다.

| 판정 | 결과 |
| --- | --- |
| 제공자 연령대가 기준 이상 | provider 경로로 통과 |
| 제공자 연령대가 기준 미달 | `403 under_age`, 계정/세션 생성 전 차단 |
| 연령대 없음 + 사용자의 확인 있음 | self_declared 경로로 통과 |
| 연령대 없음 + 확인 없음 | `403 age_unverified`, 계정/세션 생성 전 차단 |

self_declared는 제공자가 나이를 검증했다는 뜻이 아니다. 앱이 확인을 자동으로 true로 만들지 않는다.
사용자 확인으로 제공자의 미달 판정을 뒤집을 수 없다.

## 4. 자체 세션과 권한

외부 제공자 토큰과 웨딩픽 세션은 다르다. `(provider, subject)`로 사용자를 찾거나 만든 뒤
`randomBytes(32).toString('base64url')`로 자체 opaque 토큰을 발급한다.
DB에는 원문이 아닌 SHA-256 token_hash, user_id, expires_at, revoked_at을 보관한다.
제공자 access_token, id_token, refresh_token을 세션 DB에 저장하는 구현은 없다.

API는 `Authorization: Bearer <웨딩픽 토큰>`을 해시해 `identity.active_sessions`에서 조회한다.
기본 TTL은 30일이며 SESSION_TTL_DAYS로 설정한다. OPERATOR_SESSION_TTL_DAYS는
`structured.users.is_operator`가 켜진 계정에 적용되며 adminRole만으로 자동 적용되지는 않는다.
별도 refresh-token 흐름은 없다.

세션 응답은 token, userId, expiresAt, activated, setupComplete, ageVerified를 포함한다.
소셜 인증과 가입 동의/설정 완료는 다르다. requireUser는 유효 세션과 가입 완료를 요구하고,
requireSignup은 가입 미완료 세션도 허용한다. optionalUser는 토큰 없음은 허용하지만 잘못된 토큰은 401이다.
관리자 관문은 활성 계정과 서버 role을 확인하며 viewer는 GET/HEAD만 허용한다.

로그인 응답에는 `Cache-Control: no-store`를 보낸다. 발급 후 활성화/가입 상태 조회 실패 시
반환하지 못한 세션을 폐기하려고 시도한다. 폐기 DB 오류는 로그에 남는다. 완전한 원자성을 보장하지 않는다.

### 네이티브 웹뷰 전달: 2차 변경

**토큰을 `source.uri`, query 또는 fragment에 넣지 않는다.** 새 URL에는 비밀값이 아닌 `wp_shell=1`만 붙인다.

1. 네이티브가 설정된 HTTPS origin과 경로를 최초 로딩 전에 검사한다.
2. 웹 페이지가 Web Crypto의 무작위 32바이트로 일회성 channel을 만들고 `session:ready` 메시지를 보낸다.
3. 네이티브는 메시지 origin·형식·channel을 확인하고, 비동기 조회 중 계정/페이지가 바뀌지 않았는지 확인한다.
4. 정확한 origin의 메인 프레임에서 같은 channel의 수신 함수에만 세션을 전달한다.
5. 웹은 이전 localStorage 사용자 토큰을 제거하고 새 토큰을 **페이지 메모리에만** 둔다. 수신 함수와 요청 표식은 제거한다.
6. 수신이 10초 안에 끝나지 않거나 저장소 정리에 실패하면 보호 API를 시작하지 않는다. 오류 화면에서 재시도한다.

웹뷰 내부의 로그아웃/401은 원문 토큰 대신 `session:clear`와 channel을 보낸다.
네이티브는 자신이 전달한 세션과 현재 세션이 여전히 같을 때만 제거한다.
다른 계정으로 바뀌면 웹뷰를 새로 띄운다. 웹뷰 안에서 별도의 계정 로그인을 저장하지 않고 네이티브 재인증으로 보낸다.

외부 origin은 인증된 웹뷰에 로드하지 않는다. 허용되는 외부 HTTP(S) 링크는 시스템 브라우저로 넘기며
스크립트·파일·자격증명이 포함된 URL은 차단한다. HTTPS 외 첫 주소, 혼합 콘텐츠, 파일 접근도 차단한다.
`originWhitelist=['*']`는 이동을 검증 콜백에 보내기 위한 설정이며 실제 허용은 정확한 origin 비교로 결정한다.

**이 브리지는 동일 origin의 XSS를 막지 못한다.** 웹뷰 토큰은 JavaScript 메모리에 존재한다.
일반 웹 사용자·관리자 localStorage 및 네이티브 AsyncStorage는 이번에 보안 저장소로 전환하지 않았다.

### 구버전 앱 호환성

구버전 `wp_token` query는 URL에서 제거하지만 **인증에 사용하지 않는다**.
이전 앱이 query로 토큰을 보냈다면 최초 HTTP 요청에 이미 포함된 것이므로 웹 코드가 소급해서 노출을 없앨 수 없다.
신규 웹을 구버전 네이티브 셸과 무조건 조합해 배포하면 웹뷰 진입이 막힐 수 있다.
앱 JS/네이티브 셸과 웹 export의 버전을 맞추고, 구버전 앱 처리 및 복구 절차를 검증한 뒤 배포한다.

## 5. 관리자 자격증명과 로그아웃

DB `structured.admin_accounts`는 scrypt 해시와 무작위 소금만 저장한다.
부트스트랩 환경변수는 ADMIN_LOGIN_ID, ADMIN_PASSWORD_HASH, 선택적인 ADMIN_PASSWORD다.
원문 설정은 호환성 지원이며 배포 설정을 읽을 수 있는 사람에게 노출될 수 있다.

ADMIN_PASSWORD가 명시되어 있으면 그 비밀번호만 허용하고, 없으면 ADMIN_PASSWORD_HASH를 사용한다.
원문을 바꾼 뒤 옛 해시로도 통과하던 OR 판정은 제거했다. 해시 전용 전환은 올바른 해시를 설정한 뒤
ADMIN_PASSWORD를 제거하는 운영 작업이다. **이번 수정은 실제 환경변수나 이미 발급된 모든 세션을 바꾸지 않는다.**

부트스트랩은 활성 DB 슈퍼 관리자가 없을 때만 허용하며 원문만 설정한 환경도 그 조건 안에서 지원한다.
같은 ID의 비활성 DB 계정은 부트스트랩으로 우회하지 못한다. 인증과 권한은 다르며 resolveAdmin이 역할을 확인한다.
로그인 실패 지연은 프로세스 메모리 기반이다. 분산 속도 제한이나 MFA 구현을 뜻하지 않는다.

관리자 API는 401에만 로컬 세션을 제거하고, 403에는 세션을 유지하며 서버의 권한 부족 이유를 표시한다.
계정 전환 전의 늦은 응답을 새 계정에 적용하지 않도록 토큰을 재확인한다.

**2차 수정:** 관리자 로그아웃은 지우기 전 캡처한 토큰으로 `DELETE /v1/auth/sessions`를 호출한다.
화면 이동 전에 요청을 시작하고 keepalive, 5초 제한, redirect 금지를 적용한다.
서버가 실패해도 로컬 로그아웃을 되돌리지 않으며 자격증명을 로그에 출력하지 않는다.
서버 폐기는 best-effort다. 네트워크가 끊겼다면 성공을 보장하지 않으며 기존 만료 시각까지 유효할 수 있다.
사용자 세션과 관리자 세션 키는 분리되어 있다.

탈퇴의 기기 정리는 `weddingpick.*` 영속 키와 탭별 OAuth 임시 키를 함께 삭제한다.
다른 서비스의 저장소 키는 지우지 않는다. 서버 데이터 삭제는 기존 탈퇴 API의 별도 책임이다.

## 6. 개인정보 저장 범위

식별자와 제공되는 프로필은 `identity.identities`에 분리 보관한다.
identityValues()는 birthday, age_range, birth_year에 새 원문을 넣지 않는다.
연령 확인 여부·시점·경로는 structured.users에 기록한다.
기존 SQL은 해당 열에 COALESCE를 사용하므로 이전 버전의 연령/생일 값이 남아 있다면 자동 삭제되지 않는다.
과거 데이터 점검·정리는 별도 운영 DB 작업이다. 이번 변경에서 일괄 삭제하지 않았다.

## 7. 검증 범위와 CI

2차 격리 검사: `npm run test:web-shell-auth`.
실제 변경된 TS/TSX와 주입 스크립트를 실행하고, SDK·React·스토리지·네트워크 경계는 대역으로 검사한다.
Node Web Crypto와 URL 검증, 잘못된 메시지·origin·channel·만료·저장소 실패, 계정/페이지 변경,
관리자 서버 로그아웃, 부팅 effect 재실행 등의 **75건 통과**를 확인했다.
프로토콜과 브리지 2개 모듈은 strict + noUncheckedIndexedAccess 타입 검사를 통과했다.
변경 TS/TSX 7파일의 구문 검사도 통과했다. 이는 저장소 전체 타입 검사나 React/Expo 실기기 검증이 아니다.

기존 1차 검사는 `npm run test:auth-hardening`에 유지한다. 이번 환경에서는 그 전체를 다시 실행하지 않았다.
루트 `npm test`의 pretest에 두 명령을 연결했다. 기존 main 통합 CI의 Test 단계가 함께 실행한다.
**PR별 CI를 다시 켜거나 추가 배포 워크플로를 만들지 않는다.** CI가 없는 PR을 통과했다고 처리하지 않는다.
직접 clone·패키지 다운로드가 불가능한 실행 환경이므로 전체 의존성/Jest/DB 통합 검사는 미검증이다.

## 8. 병합·배포 전 남은 조건

| 항목 | 상태와 필요한 검증 |
| --- | --- |
| 새 웹뷰 전달 | 코드·격리 검사 완료. Android/iOS 실제 WebView 메시지·이동·재시작·로그아웃 검증 필요 |
| 구버전 네이티브 앱 | 새 웹과의 조합은 자동 호환하지 않음. 버전 일치·업데이트 유도·복구 계획 필요 |
| 네이티브 세션 저장 | AsyncStorage 유지. SecureStore 의존성·lockfile·기존 토큰 이전·탈퇴 삭제·실기기 검증 필요 |
| 일반 웹/관리자 세션 | HttpOnly/Secure 쿠키 미전환. 도메인·CORS·CSRF·SameSite·웹뷰 연동 검증 필요 |
| Apple 재생 방어 | 코드 적용. 실제 iOS Apple 로그인에서 nonce 포함 성공·취소·재시도 검증 필요 |
| 관리자 원문 설정 | 실제 운영 해시 전용 전환·기존 세션 폐기 정책 확인 필요 |
| 전체 제품 회귀 | 전체 타입·lint·Jest·분리된 DB·웹 빌드·실제 제공자 로그인 검증 필요 |

실제 신규/기존 가입, 미완료 동의 재진입, 만료/취소, viewer의 403, iOS Apple도 배포 전에 확인한다.
운영 main 병합·배포·비밀값·DB 변경은 수행하지 않았다. 이 기록을 전면 보안 전환 완료로 읽지 않는다.

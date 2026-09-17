# 인증 인수인계

확인 기준: 2026-09-17, `main e0060059d67c938b300dcf44dc599fea2ba43ff5`에서 시작한 인증 수정본.
이 문서는 코드 구조와 변경 범위를 설명한다. 운영 환경변수, 제공자 콘솔 설정, 배포 성공을 확인했다는 뜻은 아니다.

## 1. 현재 로그인 정책과 실제 노출

2026-09-17 `CLAUDE.md`와 `docs/design/README.md`의 결정은 **카카오 + Apple 유지**다.
이 문서의 예전 「카카오만 / Apple 폐기」 설명은 현재 기준이 아니다.

| 플랫폼 | 사용자 화면 | 조건 |
| --- | --- | --- |
| Android | 카카오 | API 제공자 설정과 앱 REST API 키 필요 |
| 웹 | 카카오 | 동일 origin의 `/setup`으로 복귀 |
| iOS | 카카오, Apple | 서버가 해당 제공자를 반환해야 표시 |
| 관리자 웹 | 별도 ID/비밀번호 | `/v1/admin/login` |

이메일/비밀번호 사용자 로그인과 비밀번호 재설정 경로는 제거된 상태다.
네이버·구글 검증 코드는 남아 있으나 앱 버튼은 노출하지 않는다. 서버 환경변수로 켠 제공자는
`POST /v1/auth/sessions`에서 사용할 수 있고, 현재 `signIn()`은 새 identity도 만든다.
따라서 「기존 계정만 허용」이 서버에서 강제된다고 해석하면 안 된다. 새로 켤 때는 별도 검토한다.

주요 파일:

- `apps/mobile/src/features/auth/providers.ts`: 제공자 목록, 카카오/Apple 시작, 웹 callback.
- `apps/mobile/src/features/auth/kakao-redirect-state.ts`: 웹 요청의 형식·state·PKCE·수명 검증.
- `packages/api-contract/src/auth.ts`: 요청과 응답 계약.
- `apps/api/src/routes/auth.ts`, `auth/identity-provider.ts`: 코드 교환과 신원 검증.
- `apps/api/src/auth/sessions.ts`, `auth/plugin.ts`: 자체 세션과 접근 권한.
- `apps/mobile/src/api/session.ts`, `api/client.ts`: 사용자 토큰 보관·API 인증.
- `apps/api/src/routes/admin-login.ts`, `auth/admin-password.ts`, `auth/admin-role.ts`: 관리자 인증/권한.
- `apps/mobile/src/app/admin/_session.ts`, `_api.ts`: 관리자 전용 토큰과 호출.

## 2. 카카오 요청 흐름

1. 앱이 `GET /v1/auth/providers`를 조회한다.
2. `ResponseType.Code`, PKCE, `state`, `openid profile_nickname age_range`로 카카오 인증을 시작한다.
3. 웹은 같은 창으로 이동하며 **`${origin}/setup`**으로 복귀한다. `/login`이 아니다.
   네이티브는 앱에 등록된 `kakao…://oauth` 스킴을 사용한다.
4. 앱이 인가 코드, state, redirectUri, codeVerifier, 사용자가 확인한 ageAcknowledged를
   `POST /v1/auth/sessions`에 전달한다.
5. 서버는 카카오 `/oauth/token`에 코드를 교환하고, 응답의 id_token을 `jose`와 원격 JWKS로 검증한다.
   issuer와 audience를 지정하고 `sub`가 있어야 한다.
6. 필요한 경우 카카오 access_token으로 연령대만 조회한다. 이후 연령 판정, 사용자 조회/생성,
   웨딩픽 자체 세션 발급을 수행한다.

`EXPO_PUBLIC_KAKAO_CLIENT_ID`와 `KAKAO_APP_KEY`는 같은 **REST API 키**다.
Client Secret은 별도 비밀값이며 앱에 전달하지 않는다. 콘솔에서 Secret 사용을 켰다면 서버 설정이 필요하다.
코드가 `/setup`을 사용한다는 사실과 실제 콘솔에 그 주소가 등록되어 있다는 사실은 별개다.
도메인 변경 시 새 origin의 `/setup`, API CORS, 네이티브 앱 설정을 함께 검증한다.

### 웹 인증 요청의 보관과 검증

수정본은 `weddingpick.kakaoAuthRequest.v1`을 탭별 `sessionStorage`에 저장한다.
state, PKCE verifier, redirectUri, startedAt, 선택적인 ageAcknowledged만 담는다.
다른 탭의 새 로그인 요청으로 값을 덮어쓰지 않도록 한다.

callback은 URL의 인증 파라미터와 저장된 요청을 교환 전에 제거한다.
JSON의 실제 구조, state 일치, PKCE verifier 형식, 현재 origin의 `/setup` 일치,
미래 시각 여부와 **10분 만료**를 검사한다. code 누락은 서버로 보내지 않는다.
이전 웹 버전으로 이미 시작한 요청은 AsyncStorage에서 한 번 읽을 수 있지만 같은 검증을 적용하고 삭제한다.
`sessionStorage`도 JavaScript로 접근할 수 있으므로 XSS 방어를 대신하지 않는다.

## 3. Apple과 연령 확인

iOS는 `expo-apple-authentication`에서 identityToken을 받아 API에 보낸다.
첫 인증 때만 받을 수 있는 이름은 profileName으로 별도 전달한다. 서버는 Apple JWKS, issuer,
audience와 sub를 확인한다. Apple 경로에서 연령을 제공받았다고 가정하지 않는다.

서버 연령 정책은 다음과 같다.

| 판정 | 결과 |
| --- | --- |
| 제공자 연령대가 기준 이상 | provider 경로로 통과 |
| 제공자 연령대가 기준 미달 | `403 under_age`, 계정/세션 생성 전 차단 |
| 연령대 없음 + 사용자의 확인 있음 | self_declared 경로로 통과 |
| 연령대 없음 + 확인 없음 | `403 age_unverified`, 계정/세션 생성 전 차단 |

self_declared는 제공자가 나이를 검증했다는 뜻이 아니다. 확인 값을 앱에서 자동으로 true로 만들지 않는다.
사용자 확인으로 제공자의 미달 판정을 뒤집을 수 없다.

## 4. 자체 세션과 접근 권한

외부 제공자 토큰과 웨딩픽 세션은 다르다. `(provider, subject)`로 사용자를 찾거나 만든 뒤,
`randomBytes(32).toString('base64url')`로 자체 opaque 세션 토큰을 발급한다.
DB `identity.sessions`에는 원문이 아닌 SHA-256 token_hash, user_id, expires_at, revoked_at을 보관한다.
제공자 access_token, id_token, refresh_token을 세션 DB에 저장하는 구현은 없다.

앱은 `Authorization: Bearer <웨딩픽 토큰>`으로 API를 호출한다. 서버는 해시를 계산해
`identity.active_sessions`에서 조회한다. 기본 TTL은 30일이며 SESSION_TTL_DAYS로 설정한다.
OPERATOR_SESSION_TTL_DAYS는 `structured.users.is_operator`가 켜진 계정에 적용된다.
adminRole이 있다는 이유만으로 자동 적용되는 것은 아니다. 별도 refresh-token 흐름은 없다.

세션 응답은 token, userId, expiresAt, activated, setupComplete, ageVerified를 포함한다.
소셜 인증 성공과 가입 동의/초기 설정 완료는 다른 상태다.

- requireUser: 유효한 세션과 가입 완료가 필요하다.
- requireSignup: 가입 미완료 세션도 허용한다. 가입 마무리용이다.
- optionalUser: 토큰이 없으면 통과하지만 잘못된 토큰은 401이다.
- 관리자 관문: 활성 계정과 서버의 role을 확인한다. viewer는 GET/HEAD만 허용한다.

로그아웃은 해당 세션을 폐기하고 기기의 토큰을 제거한다. 로그인 응답에는 `Cache-Control: no-store`를
보낸다. 세션 생성 뒤 활성화/가입 상태 조회에 실패하면 반환하지 못한 세션을 폐기한다.
폐기 자체가 DB 오류로 실패할 수 있으므로 로그 확인이 필요하다. 분산 트랜잭션 보장을 뜻하지 않는다.

## 5. 관리자 자격증명

DB `structured.admin_accounts`에는 scrypt 해시와 무작위 소금만 저장한다.
기존 부트스트랩을 위한 환경변수는 ADMIN_LOGIN_ID, ADMIN_PASSWORD_HASH, 선택적인 ADMIN_PASSWORD다.
원문 설정은 호환성 지원이며 배포 설정을 읽을 수 있는 사람에게 노출될 수 있다. 해시 전용 운영을 권장한다.

**수정본의 우선순위:** ADMIN_PASSWORD가 명시되어 있으면 그 비밀번호만 허용한다.
없으면 ADMIN_PASSWORD_HASH를 사용한다. 둘 중 하나만 맞아도 허용하던 OR 판정은 제거했다.
원문을 바꾼 뒤 옛 해시의 비밀번호로 계속 로그인할 수 없게 하기 위한 변경이다.
해시 전용으로 전환할 때는 올바른 해시를 설정한 뒤 ADMIN_PASSWORD를 제거한다.
이 수정은 이미 발급된 세션을 모두 취소하지 않으며 운영 비밀값도 변경하지 않는다.

부트스트랩은 활성 DB 슈퍼 관리자가 없을 때만 허용한다. 원문만 설정한 환경도 이 조건 안에서 지원한다.
같은 ID의 비활성 DB 계정이 있으면 부트스트랩으로 우회하지 못한다.
인증 성공이 권한 부여를 의미하지 않으며 resolveAdmin이 역할을 별도로 확인한다.
실패 지연은 프로세스 메모리 기반이다. 공유된 분산 속도 제한이나 MFA가 구현됐다는 뜻은 아니다.

관리자 API의 **401만** 로컬 관리자 세션을 제거하고 로그인으로 보낸다.
403은 유효한 세션의 권한 부족일 수 있으므로 세션을 유지하고 서버의 이유를 표시한다.
계정 전환 전에 보낸 늦은 응답을 새 계정에 적용하지 않도록 토큰을 다시 확인한다.

## 6. 개인정보 저장 범위

제공자로부터 받은 식별자와 제공되는 프로필은 `identity.identities`에 분리 보관한다.
현재 identityValues()는 birthday, age_range, birth_year에 새 원문을 넣지 않는다.
연령 확인 여부·시점·경로는 structured.users에 기록한다.

**기존 데이터 삭제와 혼동하지 않는다.** 기존 identity 갱신 SQL은 해당 열에 COALESCE를 사용하므로
이전 버전이 저장한 연령/생일 값이 남아 있다면 이 코드만으로 삭제되지 않는다.
과거 데이터 유무와 정리 작업은 별도 DB 점검 대상이며 이번 변경은 운영 데이터를 일괄 삭제하지 않는다.

## 7. 아직 완료되지 않은 보안 전환

아래 항목은 이 수정본에서 해결했다고 보고하지 않는다.

| 항목 | 현재 상태 | 후속 조건 |
| --- | --- | --- |
| 네이티브 세션 저장 | AsyncStorage 유지 | SecureStore 의존성·lockfile·네이티브 빌드·기존 토큰 이전/탈퇴 삭제 검증 |
| 웹 사용자/관리자 세션 | JavaScript가 접근 가능한 저장소 유지 | HttpOnly/Secure 쿠키 전환 시 도메인·CORS·CSRF·SameSite·웹뷰 호환 검증 |
| WebShellView의 wp_token | 최초 URL 쿼리 전달 유지 | URL에서 제거해도 최초 요청 로그 노출은 막지 못함. 신뢰 origin의 브리지 또는 일회용 교환으로 교체 필요 |
| 관리자 원문 설정 | 부트스트랩 호환용 지원 | 운영 해시 전용 설정 전환과 기존 세션 폐기 정책 확인 |
| Apple 재생 방어 | 기존 OIDC 검증 경로 유지 | nonce/재생 방어의 전체 경로 검토 필요 |

배포 전에는 신규/기존 가입, 동의 미완료 재진입, 만료 세션, 관리자 viewer의 403,
실제 카카오 callback, iOS Apple 로그인과 네이티브 웹뷰를 별도로 검증해야 한다.
로컬 격리 테스트는 실제 제공자·운영 DB·실기기·배포 검증의 대체가 아니다.

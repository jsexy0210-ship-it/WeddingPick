# 인프라 접근·연결 점검 — 2026-09-10 KST

## 결과

GitHub·Render·Neon·네이버 클라우드·Expo/EAS·카카오·App Store Connect·Google Play의 실제 계정/프로젝트 접근을 확인했다. 브라우저 로그인과 서비스 리소스 조회까지 확보한 상태이며, 모든 외부 서비스의 무인 API 인증을 새로 설치한 상태는 아니다.

**이 문단은 2026-09-11 대표 지시로 뒤집혔다 — `weddingpick.kr`은 폐기했다. 아래는 2026-09-10 시점의 기록이다.** 당시 확정: `weddingpick.kr`은 보유한 커스텀 도메인이지만 현재 사용하지 않는다. DNS 미응답을 장애·연결 차단으로 분류하지 않는다. 도메인 구매·복구·Cloudflare 등록은 진행하지 않았다. 현재 검수 대상은 onrender.com 주소다.

기준 소스: `jsexy0210-ship-it/WeddingPick`, main `e34193ee1644c664f107d529002ae53ef775389a`. 이번에도 GitHub main을 조회해 같은 SHA임을 확인했다.

## 확인된 접근 범위

| 환경 | 실제 확인 | 확보한 경로·한계 |
|---|---|---|
| GitHub | 저장소 main·Actions 실행·작업 로그 조회 | 연결된 GitHub 도구. secret 값을 가져오지 않음. 이번에 workflow를 새로 실행하지 않음 |
| Render | 웨딩픽 프로젝트, Production 리소스 5개, API·앱 웹·웹사이트 배포 상세와 설정 조회 | 로그인된 콘솔. 직접 Render API 키를 로컬에 설치하지 않음 |
| Neon | Weddingpick 프로젝트 Admin 표시, production 브랜치, `neondb`·`weddingpick_staging` DB 존재 | 콘솔 접근. 로컬 SQL 접속용 인증 추가·SQL 실행은 하지 않음 |
| NCP Object Storage | 한국 리전, `weddingpick-test` 버킷, 소유자 목록조회·업로드·ACL 권한 표시 | 콘솔 접근. 버킷 목록 공개는 ‘공개 안함’. 개별 객체의 ACL까지 일괄 검사한 것은 아님 |
| Expo/EAS | 계정 Owner, `@mrjesxys-team/weddingpick`, project ID 일치, 기존 빌드 조회 | 로컬 EAS CLI 인증으로 실제 조회 성공 |
| Kakao Developers | 웨딩픽 앱 ID `1565316`, Owner, 비즈 앱·동의항목 승인 | 콘솔에서 `age_range` 필수 동의, `birthyear` 권한 없음 확인. 설정 변경 없음 |
| App Store Connect | 웨딩픽 앱 `6807263257`, 배포·TestFlight 화면 | iOS 1.0 ‘제출 준비 중’, TestFlight 1.0.0 빌드 2 ‘제출 준비 완료’. 심사 제출·빌드 배포는 하지 않음 |
| Google Play | `kr.weddingpick.app` 앱과 대시보드 접근 | 앱 상태 ‘임시’. 앱 설정·비공개 테스트·프로덕션 액세스 절차 미완료, 프로덕션 신청 버튼 비활성 |
| Cloudflare | 연결 계정 API HTTP 200, zone 목록 빈 배열 | 계정 인증은 유효. 미사용 커스텀 도메인이 없다는 사실을 문제로 삼지 않음 |

콘솔 로그인은 사용자 협조로 완료됐다. 장기 실행 시 세션 만료·추가 인증이 발생할 수 있으며, 현재 접근 가능이 영구 인증을 보장하지 않는다.

## 배포 버전 대조

| 대상 | 확인한 현재 버전 |
|---|---|
| Render 운영 API | `e34193e`, Live, 9월 10일 22:19:16 KST, Auto-Deploy |
| Render 앱 웹·관리자 | `e34193e`, Live, 9월 10일 22:19:16 KST |
| Render 웹사이트 | `e34193e`, Live, 9월 10일 22:19:16 KST |
| EAS 최신 조회 Android preview | 9월 4일 16:15 KST 생성, `33701bf`, FINISHED |
| EAS 최근 Android production | 9월 4일 09:18 KST 생성, `e4e3327`, FINISHED |
| EAS 최근 iOS production | 9월 3일 16:35 KST 생성, `3e10bbc`, FINISHED |

EAS는 최근 5개 빌드 조회 결과다. 실제 사용자의 기기에 어떤 빌드가 설치되어 있는지는 확인하지 않았다. 따라서 웹과 네이티브 빌드의 시점 차이는 확정이지만, 그 차이가 현재 기기 증상의 직접 원인인지까지 단정하지 않는다. TestFlight의 빌드 2와 EAS 기록의 빌드 번호 연결도 추가 확인이 필요하다.

## 운영 API·DB

공개 `https://weddingpickl.onrender.com/health`를 실제 호출한 결과:

```json
{
  "ok": true,
  "database": "ok",
  "schema": {
    "applied": 106,
    "expected": 103,
    "pending": [],
    "unknown": ["0052_mission_draw", "0059_wedding_events", "0060_vendor_geo"],
    "ok": true
  }
}
```

미적용 migration은 0개이며 API의 DB 접속은 성공한다. 저장소 기준 밖의 이력 3개는 별도 확인 대상이며 임의 삭제하지 않았다. 이 health가 관리자 API 응답 구조나 모든 기능 정상까지 검증하지는 않는다.

GitHub **DB Inventory** 실행 `34476381128`(9월 10일 21:22 KST)의 job `102868050116`은 전체 결론이 success지만, `target=production`의 마이그레이션 조회는 내부 DB 호스트 이름 해석 오류 `EAI_AGAIN`으로 실패했다. 같은 실행의 공개 API health는 성공했다.

즉, **운영 API에서 DB가 열리는 것과 GitHub의 `PRODUCTION_DATABASE_URL`로 DB를 조회하는 것은 다른 결과**다. 기존 로그의 성공 표시만으로 모든 DB 연결이 정상이라고 읽으면 안 된다. 이번 점검에서 secret을 복사하거나 바꾸지 않았다.

Neon 콘솔에서는 production 브랜치 하나에 `neondb`와 `weddingpick_staging` 두 DB를 확인했다. 별도 DB 이름은 있지만 별도 브랜치로 환경이 분리된 구성은 아니다. Render에서는 Production에 API·앱 웹·웹사이트·별도 DB·별도 관리자 리소스가 있고, Webview 환경은 비어 있다. 남아 있는 별도 DB/관리자 리소스를 이름만 보고 사용 중·미사용으로 단정하거나 삭제하지 않았다.

## 속도와 환경 차이

- Render 운영 API는 **Free**, 리전 **Ohio (US East)**다. 콘솔에는 유휴 후 기동으로 요청이 **50초 이상 지연될 수 있음**이 명시돼 있다. 이는 서비스 설정에 표시된 가능성이며 이번에 재현·측정한 지연 시간이 아니다.
- Neon 프로젝트는 **AWS Singapore**, NCP Object Storage는 **한국**이다. 여러 리전에 흩어진 구성은 확인됐다. 운영 API의 실제 DB endpoint와 Neon 프로젝트 매핑을 비밀값 노출 없이 확정한 다음 왕복 지연을 계측해야 한다.
- 카카오 동의항목은 닉네임·프로필 사진·이메일·연령대가 필수, 출생연도 권한은 없다. 최신 구현의 age_range 사용과 일치한다. 과거 출생연도 문서를 근거로 콘솔을 되돌리면 안 된다.
- NCP 버킷의 목록 공개는 꺼져 있다. 업로드·다운로드 왕복 시험, 개별 객체 공개 여부, 서명 URL·CORS·보존 작업 전체 검증은 이번 읽기 점검에서 수행하지 않았다.

## 미사용 커스텀 도메인 참조 (검수 당시)

사용자 확인에 따라 다음은 DNS 복구 과제가 아니라 **낡은 설정·문서 정리 대상**이다.

- `infra/render-env.yml:62,67`: 커스텀 도메인 설명과 CORS allowlist에 잔존.
- `.github/workflows/main.yml:146,174`: 미사용 커스텀 도메인 연결 단계가 잔존.
- `packages/domain/src/site.ts:5`: ‘아직 DNS가 살아 있지 않다’는 주석. ‘현재 미사용’이라는 결정과 다름.

후속 저장소 정리에서 위 연결 단계와 활성 CORS 출처를 제거하고 주석을 정정했다. 이는 저장소 변경이며 도메인 소유·실제 DNS 설정을 변경하거나 도메인을 삭제한 것이 아니다. 운영 반영은 해당 PR의 병합·동기화 결과를 별도로 확인한다.

실제 활성 주소는 API `weddingpickl.onrender.com`, 앱/관리자 `weddingpick-app-web.onrender.com`, 웹사이트 `weddingpick-web.onrender.com`이다.

## 이번에 하지 않은 변경·추가 점검

- 운영 설정 변경, 유료 요금제 전환, 리전 이동, DB migration/데이터 변경, 새 빌드·스토어 제출을 하지 않았다.
- 인증키 생성·복사·재발급, GitHub Secrets 변경, DNS 등록을 하지 않았다.
- 기존 `Storage Test`는 실제 PUT/DELETE를 하므로 조회 전용 검사로 실행하지 않았다. 공개 API health 외 기능 요청의 쓰기 테스트도 수행하지 않았다.
- APNs/FCM 자격·실기기 푸시, Apple Developer의 capability/프로비저닝, 외부 AI 사용량·공공데이터 키 유효성까지 모두 검증 완료한 상태는 아니다.
- 앱의 이메일 매칭은 콘솔 접근과 별개다. 코드상 이메일 매칭 응답은 stub이므로 외부 메일 계정 로그인이 제품 연동을 완성하지 않는다.

다음 수정은 기존 [앱·관리자 기능 검수](INFORMATION_AUDIT_2026-09-10.md), [최신 디자인 ZIP 대조](DESIGN_ZIP_AUDIT_2026-09-10.md)와 연결해 판단한다. 주요 인프라에 접근할 수 있게 된 것과 해당 결함들이 해결된 것은 구분한다.

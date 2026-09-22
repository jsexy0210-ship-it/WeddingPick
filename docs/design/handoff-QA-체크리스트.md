# 웨딩픽 개발 핸드오프 — QA 체크리스트

시안 단계에서 다루지 않는 실제 구현 검수 항목. CLAUDE.md의 디자인 규칙과 별개로, 개발/QA 팀이 기능 구현 시 참고.

> 정상 Happy Path만 검수하지 않는다. 모든 주요 기능에 대해 정상 · 빈 상태 · 실패 · 중단 · 재진입 · 중복 실행 · 권한 거부 · 네트워크 장애 · 세션 만료까지 검증한다.

## 분류 체계
UX/UI → User Journey → Navigation → State → Data → API → Auth → OS(Android/iOS) → Permission → Network → Performance → Accessibility → Security → Admin 연계 → Legacy Cleanup → Regression

## 인증 / 세션
로그인 성공·실패·취소 · 세션 만료 후 처리 · 앱 재실행 시 로그인 유지 · 로그아웃 후 보호 페이지 접근 차단 · 중복 로그인 · OAuth 복귀 · 인증 중 Back/앱 종료 · 로그인→온보딩→앱 진입 history 정리

## 권한(Permission)
알림·사진·카메라·위치 최초 요청 · 거부/다시 묻지 않음/설정 재허용 · 권한 없어도 크래시 금지 · 기능 사용 시점에 필요한 권한만 요청

## 폼 / 입력 검증
필수값 · 최대·최소 길이 · 숫자/날짜/금액 형식 · 앞뒤 공백 · 특수문자/이모지 · 복붙 · 중복 제출 · 연타 · 서버 오류 후 입력값 유지

## 로딩 / 중복 액션
API 응답 전 버튼 연타 방지 · 저장 버튼 중복 실행 방지 · Skeleton/Loader · 요청 중 페이지 이동 처리 · 무한 로딩 금지

## 네트워크 장애 복원
연결 끊김 · Timeout · 4xx/5xx · 서버 재시작 · Retry · 저장 직전 통신 끊김 · 복구 후 재조회 · 실패했는데 성공 Toast 뜨는 문제 금지

## 데이터 동기화 / 정합성
등록→목록→상세 즉시 반영 · 수정 시 모든 진입 경로 동일 표시 · 삭제 시 캐시 목록에서도 제거 · Pick/후기/일정 상태가 화면별로 어긋나지 않음 · 여러 탭/기기 변경 시 재조회 기준

## 목록 UX
Pagination · Infinite Scroll · 마지막 페이지 · 0건/1건/대량 데이터 · 중복 아이템 · 정렬·필터 후 pagination 초기화 · Scroll 위치 복원

## 검색
한글 초성/완성형 · 공백 · 오타 · 결과 없음 · 검색 중 취소 · 검색어 삭제 · 필터 조합 · 검색→상세→Back 시 검색 상태 유지

## 이미지 / 미디어
이미지 없음 · 깨진 URL · 느린 로딩 · 비정상 비율 · 매우 큰 이미지 · Thumbnail/원본 불일치 · 업로드 실패·재업로드 · Placeholder 통일

## 삭제 / 취소 / 위험 행동
삭제 확인 · 취소 가능 여부 · 중복 삭제 · 삭제 완료 후 화면 처리 · 작성 중 닫기 · 저장 안 된 변경사항 경고 · 이미 삭제된 데이터 재삭제 예외 처리

## Deep Link / 외부 진입
알림→상세 · 외부 링크→앱 · 로그인 전 Deep Link 진입 · 로그인 후 원래 목적 화면 복귀 · 존재하지 않는 ID · 삭제된 콘텐츠 링크 · 잘못된 URL

## 알림
ON/OFF · Foreground/Background/종료 상태 · 알림 클릭 목적 화면 정확성 · 이미 삭제된 대상 알림 · 중복 알림 · 읽음 상태 · 설정값과 실제 발송 조건 일치

## 접근성
글자 확대 · 최소 터치 영역 44px · 대비 4.5:1 · 아이콘 전용 버튼의 의미 전달 · 스크린리더 · 색만으로 상태 구분 금지 · 시스템 폰트 확대 시 레이아웃 붕괴 여부

## 디바이스 환경 변화
Background↔Foreground · 강제 종료→재실행 · 화면 잠금→해제 · Wi-Fi↔LTE 전환 · 자정 넘어가는 상황 · 시스템 다크모드 · 글자 크기 변경

## 성능
첫 화면 진입 속도 · 화면 전환 지연 · 긴 목록 스크롤 끊김 · 이미지 메모리 사용 · 불필요한 API 반복 호출 · 동일 API 재호출 · Loading 깜빡임

## 보안 / 개인정보 UI
로그아웃 후 개인정보 캐시 잔존 여부 · 다른 사용자 데이터 노출 · URL에 토큰·개인정보 포함 금지 · 로그에 민감정보 출력 금지 · 탈퇴 후 접근 · 권한 없는 API/관리자 페이지 접근

## Analytics / 이벤트
화면 노출 · CTA · 관심 · Pick · 등록 완료 · 오류 이벤트 · 중복 발송 금지 · 이벤트명과 실제 사용자 행동 일치(UI 변경 시 옛 버튼명 전송 주의)

## 환경별 차이
Local/Dev/Production · 환경변수 · API Endpoint · Feature Flag · Debug 기능 · 테스트 계정/Mock 데이터 · 운영에서만 발생하는 조건

## 관리자 ↔ 사용자 연계
등록→사용자 화면 노출 · 수정 반영 · 비노출 시 실제 제거 · 삭제 · 노출순서 · 썸네일 · 상태값 · 예약 공개 · 사용 중인 값을 관리자가 변경했을 때 예외 처리

## 회귀검증
기능 하나 수정 시 인접 기능까지 재확인.
- Header 수정 → 전체 Header + Back + Tab + Safe Area
- Pick 로직 수정 → 추천 → 상세 → Pick → 나의 Pick → 해제/변경
- 공통 BottomSheet 수정 → BottomSheet 쓰는 전체 기능 재검수

## iOS 전용
좌측 Edge Swipe Back(Header Back과 동일 Navigation Context 유지, 인증 완료 후 login/setup 역진입 금지) · Modal/BottomSheet 열린 상태에서는 제스처가 배경 이동보다 Overlay 종료 우선 · `safe-area-inset-top/bottom`(하단 CTA·Bottom Navigation이 Home Indicator에 가리지 않음) · 키보드 노출 시 입력/CTA 가림 방지 및 종료 후 레이아웃 복원 · Status Bar 스타일이 화면 전환 후 이전 값으로 안 남는지 · WKWebView history와 앱 Navigation history 충돌(이중 Back, OAuth 복귀 오류) · SE급/일반/Pro Max급/노치/Dynamic Island 기기별 확인

## Legacy / Stale Artifact
최신 정본만 Source of Truth. 구 UI(같은 역할의 옛 헤더·탭·카드·버튼·시트)가 최신본과 따로 남아있지 않은지, 최신 IA에 없는 화면에 URL로 직접 접근 가능한지, Mock 데이터가 운영 데이터처럼 노출되지 않는지, 삭제된 메뉴명·기능명이 문구에 남아있지 않은지 전수 확인. 삭제 전 참조 관계 먼저 확인.

## 완료 기준
- 동일 역할의 구/신 컴포넌트 중복 없음
- 최신 IA에 없는 화면 임의 접근 없음
- Mock/Test 데이터 운영 노출 없음
- 이전 디자인 스타일 혼재 없음
- 컴포넌트 간 overlap · 텍스트/탭/카드 clipping 없음
- 가로 탭 정상 스크롤, 세로 페이지 정상 스크롤
- 상단 Header · 하단 Navigation에 콘텐츠 가림 없음
- 삭제 후 Build/Type/Test/주요 E2E 정상
- 최신 디자인 정본과 실제 구현이 1:1 일치

## 버전 호환성 / 업데이트
구버전 앱↔최신 API 호환 · 업데이트 전후 로그인 유지 · 스키마 변경 후 기존 데이터 정상 · 강제/선택 업데이트 정책 · 업데이트 중 저장 데이터 유실 금지 · 구버전에서 만든 데이터가 최신 버전에서 정상 표시

## 데이터 Migration
필드명 변경 · Enum/상태값 변경 · null→필수값 전환 · 기존 데이터 default 처리 · migration 실패 시 rollback · 오래된 데이터로 신규 UI가 깨지지 않는지

## 동시성 / Race Condition
버튼 연타 · 여러 화면 동일 데이터 동시 변경 · 사용자·배우자 동시 수정 · 관리자·사용자 동시 변경 · 요청 순서 역전으로 이전 값이 최신 값 덮는 현상 · 중복 등록/결제/Pick 방지

## Idempotency
동일 요청 두 번 보내도 결과 한 번만 적용: 등록 · 예약 · Pick · 관심 · 후기 · 알림 처리

## Optimistic UI 검수
하트 클릭 즉시 UI 변경 후 API 실패 케이스 · 저장 성공처럼 보였는데 서버 실패 · 실패 시 UI 원복 · 서버·클라이언트 최종 상태 일치

## Cache 정합성
목록/상세/프로필 캐시 · 관리자 수정 후 사용자 화면 캐시 · 로그아웃 후 이전 계정 캐시 노출 금지 · stale data 재검증 정책

## 날짜 / 시간
자정 전후 · 날짜 변경 · 서버시간↔단말시간 · 기기 시간 임의 변경 · 예약/만료시간 · 오늘/내일/D-Day 계산 · Timezone 저장 방식

## Locale / 포맷
금액 천단위 · 날짜 포맷 · 전화번호 · 주소 · 숫자 단위 · 긴 한글 · 영숫자 혼합 레이아웃 · Unicode/Emoji 입력

## Focus 관리
BottomSheet 열릴 때 focus 위치 · Dialog 닫힌 후 focus 복귀 · 키보드 Next/Done 동작 · 자동 focus로 인한 갑작스런 스크롤 방지 · Screen Reader focus 순서

## 제스처 충돌
가로 Carousel↔세로 Scroll · Tab Swipe↔iOS Back Swipe · BottomSheet drag↔내부 Scroll · 이미지 swipe↔페이지 navigation · Pull-to-refresh↔Header

## Pull-to-refresh
현재 필터/Tab 유지 · Scroll 처리 · 중복 API 호출 금지 · Loading UI 중복 표시 금지

## 취소 / Undo
실행 취소 · 취소 가능 시간 · Undo 후 데이터 복원 · 다른 화면에서도 복원 상태 동기화

## 앱 Life Cycle
작업 중 홈 이동 · 장시간 Background · OS 프로세스 kill 후 재실행 · 작성 중 데이터 보존 여부 · 세션 재검증 · 열려있던 상세 데이터 최신화

## Low Memory / 저사양 단말
긴 목록 · 대형 이미지 · BottomSheet 반복 open/close · 화면 이동 반복 · 메모리 누수 · 앱 강제 종료 여부

## 네트워크 품질 저하
매우 느린 네트워크 · 요청 일부만 성공 · 업로드 중 끊김 · Wi-Fi→LTE 전환 · 동일 요청 재시도 · Timeout 후 늦게 도착하는 응답

## API 순서 의존성
A 실패·B만 성공 · 응답 순서 역전 · 부분 데이터 · API 하나만 지연

## Partial Failure
예: DB 저장 성공→이미지 업로드 실패. 데이터 롤백 · 재시도 · 사용자 메시지 · 중복 데이터 방지

## 삭제된 대상 / 상태 변경 대상
사용자가 보는 동안 관리자가 삭제·비공개 처리한 경우: 500 노출 금지 · 적절한 안내 · 목록 복귀 · 캐시 제거

## 빈 값과 Null
이미지/제목/가격/날짜 null · 빈 배열 · 값 0 · 빈 문자열 · API field 자체 부재 — 각각 UI가 구분 처리

## 대량 데이터 / 극단값
업체 1,000개 · 후기 0/1/수천 건 · 매우 긴 업체명 · 가격 0 · 매우 큰 금액 · 최대 일정 수 · 아주 긴 본문 · 이미지 다수

## 정렬 안정성
동일 점수·날짜 데이터가 새로고침마다 순서 뒤집히지 않는지

## Pagination 중 데이터 변경
1페이지 본 뒤 새 데이터 추가 시 2페이지에서 중복/누락/순서 뒤집힘 방지

## Feature Flag
OFF인데 UI 노출 · UI OFF인데 API 호출 · 사용자 그룹별 노출 · Flag 제거 후 dead code · 운영/개발 Flag 혼선

## Rollback 검수
이전 버전 롤백 시 DB 호환 여부 · 최신 데이터 안 깨지는지 · 구버전이 새 필드 받아도 안 죽는지

## 관찰 가능성
주요 API Error 로그 · 인증 실패 · 이미지 업로드 실패 · 예상치 못한 navigation · 500 · crash · 반복 retry — 문제 발생 시 원인 추적 가능해야 함

## 사용자 메시지 품질
"오류가 발생했습니다"만 반복 금지. 무엇을 해야 하는지 · 재시도 가능 여부 · 저장 여부 · 입력값 유지 여부를 명확히 표시

## 법적/동의 UX
필수/선택 동의 구분 · 동의 버전 변경·재동의 · 개인정보 수정 · 탈퇴 · 데이터 삭제/보존 정책 · 약관 링크 · 동의 없이 다음 단계 진입 금지

## 복구 가능성
사용자 실수나 시스템 오류 후 정상 상태로 되돌릴 수 있는지 — 오류 없는 시스템보다 오류가 나도 복구되는 시스템을 우선한다.

## 경계값(Boundary) 검수
각 기능은 정상값뿐 아니라 최소값 · 최대값 · 0건 · 1건 · 초과값 · Null · 빈 문자열 · 긴 문자열 · 중복값 · 삭제된 데이터 · 오래된 데이터까지 검증한다.

## 전체 QA 분류 체계 (최종)
UX/UI → Journey → Navigation → Interaction → State → Data → API → Auth → Permission → OS → Device → Network → Concurrency → Cache → Migration → Performance → Accessibility → Security → Admin 연계 → Legacy Cleanup → Analytics → Observability → Rollback → Regression

실제 운영에서는 이 문서 전체를 매번 실행하지 않고, **공통 체크리스트 + 변경 영향 범위 기반 회귀검수**로 돌린다(예: Header 수정 → Header/Back/Tab/Safe Area만 재검수).

## 중단·복귀 시나리오
작성 중 전화/알림/다른 앱 이동 · OAuth·외부 브라우저 이동 후 복귀 · 사진 선택기 진입 후 취소 · 인증 도중 Background · 복귀 시 중복 실행/처음부터 재시작 방지

## 계정 전환 / 사용자 격리
A 로그아웃→B 로그인 시 A의 관심업체·Pick·최근검색·프로필·캐시가 B에게 노출 금지 · 세션뿐 아니라 로컬 저장소까지 초기화 확인

## 역할·권한별 접근
일반 사용자/관리자/운영자 역할별 접근 범위 · URL 직접 입력으로 관리자 기능 진입 불가 · UI 숨김뿐 아니라 API 레벨 차단

## 백그라운드 작업 / 비동기 처리
이미지 처리 · 자동 콘텐츠 생성 · 알림 · 검색 인덱싱 · 예약 작업 · 관리자 등록 후 사용자 화면 반영 — "처리 중→성공/실패" 상태 정확히 관리

## Eventual Consistency
저장은 성공했지만 검색·추천·목록에 몇 초 뒤 반영되는 구조를 오류처럼 보이지 않게 처리 · 장시간 미반영 시 복구 방법 존재

## 외부 서비스 장애
카카오 로그인 · Gemini · Object Storage · 지도/주소 등 외부 API 하나가 죽어도 앱 전체가 같이 죽지 않을 것

## Rate Limit / 과도한 요청
검색 연타 · 버튼 연타 · 자동완성 · 스크롤 API 호출 · AI 생성 버튼 반복 클릭 — 클라이언트 debounce/throttle + 서버 제한 시 UX

## AI 기능 QA (Gemini 등)
빈 응답 · 너무 긴 응답 · JSON 형식 오류 · 금지/엉뚱한 내용 · 부분 생성 실패 · Timeout · 중복 실행 · 생성 중 화면 이탈 · 사용자가 결과 직접 수정 가능 여부 · AI 결과를 사실 데이터처럼 자동 확정 금지

## 콘텐츠 품질
제목/본문 잘림 · 중복 콘텐츠 · 오래된 정보 · 잘못된 썸네일 · 이미지-본문 불일치 · 폐업·삭제된 업체 · 가격/혜택 유효기간 · 출처 없는 정보

## 관리자 상태값 → 사용자 표현 매핑
`draft/published/hidden/deleted/suspended` 등 내부 상태가 사용자 화면에 정확히 반영되는지 — 비공개 처리했는데 검색에 계속 뜨는 귀신 데이터 방지

## 공유 기능
공유 링크 · 앱 설치/미설치 · 로그인 여부 · 삭제된 콘텐츠 · 공유 후 앱 복귀 · iOS Share Sheet/Android Share Intent

## Universal Link / App Link
웹 URL→앱 · 설치 여부별 처리 · 특정 상세 진입 · 인증 후 원래 목적지 복원 · 잘못된 ID fallback

## 브라우저/WebView 차이
Android WebView · iOS WKWebView · Chrome · Safari에서 CSS/History/키보드/viewport 동일 동작 확인

## 텍스트 확대 / Dynamic Type
시스템 글꼴 120%/150%/200% · 버튼 글자 두 줄 · Header 제목 길어짐 · BottomNavigation label · BottomSheet 높이 증가 — 버튼 밖으로 텍스트 탈출 방지

## 콘텐츠 길이 국제화 내성
긴 업체명·주소·사용자명 · 영문 URL · 숫자/특수문자로 레이아웃 안 깨지는지

## 클립보드 / 붙여넣기
URL · 전화번호 · Emoji · 줄바꿈 · 대량 텍스트 · 보이지 않는 문자 — 입력 데이터 정규화 여부

## 중복 데이터
동일 업체·후기·이미지·알림·자동작성 콘텐츠 — 프론트 숨김이 아니라 데이터 레벨 원인 확인

## Soft Delete / Hard Delete
삭제가 실제 삭제인지 상태 변경인지 구분 · 검색/상세/추천/캐시/관리자/사용자 기록에 어디까지 남아야 하는지 정책·구현 일치

## 탈퇴 전체 흐름
재인증 · 탈퇴 확인 · 세션 종료 · 개인화 데이터 · 후기/제보 별도 보존 정책 · 재가입 · 이전 계정 데이터 재노출 여부

## 운영 데이터 오염
TEST/demo/temp/dummy/sample/qa · localhost URL · 개발용 계정 · 임시 이미지가 운영 DB/관리자/사용자 화면에 남아있지 않은지

## 환경변수 / Secret
개발 키가 운영에 사용되지 않는지 · 프론트 bundle에 secret 포함 여부 · 사용 종료된 API key · 잘못된 callback URL · debug 설정 · localhost fallback

## 로그 품질
"누가/언제/어떤 기능/어떤 요청/왜 실패했는지" 추적 가능해야 함. 개인정보·토큰은 로그에 남지 않을 것

## 배포 직후 Smoke Test
배포 성공 표시만 믿지 않고 실제 운영 URL에서 로그인→홈→검색→상세→저장성 기능→MY/로그아웃 직접 확인

## 배포 전후 비교
변경 범위 외 화면이 깨지지 않았는지 — 공통 Header/Tabs/CSS/API Client 수정은 영향 범위가 넓음

## Rollback 후 Smoke Test
되돌리기 성공 표시만 믿지 않고 이전 버전으로 실제 서비스가 정상 동작하는지 재검증

## 앱스토어 출시 조건
권한 설명문 · 개인정보 문구 · 로그인/탈퇴 흐름 · 앱 아이콘/스플래시 · 버전/빌드 번호 · 스토어 심사 계정 · 외부 링크 · 정책 페이지

## 운영자 복구 가능성
사용자가 잘못된 상태에 빠졌을 때(잘못 Pick된 데이터, 노출 오류, 콘텐츠 상태 오류 등) 관리자가 DB 직접 수정 없이 처리 가능한지

## CS 대응 가능성
"내 관심업체가 사라졌다" 문의 시 원인 추적 가능 — 사용자가 보는 상태와 운영자가 확인하는 상태 사이 연결고리 필요

## QA 3단계 구분
1. **1차 Product QA** — UX/UI, Journey, Navigation, 디자인 정합성
2. **2차 Technical QA** — API, 상태, 인증, 네트워크, 캐시, 동시성, OS, 성능
3. **3차 Release & Operation QA** — 운영 데이터, 관리자 연계, 외부 서비스, 배포, Rollback, 로그, 복구, 스토어 출시

> 현재 화면이 정상적으로 보이는지만 검수하지 않는다. 사용자가 기능을 시작하기 전부터 완료한 이후, 앱 종료·재실행·실패·복구·관리자 변경·운영 배포 이후까지 전체 생명주기를 검증한다.

이 문서 전체는 **Product Release Readiness Audit(제품 출시 준비도 전수 검증)** 기준이다.

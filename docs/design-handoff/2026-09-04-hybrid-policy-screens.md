# 화면별 구현 방식 — 2026-09-04 정책 변경 반영

`CLAUDE.md` 최상단 "정책 변경 — 2026-09-04" 절의 실행 대상 목록. IA는
`docs/design-handoff/current/html/00-ia.dc.html`의 화면 ID 기준(2026-09-06, v3.11
반영 시 옛 `seed/` 세대에서 갱신).

## 요약

| 구현 방식 | 개수 | 의미 |
|---|---|---|
| 하이브리드 전환 | 154 | `apps/mobile`의 화면 대부분 — 웹뷰로 `apps/web` 대응 페이지를 띄운다 |
| RN 유지 | 2 | `WP-RPT-002`(이미지 선택), `WP-NOTI-003`(알림 설정) — OS 네이티브 필수 |
| 웹 전용(관리자) | 26 | `apps/mobile/src/app/admin/*` — 이미 웹에서만 동작(Platform.OS!=='web' 가드 있음), 이 정책과 무관 |
| 웹(현행 유지) | 8 | `WP-LAND-*` · `WP-WEB-*` — 이미 디자인 완료된 웹사이트, 정책 변경 제외 대상 |

"정책 변경 영향" 칼럼이 채워진 행은 비회원 삭제 · 헤더 검색버튼 삭제 정책과
직접 관련된 화면 — 구현 순서를 정할 때 먼저 본다.

"검수 상태"는 이 IA 문서와 실제 코드 문자열을 대조한 이전 감사 결과이며(대부분
"미검증"), 이번 정책 변경과 별개로 갱신이 필요한 값이다 — 여기서는 참고용으로만
같이 옮겼다.

---

| 화면 ID | 한글명 | 구현 방식 | 정책 변경 영향 | 검수 상태 | 코드 참조 |
|---|---|---|---|---|---|
| WP-APP-001 | 앱 아이콘 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-APP-002 | 시작 로딩 화면 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-APP-003 | 최초 실행 소개 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-APP-004 | 시작 | 하이브리드 전환 | 비로그인 삭제 정책 직접 영향 — 재설계/폐지 검토 필요 | 미검증 | 명시적 ID 참조 없음 |
| WP-APP-005 | 재실행 · 로그인 상태 복원 | 하이브리드 전환 | 비로그인 삭제 정책 직접 영향 — 재설계/폐지 검토 필요 | 미검증 | 명시적 ID 참조 없음 |
| WP-APP-006 | 앱 진입 오류 안내 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-APP-007 | 권한 요청 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-APP-008 | 초기 설정 — 예식일 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-APP-009 | 초기 설정 — 지역 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-APP-010 | 초기 설정 — 총예산 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-APP-011 | 초기 설정 — 취향 이미지 선택 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-APP-012 | 초기 설정 완료 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-NAV-001 | 홈 탭 | 하이브리드 전환 | 헤더 검색버튼 삭제 정책 직접 영향 | 미검증 | 명시적 ID 참조 없음 |
| WP-NAV-002 | 검색 탭 | 하이브리드 전환 | 헤더 검색버튼 삭제 정책 직접 영향 | 미검증 | 명시적 ID 참조 없음 |
| WP-NAV-003 | 픽 탭 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-NAV-004 | 우리웨딩 탭 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-NAV-005 | 마이페이지 탭 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-NAV-006 | 상황별 제보 진입점 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-HOME-001 | 개인화 홈 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/features/home/board.tsx · apps/mobile/src/features/home/home-skeleton.tsx |
| WP-HOME-002 | 우선순위별 홈 콘텐츠 분기 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-HOME-003 | 오늘의 픽 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-HOME-004 | 추천 상위 3곳 전체보기 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/(home)/top3.tsx |
| WP-HOME-005 | 다음 준비 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-HOME-006 | 개인화 웨딩 소식 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/(home)/feed.tsx |
| WP-HOME-007 | 홈 편집 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-HOME-008 | 비회원 홈 | 하이브리드 전환 | 비로그인 삭제 정책 직접 영향 — 재설계/폐지 검토 필요 | 미검증 | 명시적 ID 참조 없음 |
| WP-SRCH-001 | 검색 홈 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SRCH-002 | 검색어 입력 · 자동완성 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/search/autocomplete.tsx |
| WP-SRCH-003 | 업종별 탐색 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SRCH-004 | 검색 결과 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/search/index.tsx |
| WP-SRCH-005 | 검색 필터 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/search/filter.tsx |
| WP-SRCH-006 | 검색 결과 정렬 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SRCH-007 | 지도 보기 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/search/index.tsx · apps/mobile/src/app/(tabs)/search/map.tsx · apps/mobile/src/features/search/vendor-map.tsx |
| WP-SRCH-008 | 검색 결과 없음 · 오류 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-VEND-001 | 업체 상세 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/search/[vendorId]/index.tsx |
| WP-VEND-002 | 이미지 전체보기 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-VEND-003 | 제보 금액 상세 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-VEND-004 | 업체 안내 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-VEND-005 | 공식 정보 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-VEND-006 | 정보 오류 제보 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-CMP-001 | 비교 후보 선택 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/search/compare.tsx |
| WP-CMP-002 | 비교 결과 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-CMP-003 | 비교 요약 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-CMP-004 | 비교 화면에서 픽하기 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-PICK-001 | 픽 홈 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/pick/index.tsx |
| WP-PICK-002 | 업종별 픽 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/pick/category.tsx · apps/mobile/src/app/(tabs)/pick/compare.tsx · apps/mobile/src/app/(tabs)/pick/[category].tsx |
| WP-PICK-003 | 후보 비교 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-PICK-004 | 배우자 공동 결정 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-PICK-005 | 최종 결정 확인 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/pick/confirm.tsx · apps/mobile/src/app/(tabs)/pick/done.tsx |
| WP-PICK-006 | 결정 완료 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/pick/confirm.tsx · apps/mobile/src/app/(tabs)/pick/done.tsx |
| WP-PICK-007 | 결정 내역 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-PICK-008 | 픽 해제 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-OUR-001 | 우리웨딩 홈 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/wedding/index.tsx |
| WP-OUR-002 | 준비 현황 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-OUR-003 | 결정한 업체 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-OUR-004 | 일정 목록 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/wedding/[id]/events/index.tsx |
| WP-OUR-005 | 일정 상세 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/wedding/[id]/events/[eventId].tsx |
| WP-OUR-006 | 일정 추가 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/wedding/[id]/events/new.tsx |
| WP-OUR-007 | 준비 체크리스트 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-OUR-008 | 지출 요약 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-OUR-009 | 지출 내역 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-OUR-010 | 지출 상세 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-OUR-011 | 메모 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-OUR-012 | 준비 타임라인 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/wedding/[id]/timeline.tsx |
| WP-OUR-013 | 예식 완료 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/wedding/[id]/complete.tsx |
| WP-RPT-001 | 제보 홈 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-RPT-002 | 이미지 선택 | RN 유지 | 카메라/갤러리 접근 — OS 네이티브 필수 | 미검증 | 명시적 ID 참조 없음 |
| WP-RPT-003 | 문서 분석 중 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-RPT-004 | 자동 입력 결과 확인 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-RPT-005 | 업체 확인 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-RPT-006 | 분할 결제 연결 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-RPT-007 | 제출 완료 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-RPT-008 | 처리 결과 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/capture/verify-status/[requestId].tsx |
| WP-RPT-009 | 내 제보 내역 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-RPT-010 | 가격 제보 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-RPT-011 | 업체 정보 제보 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-REV-001 | 후기 목록 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-REV-002 | 후기 작성 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-REV-003 | 후기 상세 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-REV-004 | 내 후기 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-REV-005 | 후기 신고 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-REV-006 | 이용자 경험 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-REV-007 | 업체 반론 표시 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-EXPO-001 | 박람회 목록 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/search/expo/index.tsx |
| WP-EXPO-002 | 박람회 상세 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/search/expo/[expoId]/index.tsx |
| WP-EXPO-003 | 웨딩 정보 목록 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/search/wedding-info/index.tsx |
| WP-EXPO-004 | 웨딩 정보 상세 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/search/wedding-info/[infoId]/index.tsx |
| WP-EXPO-005 | 외부 달력에 일정 등록 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/search/expo/[expoId]/calendar.tsx · apps/mobile/src/app/(tabs)/wedding/[id]/events/[eventId].tsx |
| WP-EVT-001 | 혜택 모아보기 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-EVT-002 | 미션 4개 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-EVT-003 | 친구 초대 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-EVT-004 | 홍보 인증 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-EVT-005 | 월간 웨딩지원금 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-EVT-006 | 네이버페이 보상 수령 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-EVT-007 | 참여 · 지급 내역 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-NOTI-001 | 알림센터 | 하이브리드 전환 | 헤더 검색버튼 삭제 정책 직접 영향 | 미검증 | 명시적 ID 참조 없음 |
| WP-NOTI-002 | 알림 유형별 연결 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-NOTI-003 | 알림 설정 | RN 유지 | OS 알림 권한 · 푸시 토큰 등록 — OS 네이티브 필수 | 미검증 | 명시적 ID 참조 없음 |
| WP-MY-001 | 마이페이지 홈 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/my/index.tsx |
| WP-MY-002 | 프로필 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-MY-003 | 내 웨딩 설정 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-MY-004 | 취향 다시 고르기 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/my/taste.tsx |
| WP-MY-005 | 화면 설정 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-MY-006 | 배우자 연결 관리 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-MY-007 | 계정 관리 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-MY-008 | 회원 탈퇴 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/my/policies.tsx · apps/mobile/src/app/(tabs)/my/withdrawal.tsx |
| WP-MY-009 | 고객지원 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-MY-010 | 서비스 정보 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-CPL-001 | 배우자 초대 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-CPL-002 | 초대 수락 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-CPL-003 | 연결 완료 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-CPL-004 | 공동 편집 충돌 해결 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-CPL-005 | 변경 내역 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/wedding/[id]/conflict.tsx |
| WP-CPL-006 | 연결 해제 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/wedding/[id]/changelog.tsx |
| WP-BIZ-001 | 문의 유형 선택 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/my/biz/index.tsx |
| WP-BIZ-002 | 소속 확인 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/my/biz/claim.tsx |
| WP-BIZ-003 | 문의 내역 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/my/biz/data.tsx |
| WP-BIZ-004 | 반론 등록 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/my/biz/benefit.tsx |
| WP-BIZ-005 | 자료 제공 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/app/(tabs)/my/biz/ad.tsx |
| WP-BIZ-006 | 혜택 등록 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-BIZ-007 | 광고 · 제휴 문의 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-BIZ-008 | 웹 하단 업체 문의 진입 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-FAQ-001 | 자주 묻는 질문 홈 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/features/support/faq-section.tsx |
| WP-FAQ-003 | 질문 답변 상세 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/features/support/faq-section.tsx |
| WP-LEGAL-001 | 이용약관 본문 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-LEGAL-002 | 개인정보 처리방침 본문 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-001 | 기능 이용 시 로그인 | 하이브리드 전환 | 비로그인 삭제 정책 직접 영향 — 재설계/폐지 검토 필요 | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-002 | 픽 완료 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-003 | 픽 해제 확인 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-004 | 비교 후보 선택 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-005 | 최종 결정 확인 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-006 | 예식일 입력 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-007 | 지역 선택 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-008 | 예산 입력 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-009 | 취향 이미지 선택 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-010 | 배우자 초대 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-011 | 공유 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-012 | 달력에 일정 등록 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-013 | 신고 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-014 | 데이터 설명 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-015 | 기준금액 설명 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-SHT-016 | 권한 요청 설명 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-ST-001 | 회원 상태 | 하이브리드 전환 | 비로그인 삭제 정책 직접 영향 — 재설계/폐지 검토 필요 | 미검증 | apps/mobile/src/components/states/guest-gate-sheet.tsx |
| WP-ST-002 | 배우자 연결 상태 | 하이브리드 전환 |  | 미검증 | apps/mobile/src/components/states/spouse-connect-banner.tsx |
| WP-ST-003 | 픽 상태 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-ST-004 | 이미지 상태 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-ST-005 | 데이터 상태 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-ST-006 | 혜택 상태 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-ST-007 | 불러오는 중 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-ST-008 | 콘텐츠 없음 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-ST-009 | 오류 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-ST-010 | 네트워크 오류 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-ST-011 | 권한 거부 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-ST-012 | 처리 중 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-ST-013 | 긴 콘텐츠 표시 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-ST-014 | 점검 · 업데이트 안내 | 하이브리드 전환 |  | 미검증 | 명시적 ID 참조 없음 |
| WP-LAND-001 | 랜딩 | 웹(현행 유지) | 이미 디자인 완료된 웹사이트 — 정책 변경 제외 | 미검증 | 명시적 ID 참조 없음 |
| WP-LAND-002 | 서비스 소개 | 웹(현행 유지) | 이미 디자인 완료된 웹사이트 — 정책 변경 제외 | 미검증 | 명시적 ID 참조 없음 |
| WP-LAND-003 | 자주 묻는 질문 | 웹(현행 유지) | 이미 디자인 완료된 웹사이트 — 정책 변경 제외 | 미검증 | 명시적 ID 참조 없음 |
| WP-LAND-004 | 고객지원 | 웹(현행 유지) | 이미 디자인 완료된 웹사이트 — 정책 변경 제외 | 미검증 | 명시적 ID 참조 없음 |
| WP-LAND-005 | 이용약관 | 웹(현행 유지) | 이미 디자인 완료된 웹사이트 — 정책 변경 제외 | 미검증 | 명시적 ID 참조 없음 |
| WP-LAND-006 | 개인정보 처리방침 | 웹(현행 유지) | 이미 디자인 완료된 웹사이트 — 정책 변경 제외 | 미검증 | 명시적 ID 참조 없음 |
| WP-WEB-001 | 웹 홈 | 웹(현행 유지) | 이미 디자인 완료된 웹사이트 — 정책 변경 제외 | 미검증 | 명시적 ID 참조 없음 |
| WP-WEB-003 | 웹 업체 상세 | 웹(현행 유지) | 이미 디자인 완료된 웹사이트 — 정책 변경 제외 | 미검증 | 명시적 ID 참조 없음 |
| WP-ADM-001 | 관리자 홈 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/home.tsx |
| WP-ADM-002 | 일일 브리핑 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/briefing.tsx |
| WP-ADM-010 | 제보 처리 현황 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/data-pipeline.tsx |
| WP-ADM-011 | 확인 필요 목록 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | 명시적 ID 참조 없음 |
| WP-ADM-012 | 가격 통계 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/price-stats.tsx |
| WP-ADM-013 | 이상치 · 조작 탐지 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | 명시적 ID 참조 없음 |
| WP-ADM-014 | 업체 관리 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/vendors.tsx |
| WP-ADM-015 | 이미지 자동 수급 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/images.tsx |
| WP-ADM-016 | 이메일 회신 자동 매칭 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/email-matching.tsx |
| WP-ADM-020 | 사용자 계정 관리 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/users.tsx |
| WP-ADM-021 | 고객 의견 · 문의 관리 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | 명시적 ID 참조 없음 |
| WP-ADM-022 | 후기 · 반론 관리 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | 명시적 ID 참조 없음 |
| WP-ADM-023 | 업체 문의 처리 목록 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/biz-queue.tsx |
| WP-ADM-030 | 마케팅 자동화 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/marketing.tsx |
| WP-ADM-031 | 캠페인 · 보상 관리 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/campaigns.tsx |
| WP-ADM-032 | 수익 현황 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/revenue.tsx |
| WP-ADM-033 | 광고 집행 관리 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/ads.tsx |
| WP-ADM-034 | 광고 실운영 전환 조건 관리 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/ads-gate.tsx |
| WP-ADM-035 | 자주 묻는 질문 관리 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/faq.tsx |
| WP-ADM-036 | 약관 · 방침 관리 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/terms.tsx |
| WP-ADM-040 | 자동화 상태 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/automation.tsx |
| WP-ADM-041 | 긴급 중지 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/kill-switch.tsx |
| WP-ADM-042 | 변경 복구 관리 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/rollback.tsx |
| WP-ADM-050 | 인공지능 사용량 · 비용 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/ai-usage.tsx |
| WP-ADM-051 | 정책 규칙 관리 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/policy-engine.tsx |
| WP-ADM-052 | 감사 기록 | 웹 전용(관리자) | 정책 변경 대상 아님 — 이미 웹 전용 | 미검증 | apps/mobile/src/app/admin/audit-log.tsx |
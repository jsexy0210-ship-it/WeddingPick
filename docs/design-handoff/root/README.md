# 루트 시안 — 대표님이 직접 그린 원본

**여기가 화면의 정본이다**(2026-09-11 대표님이 직접 올림).

`../current/`는 전달 ZIP의 `handoff/` 폴더에서 뽑은 것이고, 이 폴더는 그 ZIP의
**루트에 있던 파일들**이다. 둘은 같은 화면을 다르게 그린다.

## 왜 이 폴더가 생겼나

2026-09-11에 검색 화면이 시안과 전혀 다르다는 지적을 받았다. 원인을 찾아보니
자료가 두 벌이었다.

    루트   「검색 홈 개념을 없앴습니다. 검색 탭을 누르면 즉시 결과 화면입니다.」
    handoff  06-search.dc.html:57  「1  검색 홈 · WP-SRCH-001」

**저장소에는 handoff 쪽만 들어와 있었다.** 그래서 모든 세션이 없어진 화면을
현행으로 알고, 그 위에 필터와 정렬을 계속 쌓았다. 세 세션이 그렇게 일했다.

이 어긋남은 `docs/DESIGN_ZIP_AUDIT_2026-09-10.md` 3-A가 하루 먼저 적어 뒀다 —
「자료의 충돌도 함께 해결해야 함」. 적어만 두고 해결하지 않는 동안 계속 벌어졌다.

## 어느 쪽을 따르는가

**루트가 이긴다.** 대표님이 직접 그린 것이고, 대표님 결정은 md보다 앞선다.

`../current/`와 어긋나면 이 폴더를 따른다. 그리고 어긋난 자리를 찾으면
**고치기 전에 여기부터 다시 읽는다** — 기억하고 있는 화면이 아니라 이 파일이
그리는 것이 현행이다.

## 읽기 전용

`../current/`와 같다. 전달받은 원본이라 고치지 않는다. 어긋나는 것은 저장소
쪽 코드를 고친다.

## 아직 대조하지 않은 것 — `DESIGN_ZIP_AUDIT_2026-09-10.md` 3-A의 나머지

검색 하나만 이런 것이 아니다. 같은 감사가 여섯 건을 더 적어 뒀고, 이 폴더가
들어왔으니 이제 전수로 대조할 수 있다.

| 항목 | 루트 | handoff |
|---|---|---|
| 제보 과정 | 확인 · 업체 선택 · 증빙 없는 제보 폐기 | 그대로 남음 |
| 폐기 화면 ID | WP-RPT-004/005/006/010 폐기 | screens.json은 활성 |
| 로그인 | 카카오 단일 | 소셜 4종 · 이메일 |
| 나이 | age_range 판정 | 출생연도 필수 |
| 날짜 선택 | 연월 셀렉트 + 달력 | 휠 3열 |
| 홈 D-day | coral | 무채색 |

## 파일

원본 파일 이름은 업로드를 거치며 사라졌다(한글이 밑줄로 바뀌었다). 그래서
**파일 안의 제목과 화면 ID로 이름을 다시 지었다.** 뒤쪽의 업로드 이름은 같은
파일을 다시 받을 때 대조하라고 남긴다.

| 파일 | 화면 수 | 담긴 화면 ID(앞 6개) | 업로드 이름 |
|---|---|---|---|
| `Admin-관리자 운영 11화면.dc.html` | 12 | WP-ADM-002 · WP-ADM-013 · WP-ADM-015 · WP-ADM-016 · WP-ADM-030 · WP-ADM-032 … | `24326030-__________.dc.html` |
| `Device-기기별 하단 여백.dc.html` | 0 | — | `e63e7b99-___________.dc.html` |
| `IA-전체 IA.dc.html` | 194 | WP-ADM-001 · WP-ADM-002 · WP-ADM-010 · WP-ADM-011 · WP-ADM-012 · WP-ADM-013 … | `da3d191f-_______IA.dc.html` |
| `Live Clone-웹 하위 3페이지.dc.html` | 0 | — | `603e5aff-___________.dc.html` |
| `Live Clone-웹사이트 복제.dc.html` | 0 | — | `7c8bd20a-____________.dc.html` |
| `Live Clone-이용약관 · 개인정보처리방침.dc.html` | 0 | — | `c60ed086-___________.dc.html` |
| `P2-마감 6종.dc.html` | 6 | WP-EXPO-002 · WP-MY-008 · WP-NOTI-002 · WP-OUR-007 · WP-OUR-010 · WP-REV-005 | `f8ef405a-_________.dc.html` |
| `SPEC-컴포넌트 시트.dc.html` | 0 | — | `c49015fe-___________.dc.html` |
| `Store-앱스토어 · 플레이스토어 이미지.dc.html` | 0 | — | `3ba75965-___________.dc.html` |
| `WP-ADM-자동화 비율.dc.html` | 0 | — | `f67006ab-_______.dc.html` |
| `WP-APP-020-초기 설정 · 5개 질문.dc.html` | 1 | WP-APP-020 | `b75b7ae8-________v2.dc.html` |
| `WP-APP-앱 공통 화면.dc.html` | 9 | WP-APP-001 · WP-APP-002 · WP-APP-003 · WP-APP-004 · WP-APP-006 · WP-APP-007 … | `d2c62963-__________.dc.html` |
| `WP-APP-온보딩 v4.dc.html` | 0 | — | `c12caecc-_______v4.dc.html` |
| `WP-AUTH-001-로그인 보조 화면.dc.html` | 2 | WP-AUTH-001 · WP-AUTH-009 | `625879c7-___________.dc.html` |
| `WP-AUTH-로그인.dc.html` | 9 | WP-AUTH-001 · WP-AUTH-002 · WP-AUTH-003 · WP-AUTH-004 · WP-AUTH-005 · WP-AUTH-006 … | `5fcac9e4-_______.dc.html` |
| `WP-BIZ-업체 · 플래너 문의.dc.html` | 0 | — | `e7b84703-________.dc.html` |
| `WP-CPL-배우자 연결.dc.html` | 6 | WP-CPL-001 · WP-CPL-002 · WP-CPL-003 · WP-CPL-004 · WP-CPL-005 · WP-CPL-006 | `aae4a8a5-_________.dc.html` |
| `WP-EVT-혜택 · 이벤트.dc.html` | 7 | WP-EVT-001 · WP-EVT-002 · WP-EVT-003 · WP-EVT-004 · WP-EVT-005 · WP-EVT-006 … | `0afb7596-__________.dc.html` |
| `WP-FAQ-FAQ · 사용자와 운영자.dc.html` | 3 | WP-ADM-035 · WP-FAQ-001 · WP-FAQ-003 | `9ad85e14-____FAQ.dc.html` |
| `WP-HOME-001-홈 · 상태 정의 통합.dc.html` | 3 | WP-HOME-001 · WP-OUR-013 · WP-SHT-017 | `bd2dfaeb-__________.dc.html` |
| `WP-LEGAL-이용약관 · 개인정보처리방침.dc.html` | 4 | WP-ADM-036 · WP-LEGAL-001 · WP-LEGAL-002 · WP-MY-010 | `cca15eb0-_________.dc.html` |
| `WP-MY-008-회원탈퇴.dc.html` | 1 | WP-MY-008 | `8f43d917-________.dc.html` |
| `WP-MY-MY 하위.dc.html` | 6 | WP-MY-002 · WP-MY-004 · WP-MY-005 · WP-MY-006 · WP-MY-007 · WP-MY-009 | `b0d4c67d-____MY___.dc.html` |
| `WP-OUR-웨딩일정 · MY.dc.html` | 6 | WP-BIZ-001 · WP-BIZ-002 · WP-BIZ-003 · WP-MY-001 · WP-OUR-001 · WP-OUR-012 | `c0979c9d-_________MY.dc.html` |
| `WP-OUR-웨딩일정 하위.dc.html` | 8 | WP-HOME-009 · WP-OUR-004 · WP-OUR-005 · WP-OUR-006 · WP-OUR-008 · WP-OUR-011 … | `ab4e4a0d-___________.dc.html` |
| `WP-PICK-Pick 비교·결정.dc.html` | 5 | WP-CMP-002 · WP-PICK-002 · WP-PICK-005 · WP-PICK-006 · WP-VEND-001 | `4108ea0a-________.dc.html` |
| `WP-PICK-Pick.dc.html` | 5 | WP-PICK-001 · WP-PICK-004 · WP-PICK-006 · WP-PICK-007 · WP-SHT-003 | `f555b2a9-____Pick__.dc.html` |
| `WP-RPT-제보·후기.dc.html` | 9 | WP-REV-001 · WP-REV-002 · WP-REV-006 · WP-RPT-001 · WP-RPT-002 · WP-RPT-004 … | `f5018514-_________.dc.html` |
| `WP-SHT-공통 Overlay · 상태.dc.html` | 14 | WP-AUTH-001 · WP-ST-001 · WP-ST-002 · WP-ST-004 · WP-ST-005 · WP-ST-006 … | `dde4af07-___________.dc.html` |
| `WP-SRCH-검색.dc.html` | 6 | WP-SRCH-001 · WP-SRCH-002 · WP-SRCH-004 · WP-SRCH-005 · WP-SRCH-007 · WP-SRCH-008 | `bfa78265-______.dc.html` |
| `WP-ST-007-로딩 화면.dc.html` | 1 | WP-ST-007 | `e677d35e-_________.dc.html` |
| `WP-ST-007-로딩·처리 중 상태 copy.dc.html` | 2 | WP-ST-007 · WP-ST-012 | `be795e59-_______copy.dc.html` |
| `WP-ST-007-로딩·처리 중 상태.dc.html` | 2 | WP-ST-007 · WP-ST-012 | `401a2797-______.dc.html` |
| `WP-VEND-업체 상세 하위.dc.html` | 6 | WP-REV-007 · WP-VEND-002 · WP-VEND-003 · WP-VEND-004 · WP-VEND-005 · WP-VEND-006 | `b13ef61e-___________.dc.html` |
| `WP-WEB-웹사이트.dc.html` | 0 | — | `895ad483-____________.dc.html` |
| `잔여-홈 · 제보 · 후기 · 박람회 · 검색.dc.html` | 15 | WP-EXPO-001 · WP-EXPO-003 · WP-EXPO-004 · WP-HOME-002 · WP-HOME-004 · WP-HOME-005 … | `bee3717e-_________.dc.html` |

`IA-전체 IA.dc.html`이 화면 194개를 한 파일에 담고 있다 — 전체 목록을 볼 때 여기부터 본다.

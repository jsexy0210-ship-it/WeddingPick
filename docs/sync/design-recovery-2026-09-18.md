# 디자인 중단 작업 인수 및 통합 기록

## 기준과 범위

사용자가 Claude 세션 한도로 대화 자료를 전달할 수 없어 GitHub에서 정본과 잔여 작업을 찾아 진행하도록 지시했다.
세션 내부 작업이나 미푸시 변경을 확인한 것은 아니다. 확인한 것은 저장소의 코드·PR·정본이다.

- 디자인 기준: `docs/design/README.md` 및 `CLAUDE.md`의 2026-09-17 결정.
- 수치/규칙: `docs/design/handoff/` v3.28 패키지(SPEC, screens, tokens, ADMIN).
- 모양: `docs/design/figma-export/` 9개 시안. 텍스트를 읽었으며 실제 캔버스를 렌더한 것은 아니다.
- 명시적 예외: Pretendard 유지, 좌우 24, 카카오+Apple, 홈/검색/Pick/웨딩노트/MY.
- 구 `design-handoff/current`, `figma-spec`, RN preview는 새 디자인의 근거로 사용하지 않는다.
- 초기 main `3ed8fb6e46a609b0919e493c1abaebf7491bc373`; 동시 변경 main `b90735ef1853d77010f0b233e30a5eef0cdfe0ea`.
  두 main 사이 변경은 Kakao API 배포 workflow 하나였으며 수정 없이 보존한다.

## 이어받은 실제 작업

| 원본 | 확인 SHA | 처리 |
| --- | --- | --- |
| #273 라운지·MY | cdf56752a898936ceb903773b27bb11c1aae1576 | 기존 작업 브랜치 `claude/overhaul-lounge-my`를 계속 사용 |
| #271 글 상세 | 86390691e2a68a705a45a3730c95864a1798a592 | #273 작업 브랜치로 대상 변경 후 병합; 운영 main 병합 아님 |
| #272 관리자 정적 산출물 | scripts/split-admin-dist.mjs의 fonts 누락 | fonts 보존만 반영. PR 전체를 병합하지 않음 |
| claude/home-pick-recommend | main 대비 문서 1파일만 앞섬 | 미푸시된 홈 구현을 회수했다고 주장하지 않음 |
| #274 인증 | 별도 인증 브랜치 | 이 디자인 통합에 포함하지 않음 |

#271→#273 작업 통합 커밋은 `4a00bb04026e6f0a77ed1b8a7d871d12278939f3`이다.
#271이 merged로 표시되어도 아직 main/운영에 배포된 것은 아니다.
최신 main과의 GitHub 시험 병합 `e3d4da536049212deec7aeea0b53d9b3de4d92de`의 양 부모와 tree를 확인해
기존 작업 및 동시 인프라 수정을 보존한 통합 tree를 사용한다. GitHub의 시험 병합은 테스트 성공을 뜻하지 않는다.

## 추가 구현

1. 라운지 웨딩정보 행을 실제 글 상세 `/feed/{id}`에 연결. ID는 경로 세그먼트로 인코딩하고
   버튼 접근성 이름과 눌림 상태를 추가했다. 필터·이미지·텍스트 배치는 유지한다.
2. Root 탭바를 스택 index 대신 현재 pathname과 선택된 Root 라우트로 판정.
   `/my/profile` 등 직접 열린 상세가 index 0이어도 탭바를 표시하지 않는다.
3. 상세 조회를 요청 세대와 id로 구분. 이전 글 응답·오류·unmount 이후 응답을 버린다.
   주소가 바뀐 첫 렌더에서 이전 글을 표시하지 않고, 잘못된 id는 무한 로딩 대신 오류로 보낸다.
   오류 및 하단 뒤로가기는 기존 `useDepthBack`을 사용해 직접 진입 시에도 fallback을 따른다.
4. 라운지 재조회 시 기존 사용자 정보 초기화. 사용자 정보 조회 실패 후 이전 글쓰기 표시가 남지 않게 했다.
5. 관리자 산출물 분리의 `ADMIN_KEEP`에 `fonts`를 추가해 public/fonts의 Pretendard를 보존한다.
6. 기존 mobile Jest에 격리 회귀 스크립트 호출을 연결. 별도 CI·배포 트리거·런타임 의존성은 추가하지 않았다.

## 실제 실행한 검증

`NODE_PATH=<설치된 TypeScript 경로> node scripts/verify-design-recovery.cjs`

- 격리 회귀 **45건 통과 / 실패 0**. 원형·선택 상태 등 화면의 픽셀 비교는 이 검사에 포함되지 않는다.
- 변경 TS/TSX 5파일 transpile 구문 검사 통과. 전체 프로젝트 타입 검사는 아니다.
- Node 22.16.0 / TypeScript 5.8.3. 저장소 잠금 버전의 전체 의존성을 설치한 환경이 아니다.
- Root 정의 원문은 Git blob `b5ed28e7791c0fc7407d1d2c35fb4e7196fb652a`와 로컬 원문의 해시 일치를 확인했다.
- 폰트 분리 전 원문은 `4a8f00744e9989a075559efd21472cd0b7129082`와 일치했다.
  그 원문이 실제 임시 파일시스템에서 fonts를 삭제하고, 수정본은 보존하는 것을 Node 자식 프로세스로 확인했다.
  앱 역할과 잘못된 역할·admin 누락의 안전 실패도 검사했다.
- TS/TSX 모듈을 실행했지만 React·Expo·UI·API 경계는 테스트 대역이다.
  공급자 로그인·운영 DB·실제 UI·실기기 검증으로 바꿔 읽으면 안 된다.
- 새 Jest 진입 파일은 추가했으나 이 환경에서 Jest 전체를 실행하지 못했다.
- 직접 GitHub clone 및 npm registry 연결은 DNS 실패로 의존성 설치가 불가능했다.

## 완료로 간주하지 않는 항목

- handoff 190화면 전체 또는 새 9개 시안의 전면 적용·픽셀 검수.
- 홈·추천 등 나머지 최신 시안의 구현 마무리 및 홈의 새 라운지 진입 정합성.
- 라운지 전체 후기 API, 후기 카테고리 필터, 스크랩 저장 기능.
- #273에 기록된 프로필 설정 구성과 일부 유지 메뉴의 정본 차이.
- #271에서 가져온 상세의 구형 시각 수치(예: heroFeed 208)와 최신 정본의 최종 대조.
  기능 연결을 위해 기존 시각 배치를 보존했으며 새 정본과 일치한다고 승인하지 않았다.
- 기존 spec/tokens.json의 pageX/grid.gutter 20 잔존과 정본 gutter 24의 일괄 정합성 수정.
- 전체 타입·lint·Jest·분리 DB·웹 빌드와 실제 브라우저/Android/iOS 검수.
- 인증 #274의 SecureStore/쿠키/nonce, 구형 웹뷰 호환성 및 배포 조건.

기존 작성자의 2,700건/2,705건 테스트 기록은 원본 브랜치 당시 보고이며 이번 통합본의 결과로 합산하지 않는다.
작업 브랜치만 갱신한다. main 병합·운영 배포·운영 DB·비밀값 변경은 하지 않는다.

# 콘솔 오류 여섯 — 처리 결과와 미해결 하나

2026-09-15에 대표님이 브라우저 콘솔을 찍어 보내신 것들이다. 여섯 중 다섯을 고쳤고
**①(React #419)은 고치지 않기로 정했다.** 왜 안 고치는지를 여기 적어 둔다 — 적어 두지
않으면 다음 세션이 같은 자리를 다시 파고, 같은 결론에 다시 도착한다.

| # | 무엇 | 상태 | 어디 |
| --- | --- | --- | --- |
| ① | React 최소화 오류 #419 (하이드레이션 중단) | **보류 — 아래 참조** | 전 화면 |
| ② | `Cannot read properties of undefined (reading 'startTime')` — `reportAllChanges` | 고침 | web-vitals 초기화 |
| ③ | `Blocked aria-hidden on an element because its descendant retained focus` | 고침 | 시트 · 모달 |
| ④ | CLS 0.22 | **다시 잰다** — ①이 원인이 아니었다 | 홈 · 검색 |
| ⑤ | `useNativeDriver` 경고 | 고침 | 애니메이션 |
| ⑥ | `A form field element should have an id or name attribute` | 고침 | 입력 필드 |
| ⑦ | `[expo-notifications]` 푸시 토큰 리스너 경고 | 고침 | 알림 등록 |

## ① React #419 — 왜 보류인가

**우리 코드가 아니다.** 담당 세션이 재서 확인했다 — **인증 게이트 자체가 없는
`/admin/expos`와 아직 아무 화면도 못 그린 `/login`에서도 #419가 똑같이 난다.** 화면이
그리는 내용과 무관하게 난다는 뜻이고, 그래서 어느 컴포넌트를 고쳐도 사라지지 않는다.

**구조에서 온다.** `web.output: "static"` + Expo Router + React 19의 조합이다. 정적으로
미리 그려 둔 HTML과 브라우저가 처음 그리는 것이 어긋나면 React 19는 조용히 클라이언트
렌더로 되돌리고 #419를 적는다. **화면은 정상으로 뜬다** — 콘솔 줄 하나가 남을 뿐이다.

**고치는 길은 하나뿐이고 그 값이 크다.** `web.output`을 `"single"`로 바꾸면 미리 그리는
HTML이 없어져 어긋날 것도 없어진다. 실제로 해 봤고(PR #255) **배포가 깨진다** —
`single`은 `dist/admin`을 만들지 않고, `scripts/split-admin-dist.mjs app`이 그 폴더가
없으면 exit 1을 낸다. `삭제된 이전 호스팅 선언`의 buildCommand가 `&&`로 이어져 있어서
**app-web과 admin 두 정적 사이트의 빌드가 «둘 다» 실패한다.** 되살리려면 관리자 오리진
분리(`삭제된 이전 호스팅 선언` + `split-admin-dist.mjs`)를 다시 설계해야 한다.

**그래서 정한다 — 콘솔 줄 하나를 없애려고 배포 구조를 다시 짜지 않는다.** 사용자에게
보이는 증상이 없고, 관리자 오리진 분리는 보안 경계라 더 무겁다. 되돌린 커밋은
`d06a1ccf`(`revert(①): web.output single→static`)다.

**다시 볼 조건 둘.** 관리자 오리진을 다른 이유로 손대게 되면 그때 `single`을 같이 재본다.
Expo Router가 React 19 하이드레이션을 정리하면 그때 자동으로 없어지는지 확인한다.

## ④ CLS 0.22 — ①이 원인이 아니었다

처음에는 ①의 하이드레이션 되돌림이 레이아웃을 흔드는 것으로 봤는데, ①을 되돌린 뒤에도
CLS가 그대로였다. **원인이 따로 있다.** 콘솔 담당 세션이 홈 · 검색에서 무엇이 밀리는지를
따로 잰다 — 이미지 자리(width/height 미지정) · 늦게 오는 폰트 · 로더가 사라지며 생기는
높이 변화가 후보다.

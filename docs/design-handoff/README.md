# 최신 전달본

현재 사용자가 전달한 디자인 원본은 [current/README.md](current/README.md)를 시작점으로 확인합니다. `current/`의 64개 파일은 전달 ZIP에서 내용 변경 없이 추출했습니다. 구현 시 토큰·화면 명세·기준 PNG·HTML 원본을 함께 확인합니다.

이전 자료는 삭제 범위 확인 전까지 보존합니다. 아래 내용은 이전 핸드오프 설명입니다.

---
# 디자인 핸드오프

## 현재 기준: SEED

**[seed/](seed)** 가 현재 디자인 핸드오프다. Claude Design(SEED Design System, 당근마켓 기반)으로
만들어졌고, Primary만 웨딩픽 코랄(`#FF6F61`)로 치환했다. 색·타이포·컴포넌트 확정값의
원출처는 [seed/웨딩픽 컴포넌트 시트.dc.html](seed/웨딩픽%20컴포넌트%20시트.dc.html)이고,
전체 화면 목록(176개)은 [seed/웨딩픽 전체 IA.dc.html](seed/웨딩픽%20전체%20IA.dc.html)의
JS 배열 `G`에 있다. 개요는 [seed/README.md](seed/README.md), 확정 규칙은
[seed/PROJECT_RULES.md](seed/PROJECT_RULES.md)를 본다.

**주의:** [seed/README.md](seed/README.md)의 프로즈 색 표는 몇 곳에서 실제
`웨딩픽 컴포넌트 시트.dc.html`과 어긋난다(예: Primary press · Warning · Danger). 값이
갈리면 `.dc.html` 인라인 스타일 쪽이 맞다.

이 폴더는 `통합정책 v3.14`와 어긋나는 부분이 있으면 통합정책을 따른다 — 특히 카피·용어·
정책 규칙은 통합정책이 최종 기준이고, 이 핸드오프는 시각 디자인(색·타이포·간격·컴포넌트
규격) 쪽이 더 상세하고 최신이다.

### 회원탈퇴(WP-MY-008) 문구 규칙

탈퇴 후에도 작성자와 분리돼 유지되는 자료의 그룹명은 **`작성자 정보와 분리되는 정보`**다.
**`남는 것`이라고 쓰지 않는다** — "내 것이 그대로 있다"로 읽히지만 실제로는 나와 끊어진
자료다(`packages/domain/src/copy-rules.ts`의 `BANNED_PHRASES`가 `남는 것`을 막는다).
화면 문구는 세 곳이 같은 기준을 말해야 한다 — 탈퇴 화면(WP-MY-008) · 이용약관 제12조 ·
개인정보처리방침 보유기간 표.

## 지난 버전: Toss TDS (v7) — 참고용

[archive-toss-v7-README.md](archive-toss-v7-README.md)는 이전 핸드오프 세대다. Toss TDS
Mobile 기반, blue500(`#3182f6`) 단일 강조색, 21개 화면, "관심업체"·"결제인증" 같은
지금은 폐기된 용어를 쓴다. 이 폴더에는 README만 남아 있고 실제 `.dc.html` 원본 파일은
없다 — 화면 구조·인터랙션 로직 참고 이상으로는 쓰지 않는다.

2026-09-02 기준 코드(`packages/ui/src/theme.ts`)는 v7의 그레이 스케일 값과 코랄 대체
방침(통합정책 v3.1 §5)에서 출발했지만, 이후 SEED 핸드오프 값으로 다시 맞췄다 — 지금부터는
SEED가 기준이다.

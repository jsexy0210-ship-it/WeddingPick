/**
 * 스타일. 한 파일에 담아 인라인으로 넣는다 — 랜딩 한 장에 요청을 더 만들 이유가 없다.
 *
 * 색은 앱과 같은 값을 쓴다. 시스템 설정이 어두우면 어두운 쪽으로 간다.
 */
export const STYLES = `
/*
 * 랜딩 토큰.
 *
 * packages/ui/src/theme.ts, typography.ts와 **같은 값이어야 한다.** 이 파일은
 * 번들러 없이 통째로 문서에 실려서 tokens.css를 import할 수 없다 — 그래서 값을
 * 옮겨 적되, apps/api/src/test/typography.test.ts가 두 곳이 갈라지지 않았는지
 * 지킨다.
 *
 * 키컬러는 코랄이다. 예전에는 여기만 보라색이었는데, 앱과 웹을 나란히 놓기
 * 전까지는 아무도 그것을 못 봤다.
 */
:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --bg-element: #f7f8f9;
  --text: #191f28;
  --text-secondary: #6b7684;
  --tint: #ff6f61;
  --border: #e5e8eb;
  --max: 44rem;

  /* 글자 크기 — t 스케일. 앱과 같은 수다. */
  --text-t1: 32px;
  --text-t2: 26px;
  --text-t4: 20px;
  --text-t5: 18px;
  --text-t6: 16px;
  --text-t7: 14px;
  --text-badge: 12px;
  --text-amount: 32px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #151718;
    --bg-element: #1f2325;
    --text: #ecedee;
    --text-secondary: #9ba1a6;
    --tint: #ff8478;
    --border: #2c3134;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  padding: 0 1.25rem 4rem;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard',
    'Noto Sans KR', 'Malgun Gothic', system-ui, sans-serif;
  font-size: var(--text-t5);
  line-height: 1.7;
  word-break: keep-all;
}

body > * { max-width: var(--max); margin-inline: auto; }

.skip {
  position: absolute;
  left: -9999px;
}
.skip:focus {
  position: static;
  display: inline-block;
  padding: 0.5rem 0.75rem;
}

.hero { padding: 4rem 0 2rem; }

.brand {
  margin: 0 0 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.brand span {
  color: var(--text-secondary);
  font-weight: 400;
  font-size: var(--text-t7);
  margin-left: 0.4rem;
}

h1 {
  margin: 0 0 1rem;
  /* 헤드라인만 화면 폭을 따라 늘어난다. 아래끝은 t1, 위끝은 큰 화면용이다. */
  font-size: clamp(var(--text-t1), 7vw, 44px);
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.lead { margin: 0 0 1rem; font-size: var(--text-t5); }

.note {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: var(--bg-element);
  color: var(--text-secondary);
  font-size: var(--text-t7);
}

.section { padding: 2.5rem 0 0; }

h2 {
  margin: 0 0 1rem;
  font-size: var(--text-t4);
  letter-spacing: -0.01em;
}

h3 { margin: 0 0 0.35rem; font-size: var(--text-t6); }

p { margin: 0 0 1rem; }

.cards { display: grid; gap: 0.75rem; }

.card {
  padding: 1rem 1.15rem;
  border-radius: 0.9rem;
  background: var(--bg-element);
}
.card p { margin: 0; color: var(--text-secondary); font-size: var(--text-t6); }

/* 표는 좁은 화면에서 제 안에서 스크롤한다. 본문이 옆으로 밀리지 않게. */
.table-scroll { overflow-x: auto; }

table {
  width: 100%;
  /* 좁은 화면에서 칸마다 줄바꿈되며 뭉개지느니 표 안에서 옆으로 넘긴다. */
  min-width: 26rem;
  border-collapse: collapse;
  font-size: var(--text-t6);
}
caption {
  text-align: left;
  padding-bottom: 0.5rem;
  color: var(--text-secondary);
  font-size: var(--text-t7);
}
th, td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}
thead th { color: var(--text-secondary); font-weight: 600; font-size: var(--text-t7); }
tbody th { font-weight: 600; white-space: nowrap; }

ul.sources, ul.policies {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}
ul.sources li, ul.policies li {
  display: grid;
  gap: 0.2rem;
  padding: 1rem 1.15rem;
  border-radius: 0.9rem;
  background: var(--bg-element);
  font-size: var(--text-t6);
}
ul.sources span, ul.policies span { color: var(--text-secondary); }

.status {
  justify-self: start;
  padding: 0.1rem 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  font-size: var(--text-badge);
}
.pending { font-size: var(--text-t7); }

ul.plain {
  margin: 0 0 1rem;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.35rem;
  font-size: var(--text-t6);
  color: var(--text-secondary);
}
ul.plain strong { color: var(--text); }

a { color: var(--tint); }
a:focus-visible, .skip:focus-visible { outline: 2px solid var(--tint); outline-offset: 2px; }

footer {
  padding: 3rem 0 0;
  color: var(--text-secondary);
  font-size: var(--text-t7);
}
footer p { margin: 0 0 0.35rem; }
`;

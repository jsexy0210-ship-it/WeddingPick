/**
 * 스타일. 한 파일에 담아 인라인으로 넣는다 — 랜딩 한 장에 요청을 더 만들 이유가 없다.
 *
 * 색은 앱과 같은 값을 쓴다. 시스템 설정이 어두우면 어두운 쪽으로 간다.
 */
export const STYLES = `
:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --bg-element: #f2f2f7;
  --text: #11181c;
  --text-secondary: #5c6870;
  --tint: #6c4ad6;
  --border: #d8dce0;
  --max: 44rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #151718;
    --bg-element: #1f2325;
    --text: #ecedee;
    --text-secondary: #9ba1a6;
    --tint: #a68cf0;
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
  font-size: 17px;
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
  font-size: 0.9rem;
  margin-left: 0.4rem;
}

h1 {
  margin: 0 0 1rem;
  font-size: clamp(2rem, 7vw, 2.75rem);
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.lead { margin: 0 0 1rem; font-size: 1.05rem; }

.note {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: var(--bg-element);
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.section { padding: 2.5rem 0 0; }

h2 {
  margin: 0 0 1rem;
  font-size: 1.35rem;
  letter-spacing: -0.01em;
}

h3 { margin: 0 0 0.35rem; font-size: 1rem; }

p { margin: 0 0 1rem; }

.cards { display: grid; gap: 0.75rem; }

.card {
  padding: 1rem 1.15rem;
  border-radius: 0.9rem;
  background: var(--bg-element);
}
.card p { margin: 0; color: var(--text-secondary); font-size: 0.95rem; }

/* 표는 좁은 화면에서 제 안에서 스크롤한다. 본문이 옆으로 밀리지 않게. */
.table-scroll { overflow-x: auto; }

table {
  width: 100%;
  /* 좁은 화면에서 칸마다 줄바꿈되며 뭉개지느니 표 안에서 옆으로 넘긴다. */
  min-width: 26rem;
  border-collapse: collapse;
  font-size: 0.95rem;
}
caption {
  text-align: left;
  padding-bottom: 0.5rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
}
th, td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}
thead th { color: var(--text-secondary); font-weight: 600; font-size: 0.85rem; }
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
  font-size: 0.95rem;
}
ul.sources span, ul.policies span { color: var(--text-secondary); }

.status {
  justify-self: start;
  padding: 0.1rem 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  font-size: 0.8rem;
}
.pending { font-size: 0.85rem; }

ul.plain {
  margin: 0 0 1rem;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.35rem;
  font-size: 0.95rem;
  color: var(--text-secondary);
}
ul.plain strong { color: var(--text); }

a { color: var(--tint); }
a:focus-visible, .skip:focus-visible { outline: 2px solid var(--tint); outline-offset: 2px; }

footer {
  padding: 3rem 0 0;
  color: var(--text-secondary);
  font-size: 0.85rem;
}
footer p { margin: 0 0 0.35rem; }
`;

import React from 'react';
import HomeBoard from './boards/home.jsx';
import SearchBoard from './boards/search.jsx';
import PickBoard from './boards/pick.jsx';
import NoteBoard from './boards/note.jsx';
import MyBoard from './boards/my.jsx';
import CommonBoard from './boards/common.jsx';
import ComponentsBoard from './boards/components.jsx';
import DevicesBoard from './boards/devices.jsx';
import { designMetadata } from './designMetadata.js';

const boards = { home: HomeBoard, search: SearchBoard, pick: PickBoard, note: NoteBoard, my: MyBoard, common: CommonBoard, components: ComponentsBoard, devices: DevicesBoard };
function readLocation() {
  const [raw, query] = decodeURI(window.location.hash.slice(1)).split('?');
  const params = new URLSearchParams(query || '');
  return { group: boards[raw] ? raw : 'home', screen: params.get('screen') || '', anchor: params.get('anchor') || '' };
}
function frameLabel(frame, index, canvas) {
  let branch = frame;
  while (branch.parentElement && branch.parentElement !== canvas) {
    const parent = branch.parentElement;
    const prefix = [...parent.children].slice(0, [...parent.children].indexOf(branch));
    const candidates = prefix.map(x => (x.textContent || '').trim().replace(/\s+/g, ' '));
    const idLabel = candidates.find(t => /WP-[A-Z0-9]+-\d+/.test(t) && t.length < 220);
    if (idLabel) return idLabel;
    const short = candidates.find(t => /^\d+(?:-\d+)?\s*\S/.test(t) && t.length < 100);
    if (short) return short;
    branch = parent;
  }
  return '화면 ' + String(index + 1).padStart(2, '0');
}
function focusFrame(canvas, frame, mode) {
  canvas.querySelectorAll('[data-design-hidden]').forEach(n => n.removeAttribute('data-design-hidden'));
  canvas.querySelectorAll('.design-focus-ancestor').forEach(n => n.classList.remove('design-focus-ancestor'));
  if (!frame || mode !== 'screen') return;
  let branch = frame;
  while (branch.parentElement && branch !== canvas) {
    const parent = branch.parentElement;
    for (const sibling of parent.children) if (sibling !== branch) sibling.setAttribute('data-design-hidden', 'true');
    if (parent !== canvas) parent.classList.add('design-focus-ancestor');
    branch = parent;
  }
}
class BoardBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() { return this.state.error ? <div className="preview-error">화면 렌더링 오류: {String(this.state.error.message)}</div> : this.props.children; }
}
function Mark() { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.5S3.5 15.2 3.5 9.9A4.4 4.4 0 0 1 12 8.1a4.4 4.4 0 0 1 8.5 1.8c0 5.3-8.5 10.6-8.5 10.6Z"/><path d="M9.4 11.9l1.7 1.7 3.4-3.4"/></svg>; }
export default function App() {
  const [location, setLocation] = React.useState(readLocation);
  const [frames, setFrames] = React.useState([]);
  const [mode, setMode] = React.useState('screen');
  const [scale, setScale] = React.useState(0.75);
  const [search, setSearch] = React.useState('');
  const [showMissing, setShowMissing] = React.useState(true);
  const canvasRef = React.useRef(null);
  const viewportRef = React.useRef(null);
  const Board = boards[location.group];
  const meta = designMetadata.find(d => d.id === location.group);
  const selected = frames.find(f => f.id === location.screen) || frames[0];
  React.useEffect(() => {
    const changed = () => setLocation(readLocation());
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const nodes = [...canvas.querySelectorAll('[data-design-frame]')].filter(n => !n.parentElement.closest('[data-design-frame]'));
    const index = nodes.map((node, i) => {
      const id = 'frame-' + String(i + 1).padStart(3, '0');
      node.dataset.frameId = id;
      return { id, label: frameLabel(node, i, canvas), sourceLine: node.dataset.sourceLine || '', node };
    });
    setFrames(index);
    setSearch('');
    if (viewportRef.current) viewportRef.current.scrollTo(0, 0);
    window.__WP_PREVIEW__ = { group: location.group, screens: index.map(({ node, ...item }) => item), runtime: React.version };
  }, [location.group]);
  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    let frame = selected?.node;
    if (location.anchor) {
      const anchor = [...canvas.querySelectorAll('[id]')].find(n => n.id === location.anchor);
      if (anchor) frame = anchor.closest('[data-design-frame]') || anchor.querySelector('[data-design-frame]') || frame;
    }
    focusFrame(canvas, frame, frames.length ? mode : 'board');
  }, [frames, selected, mode, location.anchor]);
  function navigate(group, screen = '') { window.location.hash = group + (screen ? '?screen=' + encodeURIComponent(screen) : ''); }
  const list = frames.filter(f => f.label.toLowerCase().includes(search.toLowerCase()));
  return <div className={'preview-shell' + (showMissing ? ' mark-missing' : '')}>
    <aside className="preview-sidebar">
      <a className="preview-brand" href="#home"><span className="preview-brand-mark"><Mark/></span><span><strong>WeddingPick</strong><small>앱 디자인 · v3.29</small></span></a>
      <div className="preview-nav-title">앱 화면</div>
      <nav aria-label="디자인 화면군">{designMetadata.map(d => <button key={d.id} className={'preview-nav-item' + (location.group === d.id ? ' active' : '')} onClick={() => navigate(d.id)}>{d.title}</button>)}</nav>
      <div className="preview-screen-heading"><strong>화면 목록</strong><span>{frames.length || '기준 보드'}</span></div>
      <input className="preview-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="화면명 · WP ID 검색" aria-label="화면 검색"/>
      <div className="preview-screen-list">{list.map((f, i) => <button key={f.id} className={'preview-screen-item' + (selected?.id === f.id ? ' active' : '')} onClick={() => { setMode('screen'); navigate(location.group, f.id); }}><span>{String(i + 1).padStart(2, '0')}</span><span>{f.label}</span></button>)}{!frames.length && <p className="preview-hint">공통 기준은 전체 보드에서 확인합니다.</p>}</div>
      <footer className="preview-sidebar-footer">기준 경로 <b>docs/design/</b><br/>랜딩 · 관리자 제외 · React 디자인 변환본</footer>
    </aside>
    <main className="preview-main">
      <header className="preview-toolbar"><div><h1>{meta.title}</h1><p>React 실행 미리보기 · 제품 API 미연결</p></div><div className="preview-controls"><div className="preview-segment"><button className={mode === 'screen' ? 'on' : ''} onClick={() => setMode('screen')}>화면 하나</button><button className={mode === 'board' ? 'on' : ''} onClick={() => setMode('board')}>전체 보드</button></div><label>배율 <select value={scale} onChange={e => setScale(Number(e.target.value))}>{[0.25, 0.5, 0.65, 0.75, 0.85, 1].map(n => <option key={n} value={n}>{Math.round(n * 100)}%</option>)}</select></label><label><input type="checkbox" checked={showMissing} onChange={e => setShowMissing(e.target.checked)}/> 누락 표시</label></div></header>
      <div className="preview-notice">앱 아이콘 30종이 포함되어 있습니다. history 1종은 대체 SVG이며, 회색 사진은 원본 사진 7종의 미첨부 표시입니다. 약관은 원본의 검토 전 시안입니다.</div>
      <div className="preview-current">{selected && mode === 'screen' ? selected.label : meta.source}<span>{meta.source}</span></div>
      <div ref={viewportRef} className="preview-viewport"><div ref={canvasRef} className="design-canvas" style={{ zoom: scale }}><BoardBoundary key={location.group}><Board/></BoardBoundary></div></div>
    </main>
  </div>;
}

/**
 * 관리자 콘솔 — P0 최소 4종.
 *
 * 별도 프레임워크 없이 바닐라 JS로 구성한다.
 * 인증: GET /v1/auth/providers → dev provider 있으면 dev 로그인, 없으면 Bearer 토큰 직접 입력.
 * CORS: API 서버에 CORS_ORIGINS 환경변수에 이 페이지 출처를 추가해야 한다.
 */
export function renderAdminPage(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WeddingPick 관리자</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d1117;--surface:#161b22;--border:#30363d;--text:#e6edf3;
  --text2:#8b949e;--accent:#c8912a;--ok:#3fb950;--warn:#d29922;
  --danger:#f85149;--info:#58a6ff;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
}
body{background:var(--bg);color:var(--text);min-height:100vh}
a{color:var(--accent)}
input,textarea,select{
  background:var(--surface);border:1px solid var(--border);
  color:var(--text);border-radius:6px;padding:6px 10px;font-size:14px;
  font-family:inherit;outline:none;width:100%;
}
input:focus,textarea:focus{border-color:var(--accent)}
button{
  cursor:pointer;border:none;border-radius:6px;padding:6px 14px;
  font-size:13px;font-family:inherit;font-weight:500;
}
.btn-primary{background:var(--accent);color:#000}
.btn-ok{background:var(--ok);color:#000}
.btn-danger{background:var(--danger);color:#fff}
.btn-ghost{background:transparent;border:1px solid var(--border);color:var(--text2)}
button:disabled{opacity:.4;cursor:not-allowed}

/* layout */
#app{display:flex;flex-direction:column;min-height:100vh}
.topbar{
  background:var(--surface);border-bottom:1px solid var(--border);
  padding:10px 20px;display:flex;align-items:center;gap:16px;
}
.topbar h1{font-size:16px;font-weight:600;color:var(--accent)}
.topbar .env-badge{
  font-size:11px;padding:2px 8px;border-radius:12px;
  background:var(--warn);color:#000;
}
.topbar .spacer{flex:1}
#logout-btn{font-size:12px}

/* login */
#login-section{
  flex:1;display:flex;align-items:center;justify-content:center;
}
.login-card{
  background:var(--surface);border:1px solid var(--border);
  border-radius:10px;padding:32px;width:100%;max-width:400px;
}
.login-card h2{font-size:18px;margin-bottom:20px}
.field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
.field label{font-size:13px;color:var(--text2)}

/* tabs */
#tabs-bar{
  background:var(--surface);border-bottom:1px solid var(--border);
  padding:0 20px;display:flex;gap:4px;overflow-x:auto;
}
.tab-btn{
  background:transparent;border:none;color:var(--text2);
  padding:12px 16px;font-size:13px;font-weight:500;
  border-bottom:2px solid transparent;border-radius:0;cursor:pointer;
  white-space:nowrap;
}
.tab-btn:hover{color:var(--text)}
.tab-btn.active{color:var(--accent);border-bottom-color:var(--accent)}
.badge{
  display:inline-block;background:var(--danger);color:#fff;
  border-radius:10px;font-size:11px;padding:1px 6px;margin-left:4px;
}
.badge.warn{background:var(--warn);color:#000}

/* main content */
#main-content{flex:1;padding:20px;max-width:900px;width:100%;margin:0 auto}
.panel{display:none}
.panel.active{display:block}

/* api base */
.api-config{
  display:flex;gap:8px;margin-bottom:20px;align-items:flex-end;
}
.api-config .field{flex:1;margin:0}

/* cards */
.item-card{
  background:var(--surface);border:1px solid var(--border);
  border-radius:8px;padding:16px;margin-bottom:12px;
}
.item-card .item-header{
  display:flex;align-items:flex-start;justify-content:space-between;
  gap:12px;margin-bottom:10px;
}
.item-card .item-id{font-size:11px;color:var(--text2);font-family:monospace}
.item-card .item-body{font-size:13px;color:var(--text2);margin-bottom:12px;line-height:1.5}
.item-card .actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.item-card .actions input,.item-card .actions textarea{
  flex:1;min-width:180px;font-size:12px;
}
.status-badge{
  font-size:11px;padding:2px 8px;border-radius:12px;
  background:var(--border);color:var(--text2);white-space:nowrap;
}
.status-badge.ok{background:rgba(63,185,80,.2);color:var(--ok)}
.status-badge.warn{background:rgba(210,153,34,.2);color:var(--warn)}
.status-badge.danger{background:rgba(248,81,73,.2);color:var(--danger)}

/* briefing table */
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:8px 12px;border-bottom:1px solid var(--border);text-align:left}
th{color:var(--text2);font-weight:500}
td:first-child{font-family:monospace;font-size:12px}

.empty-state{text-align:center;color:var(--text2);padding:40px;font-size:14px}
.section-title{font-size:15px;font-weight:600;margin-bottom:12px}
.error-msg{color:var(--danger);font-size:13px;margin-bottom:12px}
.loading{color:var(--text2);font-size:13px;padding:20px}
</style>
</head>
<body>
<div id="app">

<!-- 로그인 화면 -->
<div id="login-section">
  <div class="login-card">
    <h2>WeddingPick 관리자</h2>
    <div class="field">
      <label>API 주소</label>
      <input id="api-base" type="url" placeholder="https://api.weddingpick.com" value="http://localhost:3000">
    </div>
    <div id="login-error" class="error-msg" hidden></div>
    <div id="dev-login-form" hidden>
      <div class="field">
        <label>개발용 비밀값 (DEV_LOGIN_SECRET)</label>
        <input id="dev-secret" type="password" placeholder="비밀값 입력">
      </div>
      <div class="field">
        <label>사용자 키 (임의 문자열)</label>
        <input id="dev-userkey" type="text" placeholder="operator" value="operator">
      </div>
      <button id="dev-login-btn" class="btn-primary" style="width:100%">개발용 로그인</button>
    </div>
    <div id="token-login-form">
      <div class="field">
        <label>Bearer 토큰 (모바일 앱에서 확인)</label>
        <input id="bearer-token" type="password" placeholder="eyJ...">
      </div>
      <button id="token-login-btn" class="btn-primary" style="width:100%">토큰으로 로그인</button>
    </div>
    <p id="checking-providers" style="color:var(--text2);font-size:13px;margin-top:8px">제공자 확인 중…</p>
  </div>
</div>

<!-- 로그인 후 메인 -->
<div id="main-section" hidden>
  <div class="topbar">
    <h1>WeddingPick 관리자</h1>
    <span id="env-badge" class="env-badge" hidden></span>
    <span class="spacer"></span>
    <span id="api-url-display" style="font-size:12px;color:var(--text2)"></span>
    <button id="logout-btn" class="btn-ghost">로그아웃</button>
  </div>
  <div id="tabs-bar">
    <button class="tab-btn active" data-tab="briefing">브리핑</button>
    <button class="tab-btn" data-tab="objections">신고처리 <span id="obj-badge" class="badge" hidden></span></button>
    <button class="tab-btn" data-tab="rebuttals">반론심사 <span id="reb-badge" class="badge warn" hidden></span></button>
    <button class="tab-btn" data-tab="verifications">Pick인증검수 <span id="ver-badge" class="badge warn" hidden></span></button>
    <button class="tab-btn" data-tab="pii">오류수정 <span id="pii-badge" class="badge" hidden></span></button>
  </div>
  <div id="main-content">

    <!-- 브리핑 -->
    <div class="panel active" id="panel-briefing">
      <div class="section-title">결정 브리핑</div>
      <div id="briefing-content" class="loading">불러오는 중…</div>
      <div class="section-title" style="margin-top:24px">처리 대기</div>
      <div id="open-content" class="loading">불러오는 중…</div>
    </div>

    <!-- 신고처리 -->
    <div class="panel" id="panel-objections">
      <div class="section-title">후기 신고 처리 <button id="obj-refresh" class="btn-ghost" style="font-size:12px;margin-left:8px">새로고침</button></div>
      <div id="obj-content" class="loading">불러오는 중…</div>
    </div>

    <!-- 반론심사 -->
    <div class="panel" id="panel-rebuttals">
      <div class="section-title">업체 반론 심사 <button id="reb-refresh" class="btn-ghost" style="font-size:12px;margin-left:8px">새로고침</button></div>
      <div id="reb-content" class="loading">불러오는 중…</div>
    </div>

    <!-- Pick인증검수 -->
    <div class="panel" id="panel-verifications">
      <div class="section-title">Pick 인증 검수 <button id="ver-refresh" class="btn-ghost" style="font-size:12px;margin-left:8px">새로고침</button></div>
      <div id="ver-content" class="loading">불러오는 중…</div>
    </div>

    <!-- 오류수정 -->
    <div class="panel" id="panel-pii">
      <div class="section-title">개인정보 오류 수정 <button id="pii-refresh" class="btn-ghost" style="font-size:12px;margin-left:8px">새로고침</button></div>
      <div id="pii-content" class="loading">불러오는 중…</div>
    </div>

  </div><!-- #main-content -->
</div><!-- #main-section -->

</div><!-- #app -->

<script>
(function() {
  'use strict';

  // ── 상태 ────────────────────────────────────────────────────────
  let token = sessionStorage.getItem('wp_admin_token') || '';
  let apiBase = sessionStorage.getItem('wp_admin_api') || 'http://localhost:3000';

  // ── API 헬퍼 ─────────────────────────────────────────────────────
  async function api(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(apiBase + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || res.statusText), { status: res.status });
    return data;
  }

  // ── HTML 이스케이프 ───────────────────────────────────────────────
  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // 날짜 표기 전역 고정(핸드오프 v3.21) — 2027.05.16(토) 14:30 꼴.
  function fmtDate(s) {
    if (!s) return '—';
    const d = new Date(s);
    const p2 = (n) => String(n).padStart(2, '0');
    const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return d.getFullYear() + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate()) + '(' + wd + ') ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }

  // ── 로그인 ───────────────────────────────────────────────────────
  const loginSection = document.getElementById('login-section');
  const mainSection = document.getElementById('main-section');
  const loginError = document.getElementById('login-error');
  const checkingMsg = document.getElementById('checking-providers');
  const devForm = document.getElementById('dev-login-form');
  const tokenForm = document.getElementById('token-login-form');

  document.getElementById('api-base').value = apiBase;

  function showError(msg) {
    loginError.textContent = msg;
    loginError.hidden = false;
  }

  async function checkProviders() {
    const base = document.getElementById('api-base').value.trim().replace(/\/$/, '');
    if (!base) return;
    apiBase = base;
    try {
      const data = await fetch(apiBase + '/v1/auth/providers').then(r => r.json());
      const hasDev = data.providers?.some(p => p.isDevelopmentStandIn);
      devForm.hidden = !hasDev;
      tokenForm.hidden = hasDev;
      checkingMsg.hidden = true;
    } catch {
      checkingMsg.textContent = '연결 실패. 주소를 확인해주세요.';
    }
  }

  document.getElementById('api-base').addEventListener('change', checkProviders);
  checkProviders();

  document.getElementById('dev-login-btn').addEventListener('click', async () => {
    const secret = document.getElementById('dev-secret').value.trim();
    const userKey = document.getElementById('dev-userkey').value.trim() || 'operator';
    if (!secret) { showError('비밀값을 입력해주세요'); return; }
    apiBase = document.getElementById('api-base').value.trim().replace(/\/$/, '');
    try {
      const data = await api('POST', '/v1/auth/sessions', {
        provider: 'apple', idToken: secret + ':' + userKey,
      });
      finishLogin(data.token);
    } catch (e) {
      showError('로그인 실패: ' + e.message);
    }
  });

  document.getElementById('token-login-btn').addEventListener('click', () => {
    const t = document.getElementById('bearer-token').value.trim();
    if (!t) { showError('토큰을 입력해주세요'); return; }
    apiBase = document.getElementById('api-base').value.trim().replace(/\/$/, '');
    finishLogin(t);
  });

  function finishLogin(t) {
    token = t;
    sessionStorage.setItem('wp_admin_token', token);
    sessionStorage.setItem('wp_admin_api', apiBase);
    loginSection.hidden = true;
    mainSection.hidden = false;
    document.getElementById('api-url-display').textContent = apiBase;
    loadAllPanels();
  }

  if (token) {
    finishLogin(token);
  }

  // ── 로그아웃 ─────────────────────────────────────────────────────
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try { await api('DELETE', '/v1/auth/sessions'); } catch {}
    sessionStorage.removeItem('wp_admin_token');
    token = '';
    loginSection.hidden = false;
    mainSection.hidden = true;
    document.getElementById('bearer-token').value = '';
  });

  // ── 탭 ───────────────────────────────────────────────────────────
  document.getElementById('tabs-bar').addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab));
  });

  // ── 노트 입력 헬퍼 ───────────────────────────────────────────────
  function noteInput(placeholder) {
    return '<input type="text" class="note-input" placeholder="' + esc(placeholder) + '" style="flex:1;min-width:160px">';
  }

  function getNote(container) {
    return container.querySelector('.note-input')?.value?.trim() || '';
  }

  // ── 알림 배지 ─────────────────────────────────────────────────────
  function setBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) { el.textContent = count; el.hidden = false; }
    else el.hidden = true;
  }

  // ── 브리핑 ───────────────────────────────────────────────────────
  async function loadBriefing() {
    const bEl = document.getElementById('briefing-content');
    const oEl = document.getElementById('open-content');
    try {
      const [brief, open] = await Promise.all([
        api('GET', '/v1/admin/decisions/briefing'),
        api('GET', '/v1/admin/decisions/open'),
      ]);

      if (!brief.rows?.length) {
        bEl.innerHTML = '<div class="empty-state">어제 처리된 결정이 없어요</div>';
      } else {
        bEl.innerHTML = '<table><thead><tr><th>단계</th><th>결정</th><th>결정자</th><th>신뢰도</th><th>시각</th></tr></thead><tbody>' +
          brief.rows.map(r =>
            '<tr><td>' + esc(r.step) + '</td><td>' + esc(r.decision) + '</td><td>' + esc(r.decider) + '</td><td>' +
            (r.confidence != null ? Math.round(r.confidence * 100) + '%' : '—') + '</td><td>' + fmtDate(r.createdAt) + '</td></tr>'
          ).join('') + '</tbody></table>';
      }

      if (!open.rows?.length) {
        oEl.innerHTML = '<div class="empty-state">사람 판단이 필요한 항목이 없어요 ✓</div>';
      } else {
        oEl.innerHTML = '<table><thead><tr><th>사건</th><th>단계</th><th>상태</th><th>시각</th></tr></thead><tbody>' +
          open.rows.map(r =>
            '<tr><td>' + esc(r.eventId?.slice(0,8)) + '…</td><td>' + esc(r.step) + '</td><td>' + esc(r.executionStatus) + '</td><td>' + fmtDate(r.createdAt) + '</td></tr>'
          ).join('') + '</tbody></table>';
      }
    } catch (e) {
      bEl.innerHTML = '<div class="error-msg">불러오기 실패: ' + esc(e.message) + '</div>';
      oEl.innerHTML = '';
    }
  }

  // ── 신고처리 (objections) ────────────────────────────────────────
  async function loadObjections() {
    const el = document.getElementById('obj-content');
    el.innerHTML = '<div class="loading">불러오는 중…</div>';
    try {
      const { objections = [] } = await api('GET', '/v1/admin/objections');
      setBadge('obj-badge', objections.length);
      if (!objections.length) {
        el.innerHTML = '<div class="empty-state">처리할 이의 신청이 없어요 ✓</div>';
        return;
      }
      el.innerHTML = objections.map(obj => {
        const id = obj.reviewId || obj.id;
        const status = obj.status || '';
        const sc = status === 'held' ? 'warn' : '';
        return '<div class="item-card" data-id="' + esc(id) + '">' +
          '<div class="item-header">' +
            '<div><div style="font-size:13px;font-weight:600">' + esc(obj.vendorName || '업체 불명') + '</div>' +
            '<div class="item-id">' + esc(id) + '</div></div>' +
            '<span class="status-badge ' + sc + '">' + esc(status || '대기') + '</span>' +
          '</div>' +
          '<div class="item-body">' + esc(obj.content || obj.note || '') + '</div>' +
          '<div class="actions">' +
            noteInput('처리 사유') +
            '<button class="btn-ghost" data-action="hold">보류</button>' +
            '<button class="btn-ok" data-action="restore">복원</button>' +
            '<button class="btn-danger" data-action="remove">삭제</button>' +
          '</div>' +
        '</div>';
      }).join('');

      el.querySelectorAll('.item-card').forEach(card => {
        const reviewId = card.dataset.id;
        card.querySelectorAll('[data-action]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const note = getNote(card);
            if (!note) { alert('사유를 입력해주세요'); return; }
            btn.disabled = true;
            try {
              await api('POST', '/v1/admin/objections/' + reviewId + '/' + btn.dataset.action, { note });
              await loadObjections();
            } catch (e) { alert('오류: ' + e.message); btn.disabled = false; }
          });
        });
      });
    } catch (e) {
      el.innerHTML = '<div class="error-msg">불러오기 실패: ' + esc(e.message) + '</div>';
    }
  }

  document.getElementById('obj-refresh').addEventListener('click', loadObjections);

  // ── 반론심사 (rebuttals) ─────────────────────────────────────────
  async function loadRebuttals() {
    const el = document.getElementById('reb-content');
    el.innerHTML = '<div class="loading">불러오는 중…</div>';
    try {
      const { rebuttals = [] } = await api('GET', '/v1/admin/rebuttals');
      setBadge('reb-badge', rebuttals.length);
      if (!rebuttals.length) {
        el.innerHTML = '<div class="empty-state">처리할 반론이 없어요 ✓</div>';
        return;
      }
      el.innerHTML = rebuttals.map(r => {
        const id = r.id;
        const status = r.status || '대기';
        return '<div class="item-card" data-id="' + esc(id) + '">' +
          '<div class="item-header">' +
            '<div><div style="font-size:13px;font-weight:600">' + esc(r.vendorName || '업체') + ' · ' + esc(r.claimantEmail || '') + '</div>' +
            '<div class="item-id">' + esc(id) + '</div></div>' +
            '<span class="status-badge warn">' + esc(status) + '</span>' +
          '</div>' +
          '<div class="item-body">' + esc(r.content || r.body || '') + '</div>' +
          '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">접수: ' + fmtDate(r.createdAt) + '</div>' +
          '<div class="actions">' +
            noteInput('심사 사유') +
            '<button class="btn-ok" data-action="publish">게시 승인</button>' +
            '<button class="btn-danger" data-action="reject">반려</button>' +
          '</div>' +
        '</div>';
      }).join('');

      el.querySelectorAll('.item-card').forEach(card => {
        const id = card.dataset.id;
        card.querySelectorAll('[data-action]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const note = getNote(card);
            if (!note) { alert('심사 사유를 입력해주세요'); return; }
            btn.disabled = true;
            try {
              await api('POST', '/v1/admin/rebuttals/' + id + '/' + btn.dataset.action, { note });
              await loadRebuttals();
            } catch (e) { alert('오류: ' + e.message); btn.disabled = false; }
          });
        });
      });
    } catch (e) {
      el.innerHTML = '<div class="error-msg">불러오기 실패: ' + esc(e.message) + '</div>';
    }
  }

  document.getElementById('reb-refresh').addEventListener('click', loadRebuttals);

  // ── Pick인증검수 (verifications) ─────────────────────────────────
  async function loadVerifications() {
    const el = document.getElementById('ver-content');
    el.innerHTML = '<div class="loading">불러오는 중…</div>';
    try {
      const { requests = [] } = await api('GET', '/v1/admin/verifications/backlog');
      setBadge('ver-badge', requests.length);
      if (!requests.length) {
        el.innerHTML = '<div class="empty-state">검수 대기 인증이 없어요 ✓</div>';
        return;
      }
      el.innerHTML = requests.map(r => {
        const id = r.id;
        const status = r.status || '대기';
        const sc = status === 'reviewing' ? 'warn' : '';
        return '<div class="item-card" data-id="' + esc(id) + '">' +
          '<div class="item-header">' +
            '<div><div style="font-size:13px;font-weight:600">' + esc(r.vendorName || '업체') + ' · ' + esc(r.requestedLevel || '') + '</div>' +
            '<div class="item-id">' + esc(id) + '</div></div>' +
            '<span class="status-badge ' + sc + '">' + esc(status) + '</span>' +
          '</div>' +
          '<div class="item-body">신청: ' + fmtDate(r.createdAt) + ' · 방법: ' + esc(r.method || '') + '</div>' +
          '<div class="actions">' +
            noteInput('검수 의견 (선택)') +
            '<button class="btn-ghost" data-action="review">검수 시작</button>' +
            '<button class="btn-ok" data-action="approve">승인</button>' +
            '<button class="btn-danger" data-action="reject-btn">반려</button>' +
          '</div>' +
          '<div class="actions" style="margin-top:6px">' +
            '<input class="reject-reason" placeholder="반려 사유 (필수)" style="flex:1">' +
          '</div>' +
        '</div>';
      }).join('');

      el.querySelectorAll('.item-card').forEach(card => {
        const id = card.dataset.id;

        card.querySelector('[data-action="review"]')?.addEventListener('click', async btn => {
          btn.target.disabled = true;
          try {
            await api('POST', '/v1/admin/verifications/' + id + '/review');
            await loadVerifications();
          } catch (e) { alert('오류: ' + e.message); btn.target.disabled = false; }
        });

        card.querySelector('[data-action="approve"]')?.addEventListener('click', async btn => {
          const note = getNote(card) || null;
          btn.target.disabled = true;
          try {
            await api('POST', '/v1/admin/verifications/' + id + '/approve', { note });
            await loadVerifications();
          } catch (e) { alert('오류: ' + e.message); btn.target.disabled = false; }
        });

        card.querySelector('[data-action="reject-btn"]')?.addEventListener('click', async btn => {
          const reason = card.querySelector('.reject-reason')?.value?.trim();
          if (!reason) { alert('반려 사유를 입력해주세요'); return; }
          btn.target.disabled = true;
          try {
            await api('POST', '/v1/admin/verifications/' + id + '/reject', { reason });
            await loadVerifications();
          } catch (e) { alert('오류: ' + e.message); btn.target.disabled = false; }
        });
      });
    } catch (e) {
      el.innerHTML = '<div class="error-msg">불러오기 실패: ' + esc(e.message) + '</div>';
    }
  }

  document.getElementById('ver-refresh').addEventListener('click', loadVerifications);

  // ── 데이터오류수정 (pii-reviews) ─────────────────────────────────
  async function loadPiiReviews() {
    const el = document.getElementById('pii-content');
    el.innerHTML = '<div class="loading">불러오는 중…</div>';
    try {
      const { reviews = [] } = await api('GET', '/v1/admin/pii-reviews');
      setBadge('pii-badge', reviews.length);
      if (!reviews.length) {
        el.innerHTML = '<div class="empty-state">처리할 개인정보 오류가 없어요 ✓</div>';
        return;
      }
      el.innerHTML = reviews.map(r => {
        const id = r.id;
        return '<div class="item-card" data-id="' + esc(id) + '">' +
          '<div class="item-header">' +
            '<div><div style="font-size:13px;font-weight:600">' + esc(r.vendorName || '업체') + '</div>' +
            '<div class="item-id">' + esc(id) + '</div></div>' +
            '<span class="status-badge warn">검토 필요</span>' +
          '</div>' +
          '<div class="item-body">접수: ' + fmtDate(r.createdAt) + '</div>' +
          '<div class="actions">' +
            '<button class="btn-ok" data-action="clean">개인정보 없음</button>' +
            '<button class="btn-danger" data-action="redact">개인정보 삭제</button>' +
          '</div>' +
          '<div class="actions" style="margin-top:6px">' +
            '<input class="redact-field" placeholder="필드명 (redact용)" style="flex:1">' +
            '<input class="redact-kind" placeholder="종류 (redact용)" style="flex:1">' +
          '</div>' +
        '</div>';
      }).join('');

      el.querySelectorAll('.item-card').forEach(card => {
        const id = card.dataset.id;

        card.querySelector('[data-action="clean"]')?.addEventListener('click', async btn => {
          btn.target.disabled = true;
          try {
            await api('POST', '/v1/admin/pii-reviews/' + id + '/clean');
            await loadPiiReviews();
          } catch (e) { alert('오류: ' + e.message); btn.target.disabled = false; }
        });

        card.querySelector('[data-action="redact"]')?.addEventListener('click', async btn => {
          const field = card.querySelector('.redact-field')?.value?.trim();
          const kind = card.querySelector('.redact-kind')?.value?.trim();
          if (!field || !kind) { alert('필드명과 종류를 입력해주세요'); return; }
          btn.target.disabled = true;
          try {
            await api('POST', '/v1/admin/pii-reviews/' + id + '/redact', { field, kind });
            await loadPiiReviews();
          } catch (e) { alert('오류: ' + e.message); btn.target.disabled = false; }
        });
      });
    } catch (e) {
      el.innerHTML = '<div class="error-msg">불러오기 실패: ' + esc(e.message) + '</div>';
    }
  }

  document.getElementById('pii-refresh').addEventListener('click', loadPiiReviews);

  // ── 전체 로드 ─────────────────────────────────────────────────────
  function loadAllPanels() {
    loadBriefing();
    loadObjections();
    loadRebuttals();
    loadVerifications();
    loadPiiReviews();
  }

})();
</script>
</body>
</html>`;
}

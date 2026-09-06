/**
 * 비밀번호 재설정. 디자인 핸드오프 v3.12 §3.3 "앱에서 재설정 안 받음 —
 * 메일 링크로 웹에서 처리". 메일의 링크가 `?token=`을 달고 이 페이지로 온다.
 *
 * 프레임워크도 번들러도 없다(`build.ts`의 다른 페이지들과 같은 이유) —
 * 이 링크를 여는 순간 앱을 깔지 않은 사람일 수도 있어서 무겁게 만들 이유가
 * 없다. 비밀번호 규칙(8자 이상 · 영문+숫자 · 특수문자)은
 * `@weddingpick/domain`의 `PASSWORD_RULES`와 같은 표다 — 이 파일의 `<script>`는
 * 브라우저에서 그대로 도는 바닐라 JS라 import할 수 없어서 값만 그대로 옮겼다.
 * 표가 바뀌면 여기도 같이 고친다.
 */
export function renderResetPasswordPage(apiUrl: string | null): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>비밀번호 재설정 — 웨딩픽</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --ink:#212124;--ink-2:#4d5159;--assistive:#868b94;--border:#dcdee3;
  --line:#eaebee;--recessed:#f7f8fa;--tint:#ff6f61;--negative:#e81607;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
}
body{background:#fff;color:var(--ink);min-height:100vh;display:flex;justify-content:center}
.wrap{width:100%;max-width:400px;padding:56px 24px 40px;display:flex;flex-direction:column;gap:24px}
h1{font-size:26px;line-height:35px;font-weight:700;white-space:pre-line}
p{font-size:16px;line-height:24px;color:var(--ink-2)}
label{display:block;font-size:14px;color:var(--ink-2);margin-bottom:6px}
.field{position:relative}
input[type=password],input[type=text]{
  width:100%;height:52px;border:1px solid var(--border);border-radius:6px;
  padding:0 44px 0 14px;font-size:17px;font-family:inherit;color:var(--ink);outline:none;
}
input:focus{border-color:var(--tint)}
.toggle{
  position:absolute;right:12px;top:50%;transform:translateY(-50%);
  background:none;border:0;cursor:pointer;color:var(--assistive);font-size:13px;font-family:inherit;
}
.rules{display:flex;flex-direction:column;gap:6px;margin-top:4px}
.rule{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--assistive)}
.rule.ok{color:var(--ink)}
.rule .dot{width:16px;height:16px;border-radius:999px;border:1.5px solid var(--border);flex:0 0 auto;position:relative}
.rule.ok .dot{border-color:var(--tint);background:var(--tint)}
.rule.ok .dot::after{content:'';position:absolute;left:4px;top:1px;width:5px;height:8px;border:solid #fff;border-width:0 1.6px 1.6px 0;transform:rotate(40deg)}
button.primary{
  height:52px;border:0;border-radius:6px;background:var(--tint);color:#fff;
  font-size:17px;font-weight:700;font-family:inherit;cursor:pointer;
}
button.primary:disabled{opacity:.4;cursor:not-allowed}
.error{color:var(--negative);font-size:14px}
.card{background:var(--recessed);border-radius:10px;padding:16px;font-size:14px;color:var(--ink-2);line-height:20px}
.hidden{display:none}
</style>
</head>
<body>
<div class="wrap">
  <div id="form-state">
    <h1>새 비밀번호를&#10;만들어주세요</h1>
    <div style="height:20px"></div>
    <div class="field">
      <label>비밀번호</label>
      <input id="password" type="password" autocomplete="new-password" placeholder="새 비밀번호">
      <button type="button" class="toggle" id="toggle-visible">보기</button>
    </div>
    <div class="rules" id="rules"></div>
    <div style="height:20px"></div>
    <div id="error" class="error hidden"></div>
    <button type="button" class="primary" id="submit" disabled>비밀번호 바꾸기</button>
  </div>

  <div id="done-state" class="hidden">
    <h1>비밀번호를&#10;바꿨어요</h1>
    <div style="height:12px"></div>
    <p>웨딩픽으로 돌아가 새 비밀번호로 로그인해주세요.</p>
  </div>

  <div id="invalid-state" class="hidden">
    <h1>링크가 만료됐거나&#10;이미 사용됐어요</h1>
    <div style="height:12px"></div>
    <p>웨딩픽 앱의 로그인 화면에서 비밀번호 찾기를 다시 해주세요.</p>
  </div>
</div>

<script>
(function() {
  'use strict';

  var API_BASE = ${JSON.stringify(apiUrl)};
  var token = new URLSearchParams(window.location.search).get('token');

  var formState = document.getElementById('form-state');
  var doneState = document.getElementById('done-state');
  var invalidState = document.getElementById('invalid-state');

  if (!token || !API_BASE) {
    formState.classList.add('hidden');
    invalidState.classList.remove('hidden');
    return;
  }

  var RULES = [
    { label: '8자 이상', test: function(v) { return v.length >= 8; } },
    { label: '영문과 숫자 함께', test: function(v) { return /[A-Za-z]/.test(v) && /[0-9]/.test(v); } },
    { label: '특수문자 하나 이상', test: function(v) { return /[^A-Za-z0-9]/.test(v); } },
  ];

  var passwordInput = document.getElementById('password');
  var rulesEl = document.getElementById('rules');
  var submitBtn = document.getElementById('submit');
  var toggleBtn = document.getElementById('toggle-visible');
  var errorEl = document.getElementById('error');
  var visible = false;

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function valid(v) {
    return RULES.every(function(r) { return r.test(v); });
  }

  function render() {
    var v = passwordInput.value;
    rulesEl.innerHTML = RULES.map(function(r) {
      var ok = r.test(v);
      return '<div class="rule' + (ok ? ' ok' : '') + '"><span class="dot"></span>' + esc(r.label) + '</div>';
    }).join('');
    submitBtn.disabled = !valid(v);
  }

  passwordInput.addEventListener('input', render);
  render();

  toggleBtn.addEventListener('click', function() {
    visible = !visible;
    passwordInput.type = visible ? 'text' : 'password';
    toggleBtn.textContent = visible ? '숨기기' : '보기';
  });

  submitBtn.addEventListener('click', function() {
    if (!valid(passwordInput.value)) return;
    submitBtn.disabled = true;
    errorEl.classList.add('hidden');

    fetch(API_BASE + '/v1/auth/email/password-reset/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: token, password: passwordInput.value }),
    }).then(function(res) {
      if (res.status === 204) {
        formState.classList.add('hidden');
        doneState.classList.remove('hidden');
        return;
      }
      return res.json().then(function(body) {
        if (res.status === 400) {
          formState.classList.add('hidden');
          invalidState.classList.remove('hidden');
          return;
        }
        errorEl.textContent = (body && body.error && body.error.message) || '비밀번호를 바꾸지 못했어요. 다시 시도해주세요.';
        errorEl.classList.remove('hidden');
        submitBtn.disabled = false;
      });
    }).catch(function() {
      errorEl.textContent = '연결이 불안정해요. 다시 시도해주세요.';
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
    });
  });
})();
</script>
</body>
</html>`;
}

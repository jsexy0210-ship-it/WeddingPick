// scripts/canon/ 도구들이 같이 쓰는 헬퍼. 실제 구현 코드(.ts/.tsx)의 객체 리터럴을
// 문자열로 잘라내고, 실행 가능한 JS로 바꿔서 eval한다 — 사람이 토큰 이름을 theme.ts에서
// 손으로 찾아 숫자로 바꾸는 수작업을 없앤다.
import vm from 'node:vm';

/** `export const Layout = { ... }`처럼 이름 붙은 객체 리터럴을 중괄호 균형을 맞춰 잘라낸다. */
export function extractNamedObjectLiteral(source, name) {
  const marker = `const ${name}`;
  const declIdx = source.indexOf(marker);
  if (declIdx === -1) return null;
  const eq = source.indexOf('=', declIdx);
  if (eq === -1) return null;
  const braceStart = source.indexOf('{', eq);
  if (braceStart === -1) return null;

  let depth = 0;
  let inString = null; // ' " ` 중 하나
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = braceStart; i < source.length; i++) {
    const c = source[i];
    const prev = source[i - 1];
    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (prev === '*' && c === '/') inBlockComment = false;
      continue;
    }
    if (inString) {
      if (c === inString && prev !== '\\') inString = null;
      continue;
    }
    if (c === '/' && source[i + 1] === '/') { inLineComment = true; continue; }
    if (c === '/' && source[i + 1] === '*') { inBlockComment = true; continue; }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  return null;
}

/**
 * 객체 리터럴 문자열을 evalexpr한다. RN/Expo 전역(Platform 등)은 흔한 값으로 스텁한다 —
 * 완벽하지 않을 수 있으니 결과에 stubbedGlobals로 어떤 이름을 스텁했는지 같이 준다.
 */
export function safeEvalObjectLiteral(objSource, extraGlobals = {}) {
  const stubs = {
    Platform: { select: (o) => o.ios ?? o.default ?? o.web ?? Object.values(o)[0], OS: 'ios' },
    ...extraGlobals,
  };
  const stubNames = Object.keys(stubs);
  const wrapped = `(function(${stubNames.join(',')}) {\n  return (${objSource});\n})`;
  const fn = vm.runInThisContext(wrapped, { filename: 'canon-rn-eval.js' });
  const value = fn(...stubNames.map((n) => stubs[n]));
  return { value, stubbedGlobals: stubNames };
}

/** theme.ts/typography.ts에서 토큰 그룹 여러 개를 한 번에 뽑아 { 그룹.키: 값 } 평면 표로 만든다. */
export function loadTokenGroups(source, groupNames) {
  const flat = {};
  const groups = {};
  for (const name of groupNames) {
    const literal = extractNamedObjectLiteral(source, name);
    if (!literal) continue;
    try {
      const { value } = safeEvalObjectLiteral(literal);
      groups[name] = value;
      flattenInto(flat, name, value);
    } catch (err) {
      groups[name] = { __error: err.message };
    }
  }
  return { flat, groups };
}

function flattenInto(flat, prefix, value) {
  if (value === null || typeof value !== 'object') {
    flat[prefix] = value;
    return;
  }
  for (const [k, v] of Object.entries(value)) {
    const key = `${prefix}.${k}`;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flattenInto(flat, key, v);
    else flat[key] = v;
  }
}

/** 객체 리터럴 소스 안의 Identifier.Identifier(.Identifier) 참조를 토큰 표 값으로 치환한다. */
export function substituteTokens(source, tokenFlat) {
  const entries = Object.entries(tokenFlat).sort((a, b) => b[0].length - a[0].length);
  let out = source;
  for (const [path, val] of entries) {
    if (typeof val !== 'number' && typeof val !== 'string') continue;
    const re = new RegExp(path.replace(/\./g, '\\.') + '\\b', 'g');
    const replacement = typeof val === 'string' ? JSON.stringify(val) : String(val);
    out = out.replace(re, replacement);
  }
  return out;
}

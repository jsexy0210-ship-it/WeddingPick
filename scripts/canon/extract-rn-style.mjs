#!/usr/bin/env node
/**
 * 구현 코드(.ts/.tsx) 안 StyleSheet.create({...})의 특정 키를 실제로 실행해서
 * (Layout.cardPadding 같은 토큰까지 실제 숫자로 풀어서) 뽑아낸다.
 *
 * extract-style.mjs(정본)와 짝이다 — 양쪽 다 "손으로 읽지 않고 실행해서 뽑는다."
 *
 * 사용:
 *   node scripts/canon/extract-rn-style.mjs --file apps/mobile/src/app/\(tabs\)/wedding/index.tsx --key tabs
 *   node scripts/canon/extract-rn-style.mjs --file <path> --key tabs --key tab --key tabActive
 */
import fs from 'node:fs';
import { extractNamedObjectLiteral, safeEvalObjectLiteral, loadTokenGroups } from './lib.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

function parseArgs(argv) {
  const out = { keys: [], json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') out.file = argv[++i];
    else if (a === '--key') out.keys.push(argv[++i]);
    else if (a === '--stylesheet-name') out.styleSheetName = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function usageAndExit(code) {
  console.log(`구현 코드 StyleSheet 값 추출기

  --file <path>              .ts/.tsx 경로 (필수)
  --key <name>                뽑을 스타일 키. 여러 번 줄 수 있다(필수, 최소 1개)
  --stylesheet-name <name>    StyleSheet.create를 담은 변수 이름(기본 "styles")
  --json                      JSON으로 출력

packages/ui의 Layout·Spacing·Radius·Border·Elevation·FontSize·LineHeight 토큰 참조는
자동으로 실제 값으로 치환한다. theme.X(런타임 훅 값)는 치환 못 하니 원본 표현식 그대로 보여준다.`);
  process.exit(code);
}

function findStyleSheetBlock(source, varName) {
  // `const styles = StyleSheet.create({` 형태를 찾는다. varName이 다르면 그 이름으로.
  const re = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*StyleSheet\\.create\\(`);
  const m = re.exec(source);
  if (!m) return null;
  const braceStart = source.indexOf('{', m.index + m[0].length - 1);
  return extractBalanced(source, braceStart);
}

function extractBalanced(source, braceStart) {
  let depth = 0;
  let inString = null;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = braceStart; i < source.length; i++) {
    const c = source[i];
    const prev = source[i - 1];
    if (inLineComment) { if (c === '\n') inLineComment = false; continue; }
    if (inBlockComment) { if (prev === '*' && c === '/') inBlockComment = false; continue; }
    if (inString) { if (c === inString && prev !== '\\') inString = null; continue; }
    if (c === '/' && source[i + 1] === '/') { inLineComment = true; continue; }
    if (c === '/' && source[i + 1] === '*') { inBlockComment = true; continue; }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return source.slice(braceStart, i + 1); }
  }
  return null;
}

function extractKeyFromStyleSheetBlock(blockSource, key) {
  // blockSource는 '{ tabs: {...}, tab: {...}, ... }' 전체. 그 안에서 `key: {`를 찾는다.
  const re = new RegExp(`(?:^|[\\s,{])${key}\\s*:\\s*\\{`);
  const m = re.exec(blockSource);
  if (!m) return null;
  const braceStart = blockSource.indexOf('{', m.index + m[0].length - 1);
  return extractBalanced(blockSource, braceStart);
}

function loadTokenFlat() {
  const themeSrc = fs.readFileSync(path.join(REPO_ROOT, 'packages/ui/src/theme.ts'), 'utf8');
  const typoSrc = fs.readFileSync(path.join(REPO_ROOT, 'packages/ui/src/typography.ts'), 'utf8');
  const theme = loadTokenGroups(themeSrc, ['Spacing', 'AdminSpacing', 'Layout', 'Radius', 'Border', 'Elevation', 'Motion']);
  const typo = loadTokenGroups(typoSrc, ['FontSize', 'LineHeight', 'LetterSpacing']);
  return { ...theme.flat, ...typo.flat };
}

function substituteTokensInSource(source, tokenFlat) {
  const entries = Object.entries(tokenFlat)
    .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
    .sort((a, b) => b[0].length - a[0].length);
  let out = source;
  for (const [tokenPath, val] of entries) {
    const re = new RegExp(tokenPath.replace(/\./g, '\\.') + '\\b(?!\\.)', 'g');
    out = out.replace(re, typeof val === 'string' ? JSON.stringify(val) : String(val));
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file || args.keys.length === 0) usageAndExit(args.help ? 0 : 1);

  const source = fs.readFileSync(args.file, 'utf8');
  const varName = args.styleSheetName || 'styles';
  const block = findStyleSheetBlock(source, varName);
  if (!block) {
    console.error(`「const ${varName} = StyleSheet.create({...})」를 이 파일에서 못 찾았다. --stylesheet-name으로 다른 변수명을 줘봐라.`);
    process.exit(1);
  }

  const tokenFlat = loadTokenFlat();
  const out = {};
  const warnings = [];

  for (const key of args.keys) {
    const raw = extractKeyFromStyleSheetBlock(block, key);
    if (raw === null) {
      warnings.push(`「${key}」를 StyleSheet 안에서 못 찾았다.`);
      continue;
    }
    const substituted = substituteTokensInSource(raw, tokenFlat);
    const themeRefs = [...substituted.matchAll(/\btheme\.[A-Za-z][\w]*/g)].map((m) => m[0]);
    if (themeRefs.length > 0) {
      warnings.push(`「${key}」가 theme.X(런타임 훅 값)를 쓴다 — 자동 치환 안 됨: ${[...new Set(themeRefs)].join(', ')}. Colors.light.<key>/Colors.dark.<key>를 직접 대조해라.`);
    }
    try {
      const { value } = safeEvalObjectLiteral(substituted, {
        theme: new Proxy({}, { get: (_, prop) => `<theme.${String(prop)}>` }),
      });
      out[key] = value;
    } catch (err) {
      warnings.push(`「${key}」eval 실패: ${err.message}. 원본: ${raw}`);
    }
  }

  for (const w of warnings) console.error(`(주의) ${w}`);

  if (args.json) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  console.log(`# ${args.file}`);
  for (const [k, v] of Object.entries(out)) {
    console.log(`${k}:`);
    for (const [p, val] of Object.entries(v)) console.log(`  ${p}: ${JSON.stringify(val)}`);
  }
}

main();

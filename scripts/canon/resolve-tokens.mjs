#!/usr/bin/env node
/**
 * packages/ui의 토큰(Layout·Spacing·Radius·Border·Elevation·FontSize·LineHeight·LetterSpacing·
 * Colors)을 실제로 실행해서 숫자·색상표로 뽑는다. "Layout.cardPadding이 몇 px이지?"를
 * theme.ts를 열어 손으로 찾는 대신 한 줄로 답한다.
 *
 * 사용:
 *   node scripts/canon/resolve-tokens.mjs --token Layout.cardPadding
 *   node scripts/canon/resolve-tokens.mjs --group Spacing
 *   node scripts/canon/resolve-tokens.mjs --all --json > /tmp/tokens.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTokenGroups } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const THEME_FILE = path.join(REPO_ROOT, 'packages/ui/src/theme.ts');
const TYPOGRAPHY_FILE = path.join(REPO_ROOT, 'packages/ui/src/typography.ts');

const THEME_GROUPS = ['Spacing', 'AdminSpacing', 'Layout', 'Radius', 'Border', 'Elevation', 'Motion', 'Colors', 'Skins'];
const TYPOGRAPHY_GROUPS = ['FontSize', 'LineHeight', 'LetterSpacing'];

function parseArgs(argv) {
  const out = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--token') out.token = argv[++i];
    else if (a === '--group') out.group = argv[++i];
    else if (a === '--all') out.all = true;
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function usageAndExit(code) {
  console.log(`packages/ui 토큰 조회

  --token <Group.key>   토큰 하나 조회 (예: Layout.cardPadding)
  --group <Group>       그룹 하나 전체 (예: Spacing)
  --all                 전부
  --json                JSON으로 출력

그룹: ${[...THEME_GROUPS, ...TYPOGRAPHY_GROUPS].join(' · ')}`);
  process.exit(code);
}

function loadAll() {
  const themeSrc = fs.readFileSync(THEME_FILE, 'utf8');
  const typoSrc = fs.readFileSync(TYPOGRAPHY_FILE, 'utf8');
  const theme = loadTokenGroups(themeSrc, THEME_GROUPS);
  const typo = loadTokenGroups(typoSrc, TYPOGRAPHY_GROUPS);
  return { flat: { ...theme.flat, ...typo.flat }, groups: { ...theme.groups, ...typo.groups } };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.token && !args.group && !args.all)) usageAndExit(args.help ? 0 : 1);

  const { flat, groups } = loadAll();

  if (args.token) {
    if (!(args.token in flat)) {
      console.error(`「${args.token}」을 못 찾았다. --all로 전체 목록을 보고 정확한 이름을 확인해라.`);
      process.exit(1);
    }
    const val = flat[args.token];
    console.log(args.json ? JSON.stringify({ [args.token]: val }, null, 2) : `${args.token} = ${JSON.stringify(val)}`);
    return;
  }

  if (args.group) {
    const g = groups[args.group];
    if (!g) {
      console.error(`「${args.group}」 그룹을 못 찾았다.`);
      process.exit(1);
    }
    console.log(JSON.stringify(g, null, 2));
    return;
  }

  console.log(JSON.stringify(args.json ? flat : groups, null, 2));
}

main();

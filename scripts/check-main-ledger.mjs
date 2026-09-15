/*
 * 열린 PR이 main과 몇 커밋 · 몇 파일 떨어져 있는지, 그중 **이미 main에 다른 경로로
 * 들어간 것**이 몇 개인지 잰다.
 *
 *   node scripts/check-main-ledger.mjs
 *
 * 「올렸다」와 「다 올렸다」는 다른 말이다. 브랜치가 들고 있는 것을 손으로 세면 매번
 * 다르게 세게 되고, 세다가 빠뜨린 것은 빠뜨린 줄도 모른다. 그 자리를 이 스크립트가 맡는다.
 *
 * 세 숫자를 각각 다르게 읽는다.
 *   가져올 것  base...head 에서 바뀐 파일 — PR이 들고 왔다고 말하는 것
 *   아직 다름  main..head 에서 다른 파일 — 실제로 main과 아직 어긋난 것
 *   이미 반영  위 둘의 차 — 다른 PR · 다른 커밋으로 main에 이미 들어간 것
 *
 * 「이미 반영」이 크면 그 PR은 보이는 것보다 작다. 거꾸로 0이면 통째로 남아 있다.
 *
 * GH_TOKEN 또는 GITHUB_TOKEN이 있어야 열린 PR 목록을 받는다.
 */
import { execFileSync } from 'node:child_process';

const REPO = process.env.WEDDINGPICK_REPO ?? 'jsexy0210-ship-it/WeddingPick';
const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
if (!token) {
  console.error('GH_TOKEN 또는 GITHUB_TOKEN이 없다 — 열린 PR 목록을 받지 못한다.');
  process.exit(2);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const files = (out) => (out === '' ? [] : out.split('\n'));

/*
 * `fetch`가 아니라 curl로 부른다. 이 저장소를 보는 원격 세션은 바깥으로 나가는 요청이
 * 프록시를 거치고, 토큰도 거기서 바꿔 끼워진다 — node의 fetch는 그 프록시를 타지 않아
 * 자리표시자 토큰을 그대로 보내고 401을 받는다.
 */
let prs;
try {
  const raw = execFileSync(
    'curl',
    ['-sS', '--fail-with-body', '-H', `Authorization: Bearer ${token}`,
     '-H', 'Accept: application/vnd.github+json',
     `https://api.github.com/repos/${REPO}/pulls?state=open&per_page=100`],
    { encoding: 'utf8' }
  );
  prs = JSON.parse(raw).sort((a, b) => a.number - b.number);
} catch (error) {
  console.error(`열린 PR 목록을 받지 못했다 — ${error.message}`);
  process.exit(2);
}

console.log(`main = ${git('rev-parse', '--short=8', 'origin/main')} · 열린 PR ${prs.length}건\n`);
const head = ['PR', '브랜치', 'head', '앞선', '뒤진', '가져올것', '아직다름', '이미반영', 'SHA'];
const widths = [5, 42, 9, 6, 6, 9, 9, 9, 12];
const row = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join(' ');
console.log(row(head));

let unfetched = 0;
for (const pr of prs) {
  const ref = `origin/${pr.head.ref}`;
  let localSha;
  try {
    localSha = git('rev-parse', '--short=8', ref);
  } catch {
    unfetched += 1;
    console.log(row([`#${pr.number}`, pr.head.ref, '-', '-', '-', '-', '-', '-', '브랜치없음']));
    continue;
  }
  const shaOk = localSha === pr.head.sha.slice(0, 8) ? 'OK' : `다름(${localSha})`;
  const ahead = Number(git('rev-list', '--count', `origin/main..${ref}`));
  const behind = Number(git('rev-list', '--count', `${ref}..origin/main`));
  /*
   * 세 점(`...`)은 갈라진 뒤 브랜치가 바꾼 것이고, 두 점은 지금 두 트리가 다른 것이다.
   * 두 점에는 **브랜치가 뒤져서 다른 파일**도 섞여 들어오므로 그대로 빼면 안 된다 —
   * 세 점 목록 중 두 점에도 있는 것만 「아직 다름」이고, 나머지는 이미 main에 있다.
   */
  const bring = files(git('diff', '--name-only', `origin/main...${ref}`));
  const differ = new Set(files(git('diff', '--name-only', 'origin/main', ref)));
  const pending = bring.filter((file) => differ.has(file)).length;
  console.log(row([`#${pr.number}`, pr.head.ref, localSha, ahead, behind, bring.length, pending, bring.length - pending, shaOk]));
}

if (unfetched > 0) {
  console.log(`\n브랜치를 못 읽은 PR ${unfetched}건 — \`git fetch origin '+refs/heads/*:refs/remotes/origin/*'\` 뒤에 다시 돌린다.`);
}

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';

/*
 * 디자인 정본이 조용히 바뀌지 않았는지 센다.
 *
 * **2026-09-22에 정본이 v3.28로 통째로 바뀌었다**(대표 지시 — 「모든 작업은 v3.28 기준이다.
 * 모든 세션은 해당 저장소만 보고 작업한다」 · 「여기에 올리고 기존 파일은 다 파기한다」).
 * `docs/design/`에는 전달본 9개만 남고 `handoff/` · `figma-export/` ·
 * `UX_UI_REFRESH_HANDOFF.md` · `PAGE_STATE_AUDIT.md`는 지웠다.
 *
 * 그래서 이 검사도 바뀌었다.
 *
 *   전   원본 ZIP 2개 해시 + 활성 97개 해시 + screens.json의 화면 ID 208개
 *   후   docs/design 9개의 «파일 집합»과 정규화 해시
 *
 * 화면 ID 208개 검사는 근거 파일(`handoff/screens.json` · `docs/sync/design-screen-map.json`)이
 * 사라져 함께 뺐다. **v3.28은 화면 번호를 파일 안에서 1→N으로 새로 매겼고 중복·결번을
 * 정리했다** — 옛 208개 집합을 그대로 세면 새 정본을 틀렸다고 말하게 된다.
 *
 * 아래 «코드 계약» 검사들은 그대로 둔다. 그쪽은 지운 문서가 아니라 코드를 읽는다.
 */

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'docs/design/canonical-manifest.json'), 'utf8'));
const glossary = JSON.parse(readFileSync(join(root, 'spec/glossary.json'), 'utf8'));
const failures = [];

function fail(message) {
  failures.push(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

const textExtensions = new Set(['.cjs', '.css', '.html', '.js', '.jsx', '.json', '.md', '.svg', '.txt', '.webmanifest']);

function normalizedBytes(path) {
  const bytes = readFileSync(path);
  if (!textExtensions.has(extname(path).toLowerCase()) && !path.endsWith('download')) return bytes;
  return Buffer.from(bytes.toString('utf8').replace(/\r\n?/g, '\n'), 'utf8');
}

function filesUnder(directory) {
  const output = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else output.push(relative(directory, absolute).split(sep).join('/'));
    }
  };
  visit(directory);
  return output.sort();
}

/*
 * 파일 «집합»을 먼저 본다. 해시만 세면 파일이 하나 늘거나 사라진 것을 못 잡는다 —
 * 그리고 정본이 갈라지는 것은 대개 「한 벌 더 두는」 쪽이지 고쳐 쓰는 쪽이 아니다.
 * manifest 자신은 저장소가 적는 기록이라 센 대상에서 뺀다.
 */
const designDir = join(root, 'docs/design');
const actualFiles = filesUnder(designDir).filter((path) => path !== 'canonical-manifest.json');
/*
 * `manifest.files`는 전달 그대로다. `manifest.derivedFiles.files`는 저장소가 그 위에
 * 만들어 붙인 분석 문서(예: screen-inventory.md) — 재생성 스크립트가 있고, 돌리면
 * 해시가 바뀌는 것이 정상이다. 둘을 합쳐야 docs/design의 «전체» 파일 집합과 같다.
 */
const derivedFiles = manifest.derivedFiles?.files ?? [];
const expectedFiles = [...manifest.files, ...derivedFiles].map((item) => item.path).sort();

if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  const added = actualFiles.filter((path) => !expectedFiles.includes(path));
  const missing = expectedFiles.filter((path) => !actualFiles.includes(path));
  if (added.length > 0) fail(`docs/design에 정본 밖 파일: ${added.join(' · ')}`);
  if (missing.length > 0) fail(`docs/design에서 정본 파일이 사라짐: ${missing.join(' · ')}`);
}

for (const item of [...manifest.files, ...derivedFiles]) {
  const path = join(designDir, item.path);
  if (!existsSync(path)) continue;
  if (sha256(normalizedBytes(path)) !== item.normalizedSha256) {
    fail(`docs/design/${item.path} 내용 불일치 — ${derivedFiles.includes(item) ? 'node scripts/build-screen-inventory.mjs로 다시 만든다' : '전달본과 다르다'}`);
  }
}

const read = (path) => readFileSync(join(root, path), 'utf8');
const style = read('packages/domain/src/style.ts');
const setup = read('apps/mobile/src/app/setup.tsx');
const register = read('apps/mobile/src/app/(tabs)/capture/payment/register.tsx');
const paymentProofRoute = read('apps/api/src/routes/payment-proofs.ts');
const search = read('apps/mobile/src/app/(tabs)/search/index.tsx');
const capture = read('apps/mobile/src/app/(tabs)/capture/index.tsx');
const recommendations = read('apps/mobile/src/app/(tabs)/(home)/recommendations.tsx');

if (!style.includes('STYLE_PICK_MAX = 2')) fail('스타일 최대 2개 계약이 아님');
if (!setup.includes('STYLE_PICK_LIMIT_TOAST')) fail('온보딩 3번째 선택 토스트가 없음');
if (!register.includes('pickFromLibrary(1)') || !register.includes('uploadPaymentProof([picture])')) {
  fail('Pick 인증 사진 한 장 계약이 아님');
}
if (!paymentProofRoute.includes('images.length !== 1')) fail('API가 Pick 인증 사진 한 장 계약을 강제하지 않음');
/*
 * **이 자리가 v3.28과 어긋나 보였던 것은 인벤토리가 열을 바꿔 실었기 때문이다.**
 * 「README는 `탐색`→`검색`인데 화면 제목은 「업체 탐색」」으로 읽혔던 대조표 행은
 * 검색 파일 둘째 표만 「항목 · 정본 · Figma · 판단」 순이라 뒤집힌 것이었다. 바로 읽으면
 * 정본=«검색» · Figma=«업체 탐색»이고, 시안 markup도 WP-SRCH-001 `headTitleRoot`에
 * «검색»을 그린다. 셋이 같은 말을 하므로 제목을 되돌리고 게이트 예외를 뺐다.
 */
if (!search.includes("const TITLE = '검색'")) fail('검색 정본 제목이 아님');
const explorationRule = glossary.banned.find((entry) => entry.term === '탐색');
if (explorationRule?.allow?.includes('업체 탐색')) fail('해제한 「업체 탐색」 예외가 카피 게이트에 남아 있음');

/*
 * v3.29 재검증(2026-09-23, WP-SRCH-001)이 이 계약을 뒤집었다. 옛 계약은 결과 위에
 * 카테고리 ▾ · 지역 ▾ · 가격 ▾ 칩 셋(`styles.filterRow` + `budgetBand(...).label`)을
 * 요구했는데, `docs/design/html/대메뉴_검색.dc.html`의 WP-SRCH-001을
 * `node scripts/canon/extract-style.mjs --wp WP-SRCH-001`로 실행해 뽑아 보면 그 칩
 * 셋은 없다 — `stickyHead`에 검색창과 한 줄인 `filterBtn`(48×48) 하나뿐이고, 그
 * 아래 `countRow`에 결과 수 + 정렬 칩(`sortChip`) 하나만 있다. 세 조건은 그 단추가
 * 여는 필터 시트(WP-SRCH-002)에서 고른다 — CLAUDE.md 「등록 버튼은 헤더 영역에
 * 있는 것만 쓴다」와 같은 「같은 동작을 여는 진입점은 하나만 둔다」 원칙이다.
 * PR #514가 옛 칩 셋을 지우고 헤더 필터 단추 하나로 합쳤으므로 게이트를 그 계약에
 * 맞춘다 — 코드가 아니라 이 게이트가 v3.28 계약에 묶여 낡아 있었다.
 */
if (
  !search.includes('styles.headerFilterBtn') ||
  !search.includes('styles.countRow') ||
  !search.includes('styles.sortChip')
) {
  fail('검색 헤더 필터 단추 · 결과 수 · 정렬 칩 계약이 정본과 다름');
}
if (search.includes('styles.filterRow')) {
  fail('검색 결과 위에 폐기된 카테고리·지역·가격 칩 줄이 되살아남(v3.29 WP-SRCH-001엔 없음)');
}
if (search.includes('<BackButton') || search.includes('<DepthHeader')) fail('검색 Root에 Back 계열 헤더가 있음');
if (!capture.includes('<Redirect href="/capture/payment/consent?from=reports" />')) fail('없어진 제보 홈 리다이렉트가 아님');
if (!recommendations.includes("pathname: '/pick'")) fail('없어진 추천 독립 화면이 Pick Root로 이어지지 않음');

for (const path of manifest.deletedPagesThatStayDeleted) {
  if (existsSync(join(root, path))) fail(`삭제 페이지가 되살아남: ${path}`);
}

if (failures.length > 0) {
  console.error(failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(
  `디자인 정본 확인: ${manifest.canonicalVersion} · 전달 ${manifest.files.length}개 · 파생 ${derivedFiles.length}개`,
);

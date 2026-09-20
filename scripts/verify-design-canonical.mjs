import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'docs/design/canonical-manifest.json'), 'utf8'));
const screenMap = JSON.parse(readFileSync(join(root, 'docs/sync/design-screen-map.json'), 'utf8'));
const screens = JSON.parse(readFileSync(join(root, 'docs/design/handoff/screens.json'), 'utf8'));
const glossary = JSON.parse(readFileSync(join(root, 'spec/glossary.json'), 'utf8'));
const failures = [];

function fail(message) {
  failures.push(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.svg', '.txt', '.webmanifest']);

function normalizedBytes(path) {
  const bytes = readFileSync(path);
  if (!textExtensions.has(extname(path).toLowerCase())) return bytes;
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

for (const archive of manifest.archives) {
  const path = join(root, archive.path);
  if (!existsSync(path)) {
    fail(`원본 ZIP 없음: ${archive.path}`);
    continue;
  }
  const actualHash = sha256(readFileSync(path));
  if (actualHash !== archive.sha256) fail(`원본 ZIP 해시 불일치: ${archive.path}`);
  if (readFileSync(path).byteLength !== archive.sizeBytes) fail(`원본 ZIP 크기 불일치: ${archive.path}`);
}

for (const source of manifest.activeSources) {
  const directory = join(root, source.directory);
  const actualFiles = filesUnder(directory);
  const expectedFiles = source.files.map((item) => item.path).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    fail(`${source.directory} 파일 집합 불일치`);
  }
  for (const item of source.files) {
    const path = join(directory, item.path);
    if (!existsSync(path)) continue;
    if (sha256(normalizedBytes(path)) !== item.normalizedSha256) {
      fail(`${source.directory}/${item.path} 내용 불일치`);
    }
  }
}

const screenRecords = screens.groups.flatMap((group) => group.screens);
const screenIds = screenRecords.map((screen) => screen.id).sort();
const mappedIds = screenMap.screens.map((screen) => screen.id).sort();
if (screenIds.length !== 208 || new Set(screenIds).size !== 208) fail('screens.json 실제 고유 ID가 208개가 아님');
if (new Set(mappedIds).size !== mappedIds.length) fail('design-screen-map.json에 중복 ID가 있음');
if (JSON.stringify(screenIds) !== JSON.stringify(mappedIds)) fail('208개 화면 ID와 매핑 대장 집합이 다름');

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
if (!search.includes("const TITLE = '업체 탐색'")) fail('검색 정본 제목이 아님');
if (!search.includes('styles.filterRow') || !search.includes("budgetBand(filters.budget)?.label ?? '가격'")) {
  fail('검색 결과 필터 칩 줄이 정본과 다름');
}
const explorationRule = glossary.banned.find((entry) => entry.term === '탐색');
if (!explorationRule?.allow?.includes('업체 탐색')) fail('정본 검색 제목이 카피 게이트 예외에 없음');
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

console.log(`디자인 정본 확인: ZIP ${manifest.archives.length}개 · 활성 파일 ${manifest.activeSources.reduce((sum, item) => sum + item.files.length, 0)}개 · 화면 ID ${screenIds.length}개`);

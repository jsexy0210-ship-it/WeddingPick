import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VENDOR_CATEGORIES } from '@weddingpick/domain';
import { runPublicCollection } from './run';

/**
 * 반영 상한(run.ts MAX_APPLY) 시험.
 *
 * 크론을 되살리는 세 조건 중 「건수 상한」이 이것이다(public-data.yml). 예전 상한
 * (`vendors.length > 2000`이면 거절)은 전국 전수를 막아서 없앴는데, 그 뒤로 한
 * 실행이 쓸 수 있는 양에 아무 한계가 없었다. 분류가 한 번 어긋나면 전국 상권
 * 자료가 통째로 들어오고, 되돌리기는 수집보다 어렵다.
 *
 * DB 없이 확인한다 — 상한은 풀을 만들기 **전에** 던져야 의미가 있다. DATABASE_URL이
 * 가리키는 곳이 없어도 이 시험이 통과한다는 것 자체가 「한 건도 쓰지 않았다」의 증거다.
 */
const CSV = [
  '업체명,도로명주소,기준일자',
  '가나웨딩홀,경기도 이천시 길 1,2026-07-01',
  '다라웨딩홀,경기도 이천시 길 2,2026-07-01',
  '마바웨딩홀,경기도 이천시 길 3,2026-07-01',
].join('\n');

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'public-data-run-'));
  const file = join(dir, 'halls.csv');
  await writeFile(file, CSV, 'utf8');
  return { dir, file };
}

const saved = { url: process.env.DATABASE_URL, cap: process.env.PUBLIC_DATA_MAX_APPLY,
  limit: process.env.PUBLIC_DATA_LIMIT };
afterEach(() => {
  for (const [key, value] of Object.entries({ DATABASE_URL: saved.url, PUBLIC_DATA_MAX_APPLY: saved.cap,
    PUBLIC_DATA_LIMIT: saved.limit })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('상한을 넘으면 한 건도 쓰지 않고 거절한다', async () => {
  const { dir, file } = await fixture();
  // 없는 DB를 가리킨다 — 상한에 걸려 멈추면 여기까지 오지도 않는다.
  process.env.DATABASE_URL = 'postgres://nobody:nobody@127.0.0.1:1/none';
  process.env.PUBLIC_DATA_MAX_APPLY = '2';

  await expect(
    runPublicCollection(['--source', 'icheon-halls', '--file', file, '--apply', '--out', dir])
  ).rejects.toThrow('반영 상한 초과: 3건 (상한 2건)');

  // 수집 자체는 끝나 있어야 한다. 상한은 반영만 막는다 — 무엇이 얼마나 들어올
  // 뻔했는지 리포트로 봐야 상한을 올릴지 분류를 고칠지 정할 수 있다.
  const report = JSON.parse(await readFile(join(dir, 'icheon-halls-report.json'), 'utf8'));
  expect(report).toMatchObject({ accepted: 3, databaseApplied: false, db: null });
  expect(report.applyRefused).toContain('반영 상한 초과');
});

test('상한 안이면 반영 단계로 넘어간다', async () => {
  const { dir, file } = await fixture();
  process.env.DATABASE_URL = 'postgres://nobody:nobody@127.0.0.1:1/none';
  process.env.PUBLIC_DATA_MAX_APPLY = '3';

  // 상한을 통과하면 풀을 만들고 접속을 시도한다 — 상한 메시지가 아닌 것으로 끝나야
  // 「상한이 통과 자체를 막고 있지 않다」가 확인된다. 가드가 늘 참이면 시험은
  // 통과하지만 상한은 아무것도 지키지 않는 것이 된다.
  await expect(
    runPublicCollection(['--source', 'icheon-halls', '--file', file, '--apply', '--out', dir])
  ).rejects.toThrow(/^(?!반영 상한 초과)/);
});

test('리포트에 업종별 집계를 12종 전부 남긴다', async () => {
  const { dir, file } = await fixture();
  delete process.env.DATABASE_URL;

  await runPublicCollection(['--source', 'icheon-halls', '--file', file, '--out', dir]);

  const report = JSON.parse(await readFile(join(dir, 'icheon-halls-report.json'), 'utf8'));
  // 지자체 예식장 명단이라 전부 hall이다.
  expect(report.categoryCounts.hall).toBe(3);
  // **0건도 적는다.** 빠진 업종과 0건인 업종은 다른 이야기라, 0으로 적혀 있어야
  // 「코드를 안 받아와서 0」인지 「받았는데 없어서 0」인지 묻게 된다.
  expect(Object.keys(report.categoryCounts)).toEqual([...VENDOR_CATEGORIES]);
  expect(report.categoryCounts.bouquet).toBe(0);
  expect(Object.values(report.categoryCounts).reduce((a, b) => (a as number) + (b as number), 0))
    .toBe(report.accepted);
});

test('--limit은 CSV 경로에서도 지켜지고 리포트에 남는다', async () => {
  const { dir, file } = await fixture();
  delete process.env.DATABASE_URL;

  await runPublicCollection(['--source', 'icheon-halls', '--file', file, '--limit', '2', '--out', dir]);

  const report = JSON.parse(await readFile(join(dir, 'icheon-halls-report.json'), 'utf8'));
  expect(report.accepted).toBe(2);
  // 상한을 걸고 받았으면 accepted는 「있는 만큼」이 아니다. 그 사실이 남아야 한다.
  expect(report.limit).toBe(2);
  expect(report.categoryCounts.hall).toBe(2);
});

test('--limit이 없으면 리포트의 limit은 null이다', async () => {
  const { dir, file } = await fixture();
  delete process.env.DATABASE_URL;
  delete process.env.PUBLIC_DATA_LIMIT;

  await runPublicCollection(['--source', 'icheon-halls', '--file', file, '--out', dir]);

  const report = JSON.parse(await readFile(join(dir, 'icheon-halls-report.json'), 'utf8'));
  expect(report).toMatchObject({ accepted: 3, limit: null });
});

test('--limit에 0이나 글자를 주면 수집을 시작하지 않는다', async () => {
  const { dir, file } = await fixture();
  for (const bad of ['0', '-1', 'abc']) {
    await expect(
      runPublicCollection(['--source', 'icheon-halls', '--file', file, '--limit', bad, '--out', dir])
    ).rejects.toThrow('--limit은 1 이상의 수여야 합니다');
  }
});

test('--apply가 없으면 상한을 보지 않는다', async () => {
  const { dir, file } = await fixture();
  process.env.PUBLIC_DATA_MAX_APPLY = '1';
  delete process.env.DATABASE_URL;

  await runPublicCollection(['--source', 'icheon-halls', '--file', file, '--out', dir]);

  const report = JSON.parse(await readFile(join(dir, 'icheon-halls-report.json'), 'utf8'));
  expect(report).toMatchObject({ accepted: 3, databaseApplied: false, db: null });
});

import { Client } from 'pg';

import { migrate, schemaState } from './migrate';

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL이 필요하다.');
  }

  /*
   * `--status`는 읽기만 한다. 어느 DB가 어디까지 왔는지 모르는 채로 마이그레이션을
   * 돌리면 엉뚱한 DB를 바꾼다 — 실제로 CI가 운영과 다른 DB에 적용해온 정황이 있었다.
   * 먼저 보고 나서 정한다.
   */
  const statusOnly = process.argv.includes('--status');

  const client = new Client({ connectionString });
  await client.connect();

  try {
    if (statusOnly) {
      const state = await schemaState((sql) => client.query(sql));

      console.log(`적용 ${state.applied} / 기대 ${state.expected}`);
      if (state.error) console.log(`조회 오류: ${state.error}`);
      console.log(state.pending.length ? `밀린 것 ${state.pending.length}개:` : '밀린 것 없음');
      for (const version of state.pending) console.log(`  - ${version}`);

      // 밀렸다고 실패로 끝내지 않는다. 이 명령의 목적은 판정이 아니라 관측이다.
      return;
    }

    const ran = await migrate(client);
    console.log(ran.length ? `적용: ${ran.join(', ')}` : '적용할 마이그레이션 없음');
  } finally {
    await client.end();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});

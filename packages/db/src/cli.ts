import { Client } from 'pg';

import { migrate } from './migrate';

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL이 필요하다.');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
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

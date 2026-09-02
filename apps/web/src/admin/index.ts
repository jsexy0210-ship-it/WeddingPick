import { loadAdminConfig } from './config';
import { createPool } from './db';
import { buildAdminServer } from './server';

async function main() {
  const config = loadAdminConfig();
  const app = buildAdminServer({ pool: createPool(config.databaseUrl), adminPassword: config.adminPassword });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`관리자 웹이 ${config.port} 포트에서 돈다.`);
}

main().catch((error: Error) => {
  console.error(error);
  process.exit(1);
});

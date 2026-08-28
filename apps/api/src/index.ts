import { createAppleProvider, createKakaoProvider } from './auth/identity-provider';
import { loadConfig } from './config';
import type { AppContext } from './context';
import { createPool } from './db';
import { buildServer } from './server';
import { createLocalStorage } from './storage/local';
import { createS3Storage } from './storage/s3';

async function main() {
  const config = loadConfig();

  const context: AppContext = {
    config,
    pool: createPool(config.databaseUrl),
    storage:
      config.storage.driver === 's3'
        ? createS3Storage(config.storage)
        : createLocalStorage(),
    providers: {
      ...(config.appleClientId && { apple: createAppleProvider(config.appleClientId) }),
      ...(config.kakaoAppKey && { kakao: createKakaoProvider(config.kakaoAppKey) }),
    },
  };

  const app = buildServer(context);

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`API가 ${config.port} 포트에서 돈다.`);
}

main().catch((error: Error) => {
  console.error(error);
  process.exit(1);
});
